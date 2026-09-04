import type { EndpointRef, Point3 } from "../../utils/editor-junctions";

export type EditorRadialRepresentation = "elevated-explicit" | "near-surface-explicit";

export interface EditorRadialSystem {
  id: number;
  name: string;
  hub: EndpointRef;
  drivenWireTag: number;
  generatedWireTags: number[];
  representation: EditorRadialRepresentation;
  count: number;
  lengthM: number;
  diameterM: number;
  rotationDeg: number;
  droopAngleDeg: number;
  clearanceM: number;
}

export interface RadialSystemSettings {
  representation: EditorRadialRepresentation;
  count: number;
  lengthM: number;
  diameterM: number;
  rotationDeg: number;
  droopAngleDeg: number;
  clearanceM: number;
}

export function defaultRadialSystemSettings(): RadialSystemSettings {
  return {
    representation: "elevated-explicit",
    count: 4,
    lengthM: 5,
    diameterM: 0.001,
    rotationDeg: 0,
    droopAngleDeg: 25,
    clearanceM: 0.002,
  };
}

export function normalizeRadialSettings(settings: RadialSystemSettings): RadialSystemSettings {
  const representation = settings.representation;
  return {
    representation,
    count: Math.max(representation === "near-surface-explicit" ? 4 : 2, Math.min(64, Math.round(settings.count))),
    lengthM: Math.max(0.2, Math.min(100, settings.lengthM)),
    diameterM: Math.max(0.0002, Math.min(0.1, settings.diameterM)),
    rotationDeg: ((settings.rotationDeg % 360) + 360) % 360,
    droopAngleDeg: representation === "near-surface-explicit" ? 0 : Math.max(0, Math.min(60, settings.droopAngleDeg)),
    clearanceM: Math.max(settings.diameterM / 2 + 0.0005, Math.min(0.1, settings.clearanceM)),
  };
}

export function radialEndpoint(hub: Point3, settings: RadialSystemSettings, index: number): Point3 {
  const normalized = normalizeRadialSettings(settings);
  const azimuth = (normalized.rotationDeg + index * 360 / normalized.count) * Math.PI / 180;
  const droop = normalized.droopAngleDeg * Math.PI / 180;
  const horizontal = normalized.lengthM * Math.cos(droop);
  return {
    x: hub.x + Math.cos(azimuth) * horizontal,
    y: hub.y + Math.sin(azimuth) * horizontal,
    z: hub.z - normalized.lengthM * Math.sin(droop),
  };
}

export function radialSystemIssues(hub: Point3, settings: RadialSystemSettings): string[] {
  const normalized = normalizeRadialSettings(settings);
  const issues: string[] = [];
  if (!Object.values(hub).every(Number.isFinite)) issues.push("The selected radial hub has invalid coordinates.");
  if (settings.count !== normalized.count) issues.push("Radial count is outside the supported range.");
  if (settings.lengthM !== normalized.lengthM) issues.push("Radial length must be between 0.2 m and 100 m.");
  if (settings.diameterM !== normalized.diameterM) issues.push("Radial diameter must be between 0.2 mm and 100 mm.");
  if (normalized.representation === "near-surface-explicit") {
    if (normalized.droopAngleDeg !== 0) issues.push("Near-surface radial wires must remain horizontal.");
  } else {
    const lowestZ = radialEndpoint(hub, normalized, 0).z;
    if (lowestZ <= normalized.diameterM / 2) issues.push("Drooping elevated radials would touch or cross the ground plane.");
  }
  return issues;
}

