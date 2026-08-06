import type { MeasurementDataset, MeasurementPoint, TouchstoneDataFormat, TouchstoneFrequencyUnit } from "./types";

export const MAX_TOUCHSTONE_BYTES = 5 * 1024 * 1024;
export const MAX_TOUCHSTONE_LINES = 100_000;
export const MAX_TOUCHSTONE_POINTS = 50_000;
const MAX_LINE_LENGTH = 16_384;

interface ImportMetadata {
  fileName: string;
  byteLength?: number;
  lastModified?: number | null;
}

function lineError(line: number, message: string): Error {
  return new Error(`Touchstone line ${line}: ${message}`);
}

function finiteToken(token: string, line: number, label: string): number {
  if (!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/.test(token)) throw lineError(line, `${label} is not a valid finite number.`);
  const value = Number(token);
  if (!Number.isFinite(value)) throw lineError(line, `${label} is not finite.`);
  return value;
}

function frequencyScale(unit: TouchstoneFrequencyUnit): number {
  return unit === "HZ" ? 1 : unit === "KHZ" ? 1e3 : unit === "MHZ" ? 1e6 : 1e9;
}

function hasUnsupportedControlCharacter(text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if ((code >= 1 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31)) return true;
  }
  return false;
}

function toComplex(value1: number, value2: number, format: TouchstoneDataFormat): { real: number; imag: number } {
  if (format === "RI") return { real: value1, imag: value2 };
  const magnitude = format === "MA" ? value1 : 10 ** (value1 / 20);
  const angle = value2 * Math.PI / 180;
  return { real: magnitude * Math.cos(angle), imag: magnitude * Math.sin(angle) };
}

function derivePoint(
  ordinal: number,
  sourceLine: number,
  rawLine: string,
  frequencyHz: number,
  originalValue1: number,
  originalValue2: number,
  format: TouchstoneDataFormat,
  referenceOhms: number,
): MeasurementPoint {
  const s11 = toComplex(originalValue1, originalValue2, format);
  const magnitude = Math.hypot(s11.real, s11.imag);
  const phase = Math.atan2(s11.imag, s11.real) * 180 / Math.PI;
  const swr = magnitude < 1 ? (1 + magnitude) / (1 - magnitude) : Math.abs(magnitude - 1) <= 1e-12 ? Number.POSITIVE_INFINITY : null;
  const denominator = (1 - s11.real) ** 2 + s11.imag ** 2;
  const resistance = denominator <= Number.EPSILON ? null : referenceOhms * (1 - s11.real ** 2 - s11.imag ** 2) / denominator;
  const reactance = denominator <= Number.EPSILON ? null : referenceOhms * 2 * s11.imag / denominator;
  return {
    ordinal, sourceLine, rawLine, frequencyHz, frequencyMhz: frequencyHz / 1e6,
    originalValue1, originalValue2, s11Real: s11.real, s11Imag: s11.imag,
    s11Magnitude: magnitude, s11PhaseDeg: phase,
    swr: swr !== null && Number.isNaN(swr) ? null : swr,
    resistanceOhms: resistance !== null && Number.isFinite(resistance) ? resistance : null,
    reactanceOhms: reactance !== null && Number.isFinite(reactance) ? reactance : null,
  };
}

