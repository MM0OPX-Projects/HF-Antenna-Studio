import type { NecDeckRunRequest } from "../../engine/wasm/worker";
import { applyConductorToDeck } from "../../engine/conductor";
import { useUIStore } from "../../stores/uiStore";
import { lineMetrics, phasedWavelengthM } from "./model";
import type {
  ComplexValue,
  GeneratedPhasedArray,
  PhasedIssue,
  PhasedSegmentation,
  SegmentedPhasedWire,
} from "./schema";

export interface AdaptedPhasedNec {
  deck: string;
  runRequest: NecDeckRunRequest;
  segmentation: PhasedSegmentation;
  issues: PhasedIssue[];
}

function fmt(value: number): string {
  if (!Number.isFinite(value)) throw new RangeError("NEC values must be finite.");
  return Math.abs(value) < 1e-10 ? "0" : Number(value.toPrecision(8)).toString();
}

function oddSegments(lengthM: number, targetM: number, minimum = 5): number {
  let count = Math.max(minimum, Math.ceil(lengthM / targetM));
  if (count % 2 === 0) count += 1;
  return Math.min(199, count);
}

export function segmentPhasedWires(generated: GeneratedPhasedArray): PhasedSegmentation {
  const lambda = phasedWavelengthM(generated.model.frequencyHz);
  const issues: PhasedIssue[] = [];
  const wires: SegmentedPhasedWire[] = generated.wires.map((wire, index) => {
    const lengthM = Math.hypot(
      wire.endM.x - wire.startM.x,
      wire.endM.y - wire.startM.y,
      wire.endM.z - wire.startM.z,
    );
    const segments = wire.family === "source-junction"
      ? 1
      : oddSegments(lengthM, lambda * 0.02, wire.family.startsWith("element") ? 11 : 5);
    const segmentLengthM = lengthM / segments;
    if (segmentLengthM / lambda > 0.05 + 1e-12) {
      issues.push({ severity: "error", code: `segment-long-${wire.id}`, message: `${wire.id} exceeds 0.05 wavelength per segment at the safety cap.` });
    }
    if (segmentLengthM / wire.diameterM < 2) {
      issues.push({ severity: "error", code: `segment-thick-${wire.id}`, message: `${wire.id} segments are shorter than two wire diameters.` });
    } else if (segmentLengthM / wire.diameterM < 4) {
      issues.push({ severity: "warning", code: `segment-aspect-${wire.id}`, message: `${wire.id} segment length is below four wire diameters; verify convergence.` });
    }
    return { ...wire, tag: index + 1, segments, segmentLengthM };
  });
  const totalSegments = wires.reduce((sum, wire) => sum + wire.segments, 0);
  if (totalSegments > 3000) {
    issues.push({ severity: "error", code: "segment-budget", message: `The model requires ${totalSegments} segments, above the phased-array safety limit.` });
  }
  const first = wires.find((wire) => wire.family === "element-1");
  const second = wires.find((wire) => wire.family === "element-2");
  if (!first || !second) throw new RangeError("Both vertical elements are required.");
  const source = wires.find((wire) => wire.family === "source-junction");
  return {
    wires,
    totalSegments,
    feeds: [{ tag: first.tag, segment: 1 }, { tag: second.tag, segment: 1 }],
    sourceJunction: source ? { tag: source.tag, segment: 1 } : null,
    issues,
  };
}

export function absoluteSegmentNumber(segmentation: PhasedSegmentation, tag: number, localSegment: number): number {
  const index = segmentation.wires.findIndex((wire) => wire.tag === tag);
  if (index < 0) throw new RangeError(`Unknown NEC wire tag ${tag}.`);
  return segmentation.wires.slice(0, index).reduce((sum, wire) => sum + wire.segments, 0) + localSegment;
}

function groundCard(generated: GeneratedPhasedArray): string {
  return generated.model.ground.kind === "perfect"
    ? "GN 1 0 0 0 0 0"
    : `GN 2 0 0 0 ${fmt(generated.model.ground.relativePermittivity)} ${fmt(generated.model.ground.conductivitySPerM)}`;
}

function geometryCards(generated: GeneratedPhasedArray, segmentation: PhasedSegmentation): string[] {
  const lines = [
    "CM HF Antenna Studio two-element phased vertical array",
    "CM SI units; bearing is converted to NEC X/Y geometry",
    "CM Explicit EX sources are voltages; ideal-current mode uses calibrated voltages",
  ];
  if (generated.model.radials.representation !== "perfect-ground-image") {
    lines.push(`CM Radials: ${generated.model.radials.representation}; topology: ${generated.model.radials.topology}`);
  }
  lines.push("CE");
  for (const wire of segmentation.wires) {
    lines.push(`GW ${wire.tag} ${wire.segments} ${fmt(wire.startM.x)} ${fmt(wire.startM.y)} ${fmt(wire.startM.z)} ${fmt(wire.endM.x)} ${fmt(wire.endM.y)} ${fmt(wire.endM.z)} ${fmt(wire.diameterM / 2)}`);
  }
  lines.push(generated.model.radials.representation === "perfect-ground-image" ? "GE 1" : "GE -1", groundCard(generated), "PT 0 0 0 0");
  return lines;
}

