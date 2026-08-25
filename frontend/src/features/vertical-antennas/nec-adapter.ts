import type { NecDeckRunRequest } from "../../engine/wasm/worker";
import { wavelengthM } from "./model";
import type {
  GeneratedVerticalModel,
  SegmentedVerticalWire,
  VerticalAntennaModel,
  VerticalIssue,
  VerticalSegmentation,
  VerticalWire,
} from "./schema";

export interface AdaptedVerticalNec {
  deck: string;
  runRequest: NecDeckRunRequest;
  segmentation: VerticalSegmentation;
  issues: VerticalIssue[];
}

function fmt(value: number): string {
  if (!Number.isFinite(value)) throw new RangeError("NEC values must be finite.");
  return Number(value.toPrecision(10)).toString();
}

function oddSegments(lengthM: number, targetM: number, minimum: number): number {
  let count = Math.max(minimum, Math.ceil(lengthM / targetM));
  if (count % 2 === 0) count += 1;
  return Math.min(199, count);
}

export function segmentVerticalWires(model: VerticalAntennaModel, wires: VerticalWire[]): VerticalSegmentation {
  const lambda = wavelengthM(model.frequencyHz);
  const targetM = lambda * 0.02;
  const issues: VerticalIssue[] = [];
  const segmented: SegmentedVerticalWire[] = wires.map((wire, index) => {
    const lengthM = Math.hypot(wire.endM.x - wire.startM.x, wire.endM.y - wire.startM.y, wire.endM.z - wire.startM.z);
    const segments = oddSegments(lengthM, targetM, wire.family === "radiator" ? 9 : 5);
    const segmentLengthM = lengthM / segments;
    if (segmentLengthM / lambda > 0.05 + 1e-12) issues.push({ severity: "error", code: `segment-${wire.id}-long`, message: `${wire.id} exceeds 0.05λ per segment at the 199-segment safety cap.` });
    if (segmentLengthM / wire.diameterM < 2) issues.push({ severity: "error", code: `segment-${wire.id}-thick`, message: `${wire.id} segments are shorter than two wire diameters.` });
    else if (segmentLengthM / wire.diameterM < 4) issues.push({ severity: "warning", code: `segment-${wire.id}-aspect`, message: `${wire.id} segment length is below four wire diameters; check thin-wire convergence.` });
    return { ...wire, tag: index + 1, segments, segmentLengthM };
  });
  const totalSegments = segmented.reduce((total, wire) => total + wire.segments, 0);
  if (totalSegments > 3500) issues.push({ severity: "error", code: "segment-budget", message: `The model requires ${totalSegments} segments, above the 3500-segment interactive safety limit.` });
  return { wires: segmented, totalSegments, feed: { tag: 1, segment: 1 }, issues };
}

export function adaptVerticalToNec(generated: GeneratedVerticalModel): AdaptedVerticalNec {
  const { model, wires } = generated;
  const segmentation = segmentVerticalWires(model, wires);
  const issues = [...generated.issues, ...segmentation.issues];
  const errors = issues.filter((issue) => issue.severity === "error");
  if (errors.length > 0) throw new RangeError(errors.map((issue) => issue.message).join(" "));

  const lines = [
    `CM HF Antenna Studio vertical system: ${model.configuration}`,
    "CM Generated dimensions are starting points, not resonance guarantees",
    model.radials.representation === "explicit-wires"
      ? `CM ${model.radials.count} radial wires are explicit NEC geometry`
      : model.radials.representation === "nec-ground-screen"
        ? `CM ${model.radials.count} radials use NEC's simplified GN screen approximation`
        : "CM Infinite perfect ground plane; no explicit radial wires",
    "CE",
  ];
  for (const wire of segmentation.wires) {
    lines.push(`GW ${wire.tag} ${wire.segments} ${fmt(wire.startM.x)} ${fmt(wire.startM.y)} ${fmt(wire.startM.z)} ${fmt(wire.endM.x)} ${fmt(wire.endM.y)} ${fmt(wire.endM.z)} ${fmt(wire.diameterM / 2)}`);
  }
  lines.push(model.radials.representation === "explicit-wires" ? "GE -1" : "GE 1");
  if (model.ground.kind === "perfect") {
    lines.push("GN 1 0 0 0 0 0");
  } else if (model.radials.representation === "nec-ground-screen") {
    lines.push(`GN 0 ${model.radials.count} 0 0 ${fmt(model.ground.relativePermittivity)} ${fmt(model.ground.conductivitySPerM)} ${fmt(model.radials.lengthM)} ${fmt(model.radials.diameterM / 2)}`);
  } else {
    lines.push(`GN 2 0 0 0 ${fmt(model.ground.relativePermittivity)} ${fmt(model.ground.conductivitySPerM)}`);
  }
  lines.push(
    "PT 0 0 0 0",
    "EX 0 1 1 0 1 0",
    `FR 0 1 0 0 ${fmt(model.frequencyHz / 1_000_000)} 0`,
    `${model.radials.representation === "nec-ground-screen" ? "RP 4" : "RP 0"} 19 72 1000 0 0 5 5`,
    "EN",
  );
  const deck = `${lines.join("\n")}\n`;
  return {
    deck,
    segmentation,
    issues,
    runRequest: {
      deck,
      parse: { nTheta: 19, nPhi: 72, thetaStart: 0, thetaStep: 5, phiStart: 0, phiStep: 5, computeCurrents: true, totalSegments: segmentation.totalSegments },
    },
  };
}
