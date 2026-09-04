import type { LumpedLoad } from "../api/nec";

export type ConductorMaterialId = "copper" | "aluminum" | "steel" | "stainless_steel" | "perfect" | "custom";

export interface ConductorMaterial {
  id: ConductorMaterialId;
  conductivitySPerM: number | null;
}

// Representative room-temperature bulk conductivities. These are generic
// engineering presets, not alloy/temperature certificates; see
// docs/CONDUCTOR_MATERIALS.md for sources and limitations.
export const CONDUCTOR_PRESETS: ReadonlyArray<{ id: ConductorMaterialId; label: string; conductivitySPerM: number | null }> = [
  { id: "copper", label: "Copper", conductivitySPerM: 5.8e7 },
  { id: "aluminum", label: "Aluminium", conductivitySPerM: 3.54e7 },
  { id: "steel", label: "Steel", conductivitySPerM: 1.03e7 },
  { id: "stainless_steel", label: "Stainless steel", conductivitySPerM: 1.1e6 },
  { id: "perfect", label: "Perfect conductor", conductivitySPerM: null },
  { id: "custom", label: "Custom conductivity", conductivitySPerM: 5.8e7 },
];

export const DEFAULT_CONDUCTOR: ConductorMaterial = { id: "copper", conductivitySPerM: 5.8e7 };
export const LEGACY_CONDUCTOR: ConductorMaterial = { id: "perfect", conductivitySPerM: null };

export function conductorLabel(material: ConductorMaterial): string {
  const preset = CONDUCTOR_PRESETS.find((candidate) => candidate.id === material.id);
  if (material.id === "perfect") return "Perfect conductor (lossless)";
  return `${preset?.label ?? "Custom"} · ${(material.conductivitySPerM ?? 0).toExponential(3)} S/m`;
}

export function validateConductor(material: ConductorMaterial): boolean {
  if (!CONDUCTOR_PRESETS.some((preset) => preset.id === material.id)) return false;
  return material.id === "perfect"
    ? material.conductivitySPerM === null
    : Number.isFinite(material.conductivitySPerM) && (material.conductivitySPerM ?? 0) > 0;
}

export function conductorLoad(material: ConductorMaterial): LumpedLoad | null {
  if (material.id === "perfect") return null;
  if (!validateConductor(material)) throw new RangeError("Antenna-wire conductivity must be a positive number in siemens per metre.");
  return { load_type: 5, wire_tag: 0, segment_start: 0, segment_end: 0, param1: material.conductivitySPerM!, param2: 0, param3: 0 };
}

export function conductorFromLoads(loads: LumpedLoad[] = []): ConductorMaterial {
  const conductivity = loads.find((load) => load.load_type === 5)?.param1;
  if (!Number.isFinite(conductivity) || (conductivity ?? 0) <= 0) return { ...LEGACY_CONDUCTOR };
  const preset = CONDUCTOR_PRESETS.find((candidate) =>
    candidate.id !== "custom" && candidate.id !== "perfect" && candidate.conductivitySPerM !== null
      && Math.abs(candidate.conductivitySPerM - conductivity!) / candidate.conductivitySPerM < 1e-6,
  );
  return { id: preset?.id ?? "custom", conductivitySPerM: conductivity! };
}

/** Add a global NEC LD 5 card unless the deck already defines conductivity. */
export function applyConductorToDeck(deck: string, material: ConductorMaterial): string {
  const load = conductorLoad(material);
  if (!load || /^\s*LD\s+5\b/im.test(deck)) return deck;
  const newline = deck.includes("\r\n") ? "\r\n" : "\n";
  const card = `LD 5 0 0 0 ${load.param1} 0 0`;
  const lines = deck.split(/\r?\n/);
  const insertion = lines.findIndex((line) => /^\s*(EX|FR|RP|XQ|EN)\b/i.test(line));
  lines.splice(insertion < 0 ? lines.length : insertion, 0, card);
  return lines.join(newline);
}

export function applyConductorToLoads(loads: LumpedLoad[] = [], material: ConductorMaterial): LumpedLoad[] {
  if (loads.some((load) => load.load_type === 5)) return loads;
  const global = conductorLoad(material);
  return global ? [...loads, global] : loads;
}
