import type { NecDeckRunRequest } from "../../engine/wasm/worker";
import { yagiWavelengthM } from "./model";
import type { GeneratedYagiModel, SegmentedYagiWire, YagiIssue, YagiSegmentation } from "./schema";

export interface AdaptedYagiNec {
  deck: string;
  runRequest: NecDeckRunRequest;
  segmentation: YagiSegmentation;
  issues: YagiIssue[];
}

function fmt(value: number): string {
  if (!Number.isFinite(value)) throw new RangeError("NEC values must be finite.");
  // Eight significant digits keep every generated GW card within the classic
  // NEC 80-column input limit while retaining sub-millimetre precision here.
  return Number(value.toPrecision(8)).toString();
}

function oddSegments(lengthM: number, targetM: number): number {
  let count = Math.max(11, Math.ceil(lengthM / targetM));
  if (count % 2 === 0) count += 1;
  return Math.min(199, count);
}

export function segmentYagiWires(generated: GeneratedYagiModel): YagiSegmentation {
  const lambda = yagiWavelengthM(generated.model.frequencyHz);
  const issues: YagiIssue[] = [];
  const wires: SegmentedYagiWire[] = generated.wires.map((wire, index) => {
    const lengthM = Math.hypot(wire.endM.x - wire.startM.x, wire.endM.y - wire.startM.y, wire.endM.z - wire.startM.z);
    const segments = oddSegments(lengthM, lambda * 0.02);
    const segmentLengthM = lengthM / segments;
    if (segmentLengthM / lambda > 0.05 + 1e-12) issues.push({ severity: "error", code: `segment-long-${wire.id}`, message: `${wire.id} exceeds 0.05 wavelength per segment at the safety cap.` });
    if (segmentLengthM / wire.diameterM < 2) issues.push({ severity: "error", code: `segment-thick-${wire.id}`, message: `${wire.id} segments are shorter than two wire diameters.` });
    else if (segmentLengthM / wire.diameterM < 4) issues.push({ severity: "warning", code: `segment-aspect-${wire.id}`, message: `${wire.id} segment length is below four wire diameters; verify thin-wire convergence.` });
    return { ...wire, tag: index + 1, segments, segmentLengthM };
  });
  const totalSegments = wires.reduce((sum, wire) => sum + wire.segments, 0);
  if (totalSegments > 1600) issues.push({ severity: "error", code: "segment-budget", message: `The model requires ${totalSegments} segments, above the Yagi workbench safety limit.` });
  const driven = wires.find((wire) => wire.family === "driven")!;
  return { wires, totalSegments, feed: { tag: driven.tag, segment: (driven.segments + 1) / 2 }, issues };
}

export function adaptYagiToNec(generated: GeneratedYagiModel): AdaptedYagiNec {
  const segmentation = segmentYagiWires(generated);
  const issues = [...generated.issues, ...segmentation.issues];
  const errors = issues.filter((issue) => issue.severity === "error");
  if (errors.length > 0) throw new RangeError(errors.map((issue) => issue.message).join(" "));
  const model = generated.model;
  const lines = [
    "CM HF Antenna Studio horizontal Yagi-Uda",
    "CM SI units; elements on X, boom on Y, intended forward direction +Y",
    "CM Dimensions are starting points, not resonance or performance guarantees",
    "CE",
  ];
  for (const wire of segmentation.wires) lines.push(`GW ${wire.tag} ${wire.segments} ${fmt(wire.startM.x)} ${fmt(wire.startM.y)} ${fmt(wire.startM.z)} ${fmt(wire.endM.x)} ${fmt(wire.endM.y)} ${fmt(wire.endM.z)} ${fmt(wire.diameterM / 2)}`);
  // All elements are strictly elevated, so GE 1 and GE -1 have identical
  // current-expansion consequences here. GE 1 is accepted by the independent
  // NEC-2D comparator and is the conventional cross-engine representation.
  lines.push("GE 1");
  if (model.ground.kind === "perfect") lines.push("GN 1 0 0 0 0 0");
  else lines.push(`GN 2 0 0 0 ${fmt(model.ground.relativePermittivity)} ${fmt(model.ground.conductivitySPerM)}`);
  lines.push(
    "PT 0 0 0 0",
    `EX 0 ${segmentation.feed.tag} ${segmentation.feed.segment} 0 1 0`,
    `FR 0 1 0 0 ${fmt(model.frequencyHz / 1_000_000)} 0`,
    "RP 0 46 180 1000 0 0 2 2",
    "EN",
  );
  const deck = `${lines.join("\n")}\n`;
  if (lines.some((line) => line.startsWith("GW ") && line.length > 80)) throw new RangeError("A generated GW card exceeds NEC's 80-column portability limit.");
  return {
    deck,
    segmentation,
    issues,
    runRequest: { deck, parse: { nTheta: 46, nPhi: 180, thetaStart: 0, thetaStep: 2, phiStart: 0, phiStep: 2, computeCurrents: true, totalSegments: segmentation.totalSegments } },
  };
}
