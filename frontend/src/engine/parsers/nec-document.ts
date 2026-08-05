/** Loss-aware free-format NEC-2 document parser used by the wire editor. */

import type {
  ImportResult,
  NecCardDisposition,
  NecCardRecord,
  NecImportDiagnostic,
} from "../types";
import { parseNecNumericToken } from "./nec-file";

const SUPPORTED_LOAD_TYPES = new Set([0, 1, 4, 5]);

export function parseNecDocument(content: string): ImportResult {
  if (content.trim().length === 0) throw new Error("The NEC file is empty.");

  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const comments: string[] = [];
  const symbols: Record<string, number> = {};
  const wires: ImportResult["wires"] = [];
  const excitations: ImportResult["excitations"] = [];
  const loads: NonNullable<ImportResult["loads"]> = [];
  const transmissionLines: NonNullable<ImportResult["transmission_lines"]> = [];
  const frequencySegments: NonNullable<ImportResult["frequency_segments"]> = [];
  const cards: NecCardRecord[] = [];
  const diagnostics: NecImportDiagnostic[] = [];
  let ground: NonNullable<ImportResult["ground"]> = { type: "free_space" };
  let sawGround = false;
  let groundCardCount = 0;
  let geometryGroundFlag: -1 | 0 | 1 | null = null;
  let geometryGroundCardCount = 0;
  let ended = false;

  const diagnostic = (
    severity: "warning" | "error",
    code: string,
    message: string,
    lineNumber?: number,
    card?: string,
  ) => diagnostics.push({ severity, code, message, line_number: lineNumber, card });

  const record = (
    lineNumber: number,
    card: string,
    raw: string,
    disposition: NecCardDisposition,
    message?: string,
  ) => cards.push({
    line_number: lineNumber,
    card,
    raw,
    disposition,
    ...(message ? { message } : {}),
  });

  const malformed = (lineNumber: number, card: string, raw: string, message: string) => {
    record(lineNumber, card, raw, "blocking", message);
    diagnostic("error", "malformed_card", message, lineNumber, card);
  };

  const numeric = (parts: string[], index: number): number => {
    const token = parts[index];
    if (token === undefined) throw new Error(`missing field ${index}`);
    const value = parseNecNumericToken(token, symbols);
    if (!Number.isFinite(value)) throw new Error(`field ${index} is not finite`);
    return value;
  };

  const integer = (parts: string[], index: number): number => {
    const value = numeric(parts, index);
    if (!Number.isInteger(value)) throw new Error(`field ${index} must be an integer`);
    return value;
  };

  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index]!;
    const lineNumber = index + 1;
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    const card = (parts[0] ?? "").slice(0, 2).toUpperCase();

    if (ended) {
      record(lineNumber, card, raw, "preserved_only", "Content after EN remains only in the original document.");
      diagnostic("warning", "content_after_en", `Line ${lineNumber} appears after EN and is not converted.`, lineNumber, card);
      continue;
    }

    if (card === "CM") {
      comments.push(line.length > 2 ? line.slice(2).trim() : "");
      record(lineNumber, card, raw, "regenerated");
      continue;
    }

    if (card === "SY") {
      let body = line.slice(2).trim();
      const quote = body.indexOf("'");
      if (quote >= 0) body = body.slice(0, quote).trim();
      let valid = true;
      for (const assignment of body.split(",").map((value) => value.trim()).filter(Boolean)) {
        const equals = assignment.indexOf("=");
        const name = assignment.slice(0, equals).trim().toUpperCase();
        const expression = assignment.slice(equals + 1).trim();
        if (equals < 1 || !name || !expression) {
          valid = false;
          break;
        }
        try {
          symbols[name] = parseNecNumericToken(expression, symbols);
        } catch {
          valid = false;
          break;
        }
      }
      if (valid) {
        record(lineNumber, card, raw, "regenerated", "Symbols become numeric values in generated NEC.");
        diagnostic("warning", "symbols_expanded", `SY expressions on line ${lineNumber} will be expanded on generated export.`, lineNumber, card);
      } else {
        malformed(lineNumber, card, raw, `Invalid SY expression on line ${lineNumber}.`);
      }
      continue;
    }

    if (card === "CE" || card === "EN") {
      record(lineNumber, card, raw, "regenerated");
      if (card === "EN") ended = true;
      continue;
    }

    if (card === "GE") {
      try {
        geometryGroundCardCount += 1;
        if (geometryGroundCardCount > 1) throw new Error("multiple GE cards are not represented");
        const flag = integer(parts, 1);
        if (flag !== -1 && flag !== 0 && flag !== 1) throw new Error(`GE flag ${flag} is not represented`);
        geometryGroundFlag = flag;
        record(lineNumber, card, raw, "represented");
      } catch (error) {
        malformed(lineNumber, card, raw, `Unsupported or invalid GE card on line ${lineNumber}: ${messageOf(error)}.`);
      }
      continue;
    }

    if (card === "PT") {
      record(lineNumber, card, raw, "regenerated", "Current-output selection is regenerated from editor settings.");
      diagnostic("warning", "current_output_regenerated", `PT request on line ${lineNumber} is retained in the original but regenerated from editor settings.`, lineNumber, card);
      continue;
    }

    if (card === "GW") {
      try {
        if (parts.length < 10) throw new Error("expected 9 fields after GW");
        const tag = integer(parts, 1);
        const segments = integer(parts, 2);
        const values = Array.from({ length: 7 }, (_, offset) => numeric(parts, offset + 3));
        if (tag < 1) throw new Error("tag must be a positive integer");
        if (segments < 1) throw new Error("segments must be a positive integer");
        if (values[6]! <= 0) throw new Error("wire radius must be greater than zero");
        wires.push({
          tag,
          segments,
          x1: values[0]!, y1: values[1]!, z1: values[2]!,
          x2: values[3]!, y2: values[4]!, z2: values[5]!,
          radius: values[6]!,
        });
        record(lineNumber, card, raw, "represented");
      } catch (error) {
        malformed(lineNumber, card, raw, `Invalid GW card on line ${lineNumber}: ${messageOf(error)}.`);
      }
      continue;
    }

    if (card === "GN") {
      try {
        groundCardCount += 1;
        if (groundCardCount > 1) throw new Error("multiple ordered GN control blocks are not represented");
        const type = integer(parts, 1);
        sawGround = true;
        if (type === -1) ground = { type: "free_space" };
        else if (type === 1) ground = { type: "perfect" };
        else if (type === 2) {
          const permittivity = numeric(parts, 5);
          const conductivity = numeric(parts, 6);
          if (permittivity < 1 || conductivity < 0) throw new Error("invalid real-ground constants");
          ground = {
            type: "custom",
            custom_permittivity: permittivity,
            custom_conductivity: conductivity,
          };
        } else {
          throw new Error(`GN type ${type} is not represented by the structured editor`);
        }
        record(lineNumber, card, raw, "represented");
      } catch (error) {
        malformed(lineNumber, card, raw, `Unsupported or invalid GN card on line ${lineNumber}: ${messageOf(error)}.`);
      }
      continue;
    }

    if (card === "EX") {
      try {
        const type = integer(parts, 1);
        if (type !== 0) throw new Error(`EX type ${type} is not a voltage source`);
        excitations.push({
          wire_tag: integer(parts, 2),
          segment: integer(parts, 3),
          voltage_real: parts.length > 5 ? numeric(parts, 5) : 1,
          voltage_imag: parts.length > 6 ? numeric(parts, 6) : 0,
        });
        record(lineNumber, card, raw, "represented");
      } catch (error) {
        malformed(lineNumber, card, raw, `Unsupported or invalid EX card on line ${lineNumber}: ${messageOf(error)}.`);
      }
      continue;
    }

    if (card === "LD") {
      try {
        if (parts.length < 8) throw new Error("expected 7 fields after LD");
        const loadType = integer(parts, 1);
        if (!SUPPORTED_LOAD_TYPES.has(loadType)) throw new Error(`LD type ${loadType} is not supported`);
        const wireTag = integer(parts, 2);
        const segmentStart = integer(parts, 3);
        const segmentEnd = integer(parts, 4);
        if (wireTag < 0 || segmentStart < 0 || segmentEnd < 0) throw new Error("LD selection fields cannot be negative");
        if (wireTag === 0 && (segmentStart !== 0 || segmentEnd !== 0)) {
          throw new Error("absolute-segment LD selection is not stable under structured geometry edits");
        }
        if (segmentStart === 0 !== (segmentEnd === 0)) throw new Error("LD segment range must use two zeroes or two positive indices");
        loads.push({
          load_type: loadType,
          wire_tag: wireTag,
          segment_start: segmentStart,
          segment_end: segmentEnd,
          param1: numeric(parts, 5),
          param2: numeric(parts, 6),
          param3: numeric(parts, 7),
        });
        record(lineNumber, card, raw, "represented");
      } catch (error) {
        malformed(lineNumber, card, raw, `Unsupported or invalid LD card on line ${lineNumber}: ${messageOf(error)}.`);
      }
      continue;
    }

    if (card === "TL") {
      try {
        if (parts.length < 7) throw new Error("expected at least 6 fields after TL");
        transmissionLines.push({
          wire_tag1: integer(parts, 1),
          segment1: integer(parts, 2),
          wire_tag2: integer(parts, 3),
          segment2: integer(parts, 4),
          impedance: numeric(parts, 5),
          length: numeric(parts, 6),
          shunt_admittance_real1: parts.length > 7 ? numeric(parts, 7) : 0,
          shunt_admittance_imag1: parts.length > 8 ? numeric(parts, 8) : 0,
          shunt_admittance_real2: parts.length > 9 ? numeric(parts, 9) : 0,
          shunt_admittance_imag2: parts.length > 10 ? numeric(parts, 10) : 0,
        });
        record(lineNumber, card, raw, "represented");
      } catch (error) {
        malformed(lineNumber, card, raw, `Invalid TL card on line ${lineNumber}: ${messageOf(error)}.`);
      }
      continue;
    }

    if (card === "FR") {
      try {
        const type = integer(parts, 1);
        if (type !== 0) throw new Error(`FR type ${type} logarithmic stepping is not represented`);
        const steps = integer(parts, 2);
        const start = numeric(parts, 5);
        const increment = parts.length > 6 ? numeric(parts, 6) : 0;
        if (steps < 1 || start <= 0) throw new Error("frequency and step count must be positive");
        frequencySegments.push({
          start_mhz: start,
          stop_mhz: start + increment * Math.max(0, steps - 1),
          steps,
        });
        record(lineNumber, card, raw, "represented");
      } catch (error) {
        malformed(lineNumber, card, raw, `Unsupported or invalid FR card on line ${lineNumber}: ${messageOf(error)}.`);
      }
      continue;
    }

    if (card === "RP") {
      record(lineNumber, card, raw, "regenerated", "The selected editor pattern grid replaces this output request.");
      diagnostic("warning", "pattern_request_regenerated", `RP request on line ${lineNumber} is retained in the original but regenerated from editor settings.`, lineNumber, card);
      continue;
    }

    if (card === "NE" || card === "NH" || card === "PQ" || card === "XQ") {
      record(lineNumber, card, raw, "preserved_only", `${card} output control remains only in the original document.`);
      diagnostic("warning", "output_control_preserved_only", `${card} card on line ${lineNumber} is not represented by structured editor settings.`, lineNumber, card);
      continue;
    }

    const unsupportedMessage = `${card || "Unknown"} card on line ${lineNumber} can affect model meaning and is not supported by the structured editor.`;
    record(lineNumber, card || "??", raw, "blocking", unsupportedMessage);
    diagnostic("error", "unsupported_card", unsupportedMessage, lineNumber, card || "??");
  }

  if (!sawGround) diagnostic("warning", "ground_defaulted", "No GN card was present; structured mode uses free space.");
  if (geometryGroundFlag === null) {
    diagnostic("error", "geometry_end_missing", "No valid GE card was present; structured conversion is blocked.");
  } else {
    const expectsGround = geometryGroundFlag !== 0;
    const hasGround = ground.type !== "free_space";
    if (expectsGround !== hasGround) {
      diagnostic("error", "ground_card_conflict", `GE ${geometryGroundFlag} and GN ${ground.type} describe inconsistent ground geometry; structured conversion is blocked.`);
    }
  }
  if (frequencySegments.length === 0) {
    frequencySegments.push({ start_mhz: 14, stop_mhz: 14, steps: 1 });
    diagnostic("warning", "frequency_defaulted", "No FR card was present; structured mode uses 14 MHz until changed.");
  }
  if (excitations.length === 0) {
    diagnostic("warning", "source_missing", "No supported voltage source was found. No source was invented; add one before simulation.");
  }
  if (wires.length === 0) {
    diagnostic("error", "no_structured_wires", "No supported GW wire cards were available for structured editing.");
  }

  const firstFrequency = frequencySegments[0]!;
  const lastFrequency = frequencySegments[frequencySegments.length - 1]!;
  return {
    title: comments.join(" ").trim(),
    wires,
    excitations,
    loads,
    transmission_lines: transmissionLines,
    ground,
    ground_type: ground.type,
    ...(geometryGroundFlag !== null ? { geometry_ground_flag: geometryGroundFlag } : {}),
    frequency_start_mhz: firstFrequency.start_mhz,
    frequency_stop_mhz: lastFrequency.stop_mhz,
    frequency_steps: frequencySegments.reduce((sum, range) => sum + range.steps, 0),
    frequency_segments: frequencySegments,
    nec_document: {
      original_text: content,
      cards,
      diagnostics,
      structured_editable: wires.length > 0 && !diagnostics.some((item) => item.severity === "error"),
    },
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "invalid fields";
}
