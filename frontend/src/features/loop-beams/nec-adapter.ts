import type { NecDeckRunRequest } from "../../engine/wasm/worker";
import { applyConductorToDeck } from "../../engine/conductor";
import { useUIStore } from "../../stores/uiStore";
import { loopBeamWavelengthM } from "./model";
import type { GeneratedLoopBeamModel, LoopBeamIssue, LoopBeamSegmentation, SegmentedLoopBeamWire } from "./schema";

export interface AdaptedLoopBeamNec { deck: string; runRequest: NecDeckRunRequest; segmentation: LoopBeamSegmentation; issues: LoopBeamIssue[] }
function fmt(value: number): string { if (!Number.isFinite(value)) throw new RangeError("NEC values must be finite."); return Number(value.toPrecision(8)).toString(); }
function segmentsFor(lengthM: number, targetM: number, diameterM: number, source: boolean): number {
  if (source) return 1;
  const desired = Math.max(1, Math.ceil(lengthM / targetM));
  const aspectLimit = Math.max(1, Math.floor(lengthM / (diameterM * 2)));
  return Math.min(199, desired, aspectLimit);
}
export function segmentLoopBeamWires(generated: GeneratedLoopBeamModel): LoopBeamSegmentation {
  const lambda = loopBeamWavelengthM(generated.model.frequencyHz); const issues: LoopBeamIssue[] = [];
  const wires: SegmentedLoopBeamWire[] = generated.wires.map((wire, index) => {
    const lengthM = Math.hypot(wire.endM.x - wire.startM.x, wire.endM.y - wire.startM.y, wire.endM.z - wire.startM.z); const segments = segmentsFor(lengthM, lambda * 0.02, wire.diameterM, wire.source === true); const segmentLengthM = lengthM / segments;
    if (segmentLengthM / lambda > 0.05 + 1e-12) issues.push({ severity: "error", code: `segment-long-${wire.id}`, message: `${wire.id} exceeds 0.05 wavelength per segment.` });
    if (segmentLengthM / wire.diameterM < 2) issues.push({ severity: "error", code: `segment-thick-${wire.id}`, message: `${wire.id} segments are shorter than two wire diameters.` }); else if (segmentLengthM / wire.diameterM < 4) issues.push({ severity: "warning", code: `segment-aspect-${wire.id}`, message: `${wire.id} segment length is below four wire diameters; verify convergence.` });
    if (wire.source && segments !== 1) issues.push({ severity: "error", code: "feed-segments", message: "The explicit feed bridge must be represented by one exact source segment." }); return { ...wire, tag: index + 1, segments, segmentLengthM };
  });
  const source = wires.find((wire) => wire.id === generated.feedWireId); if (!source) issues.push({ severity: "error", code: "missing-feed", message: "The feed wire is missing from segmented geometry." });
  const totalSegments = wires.reduce((sum, wire) => sum + wire.segments, 0); if (totalSegments > 1800) issues.push({ severity: "error", code: "segment-budget", message: `The model requires ${totalSegments} segments, above the workbench safety limit.` });
  return { wires, totalSegments, feed: { tag: source?.tag ?? 0, segment: 1, wireId: generated.feedWireId }, issues };
}
export function adaptLoopBeamToNec(generated: GeneratedLoopBeamModel): AdaptedLoopBeamNec {
  const segmentation = segmentLoopBeamWires(generated); const issues = [...generated.issues, ...segmentation.issues]; const errors = issues.filter((issue) => issue.severity === "error"); if (errors.length) throw new RangeError(errors.map((issue) => issue.message).join(" "));
  const model = generated.model; const title = model.kind === "cubical-quad" ? "cubical quad" : model.kind === "hexbeam" ? "G3TXQ broadband Hexbeam" : model.kind.replace(/-/g, " "); const lines = [`CM HF Antenna Studio ${title}`, "CM SI units; every GW card is an actual solved conductor", `CM Feed-conductor orientation ${generated.feedConductorOrientation}; no polarisation claim is inferred`, "CM Dimensions are starting points, not resonance or performance guarantees", "CE"];
  for (const wire of segmentation.wires) lines.push(`GW ${wire.tag} ${wire.segments} ${fmt(wire.startM.x)} ${fmt(wire.startM.y)} ${fmt(wire.startM.z)} ${fmt(wire.endM.x)} ${fmt(wire.endM.y)} ${fmt(wire.endM.z)} ${fmt(wire.diameterM / 2)}`);
  lines.push("GE 1"); if (model.ground.kind === "perfect") lines.push("GN 1 0 0 0 0 0"); else lines.push(`GN 2 0 0 0 ${fmt(model.ground.relativePermittivity)} ${fmt(model.ground.conductivitySPerM)}`);
  lines.push("PT 0 0 0 0", `EX 0 ${segmentation.feed.tag} 1 0 1 0`, `FR 0 1 0 0 ${fmt(model.frequencyHz / 1e6)} 0`, "RP 0 46 180 1000 0 0 2 2", "EN"); const deck = applyConductorToDeck(`${lines.join("\n")}\n`, useUIStore.getState().conductor);
  if (lines.some((line) => line.startsWith("GW ") && line.length > 80)) throw new RangeError("A generated GW card exceeds NEC's 80-column portability limit.");
  return { deck, segmentation, issues, runRequest: { deck, parse: { nTheta: 46, nPhi: 180, thetaStart: 0, thetaStep: 2, phiStart: 0, phiStep: 2, computeCurrents: true, totalSegments: segmentation.totalSegments } } };
}