function finishDeck(
  generated: GeneratedPhasedArray,
  segmentation: PhasedSegmentation,
  controlCards: string[],
  fullPattern: boolean,
): AdaptedPhasedNec {
  const issues = [...generated.issues, ...segmentation.issues];
  const errors = issues.filter((issue) => issue.severity === "error");
  if (errors.length > 0) throw new RangeError(errors.map((issue) => issue.message).join(" "));
  // Stop at theta 88 degrees (2 degrees elevation). The exact theta=90
  // grazing ray on a ground boundary is numerically ill-conditioned and can
  // displace an otherwise symmetric array peak in NEC-2.
  const patternCard = fullPattern ? "RP 0 45 180 1000 0 0 2 2" : "RP 0 1 1 1000 60 0 1 1";
  const lines = [
    ...geometryCards(generated, segmentation),
    ...controlCards,
    `FR 0 1 0 0 ${fmt(generated.model.frequencyHz / 1_000_000)} 0`,
    patternCard,
    "EN",
  ];
  if (lines.some((line) => line.startsWith("GW ") && line.length > 80)) {
    throw new RangeError("A generated GW card exceeds NEC's 80-column portability limit.");
  }
  const deck = applyConductorToDeck(`${lines.join("\n")}\n`, useUIStore.getState().conductor);
  const request: NecDeckRunRequest = {
    deck,
    parse: fullPattern
      ? { nTheta: 45, nPhi: 180, thetaStart: 0, thetaStep: 2, phiStart: 0, phiStep: 2, computeCurrents: true, totalSegments: segmentation.totalSegments }
      : { nTheta: 1, nPhi: 1, thetaStart: 60, thetaStep: 1, phiStart: 0, phiStep: 1, computeCurrents: true, totalSegments: segmentation.totalSegments },
  };
  return { deck, runRequest: request, segmentation, issues };
}

export function adaptIdealCalibrationToNec(generated: GeneratedPhasedArray, drivenElement: 1 | 2): AdaptedPhasedNec {
  const segmentation = segmentPhasedWires(generated);
  const feed = segmentation.feeds[drivenElement - 1]!;
  return finishDeck(generated, segmentation, [`EX 0 ${feed.tag} ${feed.segment} 0 1 0`], false);
}

export function adaptIdealFinalToNec(
  generated: GeneratedPhasedArray,
  sourceVoltages: [ComplexValue, ComplexValue],
): AdaptedPhasedNec {
  const segmentation = segmentPhasedWires(generated);
  const cards = segmentation.feeds.map((feed, index) => {
    const voltage = sourceVoltages[index]!;
    return `EX 0 ${feed.tag} ${feed.segment} 0 ${fmt(voltage.real)} ${fmt(voltage.imag)}`;
  });
  return finishDeck(generated, segmentation, cards, true);
}

function shuntAdmittance(resistanceOhm: number | null): number {
  return resistanceOhm === null ? 0 : 1 / resistanceOhm;
}

function safeTlLength(lengthM: number, lambdaM: number, issues: PhasedIssue[], line: 1 | 2): number {
  if (lengthM > 0) return lengthM;
  issues.push({
    severity: "warning",
    code: `zero-delay-line-${line}`,
    message: `Line ${line} has zero requested delay. NEC reserves TL length 0 for automatic geometric length, so the adapter uses a negligible 1e-8 wavelength length instead.`,
  });
  return lambdaM * 1e-8;
}

export function adaptPhysicalNetworkToNec(generated: GeneratedPhasedArray): AdaptedPhasedNec {
  const segmentation = segmentPhasedWires(generated);
  if (!segmentation.sourceJunction) throw new RangeError("Physical feed mode requires its explicit source-junction conductor.");
  const model = generated.model;
  const lambda = phasedWavelengthM(model.frequencyHz);
  const adapterIssues: PhasedIssue[] = [];
  const metrics1 = lineMetrics(model, 1);
  const metrics2 = lineMetrics(model, 2);
  const line1Length = safeTlLength(metrics1.necEquivalentLengthM, lambda, adapterIssues, 1);
  const line2Length = safeTlLength(metrics2.necEquivalentLengthM, lambda, adapterIssues, 2);
  const source = segmentation.sourceJunction;
  const [feed1, feed2] = segmentation.feeds;
  const z0 = fmt(model.physical.characteristicImpedanceOhm);
  const sourceY = fmt(shuntAdmittance(model.physical.sourceTerminationOhm));
  const port1Y = fmt(shuntAdmittance(model.physical.port1TerminationOhm));
  const port2Y = fmt(shuntAdmittance(model.physical.port2TerminationOhm));
  const lines = model.physical.topology === "parallel-junction"
    ? [
        `TL ${source.tag} ${source.segment} ${feed1.tag} ${feed1.segment} ${z0} ${fmt(line1Length)} ${sourceY} 0 ${port1Y} 0`,
        `TL ${source.tag} ${source.segment} ${feed2.tag} ${feed2.segment} ${z0} ${fmt(line2Length)} 0 0 ${port2Y} 0`,
      ]
    : [
        `TL ${source.tag} ${source.segment} ${feed1.tag} ${feed1.segment} ${z0} ${fmt(line1Length)} ${sourceY} 0 ${port1Y} 0`,
        `TL ${feed1.tag} ${feed1.segment} ${feed2.tag} ${feed2.segment} ${z0} ${fmt(line2Length)} 0 0 ${port2Y} 0`,
      ];
  const adaptedGenerated = { ...generated, issues: [...generated.issues, ...adapterIssues] };
  return finishDeck(adaptedGenerated, segmentation, [...lines, `EX 0 ${source.tag} ${source.segment} 0 1 0`], true);
}