export function parseTouchstoneS1p(sourceText: string, metadata: ImportMetadata): MeasurementDataset {
  const byteLength = metadata.byteLength ?? new TextEncoder().encode(sourceText).byteLength;
  if (byteLength > MAX_TOUCHSTONE_BYTES) throw new Error(`Touchstone file exceeds the ${MAX_TOUCHSTONE_BYTES / 1024 / 1024} MiB import limit.`);
  if (sourceText.includes("\0") || hasUnsupportedControlCharacter(sourceText)) throw new Error("Touchstone input contains unsupported control characters.");
  const lines = sourceText.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/);
  if (lines.length > MAX_TOUCHSTONE_LINES) throw new Error(`Touchstone input exceeds ${MAX_TOUCHSTONE_LINES} lines.`);

  let version: "1.0" | "2.0" = "1.0";
  let versionDeclared = false;
  let optionLine = "";
  let unit: TouchstoneFrequencyUnit = "GHZ";
  let format: TouchstoneDataFormat = "MA";
  let referenceOhms = 50;
  let declaredPorts: number | null = null;
  let declaredFrequencyCount: number | null = null;
  let networkDataSeen = false;
  let ended = false;
  let inInformation = false;
  const rawPoints: Array<{ sourceLine: number; rawLine: string; frequencyToken: number; value1: number; value2: number }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const sourceLine = index + 1;
    const rawLine = lines[index]!;
    if (rawLine.length > MAX_LINE_LENGTH) throw lineError(sourceLine, `line length exceeds ${MAX_LINE_LENGTH} characters.`);
    const content = rawLine.split("!", 1)[0]!.trim();
    if (!content) continue;
    if (ended) throw lineError(sourceLine, "content appears after [End].");

    if (content.startsWith("[")) {
      const match = content.match(/^\[([^\]]+)\]\s*(.*)$/);
      if (!match) throw lineError(sourceLine, "malformed Touchstone 2.0 keyword.");
      const keyword = match[1]!.trim().toLowerCase();
      const argument = match[2]!.trim();
      if (inInformation) {
        if (keyword === "end information") inInformation = false;
        continue;
      }
      if (keyword === "version") {
        if (optionLine || rawPoints.length || versionDeclared) throw lineError(sourceLine, "[Version] must appear once before the option line and network data.");
        if (argument !== "2.0") throw lineError(sourceLine, "only Touchstone versions 1.0 and 2.0 are supported.");
        version = "2.0"; versionDeclared = true;
        continue;
      }
      if (!versionDeclared) throw lineError(sourceLine, `Touchstone 2.0 keyword [${match[1]}] requires [Version] 2.0 first.`);
      if (keyword === "begin information") { inInformation = true; continue; }
      if (keyword === "end information") throw lineError(sourceLine, "[End Information] has no matching [Begin Information].");
      if (!optionLine) throw lineError(sourceLine, `the option line must precede [${match[1]}].`);
      if (keyword === "number of ports") {
        if (networkDataSeen) throw lineError(sourceLine, "[Number of Ports] must precede [Network Data].");
        declaredPorts = finiteToken(argument, sourceLine, "port count");
        if (declaredPorts !== 1) throw lineError(sourceLine, "only one-port .s1p data is supported.");
      } else if (keyword === "number of frequencies") {
        if (networkDataSeen) throw lineError(sourceLine, "[Number of Frequencies] must precede [Network Data].");
        declaredFrequencyCount = finiteToken(argument, sourceLine, "frequency count");
        if (!Number.isInteger(declaredFrequencyCount) || declaredFrequencyCount < 1 || declaredFrequencyCount > MAX_TOUCHSTONE_POINTS) throw lineError(sourceLine, `frequency count must be an integer from 1 to ${MAX_TOUCHSTONE_POINTS}.`);
      } else if (keyword === "reference") {
        if (networkDataSeen) throw lineError(sourceLine, "[Reference] must precede [Network Data].");
        referenceOhms = finiteToken(argument, sourceLine, "reference resistance");
        if (referenceOhms <= 0 || referenceOhms > 100_000) throw lineError(sourceLine, "reference resistance must be greater than 0 and no more than 100000 ohms.");
      } else if (keyword === "network data") {
        networkDataSeen = true;
      } else if (keyword === "end") {
        ended = true;
      } else {
        throw lineError(sourceLine, `unsupported Touchstone 2.0 keyword [${match[1]}].`);
      }
      continue;
    }

    if (inInformation) continue;
    if (content.startsWith("#")) {
      if (optionLine) throw lineError(sourceLine, "multiple option lines are not supported.");
      if (networkDataSeen || rawPoints.length) throw lineError(sourceLine, "the option line must precede network data.");
      optionLine = content;
      const tokens = content.slice(1).trim().split(/\s+/).filter(Boolean);
      for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
        const token = tokens[tokenIndex]!.toUpperCase();
        if (["HZ", "KHZ", "MHZ", "GHZ"].includes(token)) unit = token as TouchstoneFrequencyUnit;
        else if (["RI", "MA", "DB"].includes(token)) format = token as TouchstoneDataFormat;
        else if (token === "S") { /* supported parameter */ }
        else if (["Y", "Z", "G", "H"].includes(token)) throw lineError(sourceLine, "only S-parameter .s1p data is supported.");
        else if (token === "R") {
          const referenceToken = tokens[++tokenIndex];
          if (!referenceToken) throw lineError(sourceLine, "R must be followed by a reference resistance.");
          referenceOhms = finiteToken(referenceToken, sourceLine, "reference resistance");
          if (referenceOhms <= 0 || referenceOhms > 100_000) throw lineError(sourceLine, "reference resistance must be greater than 0 and no more than 100000 ohms.");
        } else throw lineError(sourceLine, `unsupported option token ${tokens[tokenIndex]}.`);
      }
      continue;
    }

    if (!optionLine) throw lineError(sourceLine, "an option line beginning with # must precede network data.");
    if (version === "2.0" && !networkDataSeen) throw lineError(sourceLine, "Touchstone 2.0 data must follow [Network Data].");
    const tokens = content.split(/\s+/);
    if (tokens.length !== 3) throw lineError(sourceLine, "one-port data must contain exactly frequency, value 1 and value 2.");
    const frequencyToken = finiteToken(tokens[0]!, sourceLine, "frequency");
    if (frequencyToken <= 0) throw lineError(sourceLine, "frequency must be greater than zero.");
    rawPoints.push({ sourceLine, rawLine, frequencyToken, value1: finiteToken(tokens[1]!, sourceLine, "S11 value 1"), value2: finiteToken(tokens[2]!, sourceLine, "S11 value 2") });
    if (rawPoints.length > MAX_TOUCHSTONE_POINTS) throw new Error(`Touchstone input exceeds ${MAX_TOUCHSTONE_POINTS} points.`);
  }

  if (inInformation) throw new Error("Touchstone [Begin Information] section is not closed.");
  if (!optionLine) throw new Error("Touchstone input has no option line beginning with #.");
  if (versionDeclared && declaredPorts !== 1) throw new Error("Touchstone 2.0 input must declare [Number of Ports] 1.");
  if (versionDeclared && !networkDataSeen) throw new Error("Touchstone 2.0 input has no [Network Data] section.");
  if (versionDeclared && !ended) throw new Error("Touchstone 2.0 input has no [End] marker.");
  if (rawPoints.length === 0) throw new Error("Touchstone input contains no one-port network data.");
  if (declaredFrequencyCount !== null && declaredFrequencyCount !== rawPoints.length) throw new Error(`Declared ${declaredFrequencyCount} frequencies but imported ${rawPoints.length}.`);

  const scale = frequencyScale(unit);
  const points = rawPoints.map((raw, ordinal) => derivePoint(ordinal, raw.sourceLine, raw.rawLine, raw.frequencyToken * scale, raw.value1, raw.value2, format, referenceOhms));
  for (let index = 1; index < points.length; index += 1) {
    if (points[index]!.frequencyHz <= points[index - 1]!.frequencyHz) throw lineError(points[index]!.sourceLine, "frequencies must be strictly increasing; data was not sorted or deduplicated.");
  }
  const invalidSwr = points.filter((point) => point.swr === null).length;
  const invalidImpedance = points.filter((point) => point.resistanceOhms === null || point.reactanceOhms === null).length;
  const warnings: string[] = [];
  if (invalidSwr) warnings.push(`${invalidSwr} point(s) have |S11| greater than 1, so passive-load SWR is not reported.`);
  if (invalidImpedance) warnings.push(`${invalidImpedance} point(s) are singular at S11 = 1, so impedance is not reported.`);

  return {
    schemaVersion: 1,
    id: `measurement-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    fileName: metadata.fileName,
    byteLength,
    lastModified: metadata.lastModified ?? null,
    importedAt: new Date().toISOString(),
    sourceText,
    touchstoneVersion: version,
    optionLine,
    frequencyUnit: unit,
    dataFormat: format,
    parameter: "S",
    referenceOhms,
    declaredFrequencyCount,
    points,
    warnings,
  };
}

export async function importTouchstoneS1p(file: File): Promise<MeasurementDataset> {
  if (!file.name.toLowerCase().endsWith(".s1p")) throw new Error("Select a Touchstone .s1p file. NanoVNA CSV dialects are not imported in this initial safe subset.");
  if (file.size > MAX_TOUCHSTONE_BYTES) throw new Error(`Touchstone file exceeds the ${MAX_TOUCHSTONE_BYTES / 1024 / 1024} MiB import limit.`);
  let sourceText: string;
  try { sourceText = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()); }
  catch { throw new Error("Touchstone input must be valid UTF-8 text in this initial browser import."); }
  return parseTouchstoneS1p(sourceText, { fileName: file.name, byteLength: file.size, lastModified: file.lastModified });
}
