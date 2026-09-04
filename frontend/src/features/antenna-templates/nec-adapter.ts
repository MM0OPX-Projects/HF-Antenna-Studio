import type { NecDeckRunRequest } from "../../engine/wasm/worker";
import type { AntennaTemplateDefinition, TemplateAntennaModel, TemplateValidationIssue } from "./schema";
import { segmentTemplateModel, type TemplateSegmentation } from "./segmentation";
import { applyConductorToDeck } from "../../engine/conductor";
import { useUIStore } from "../../stores/uiStore";

export interface AdaptedTemplateNec {
  deck: string;
  runRequest: NecDeckRunRequest;
  segmentation: TemplateSegmentation;
  issues: TemplateValidationIssue[];
}

function fmt(value: number): string {
  if (!Number.isFinite(value)) throw new RangeError("NEC values must be finite.");
  return Number(value.toPrecision(10)).toString();
}

export function adaptTemplateToNec(model: TemplateAntennaModel, definition: AntennaTemplateDefinition): AdaptedTemplateNec {
  const segmentation = segmentTemplateModel(model, definition);
  if (segmentation.issues.some((issue) => issue.severity === "error")) throw new RangeError(segmentation.issues.filter((issue) => issue.severity === "error").map((issue) => issue.message).join(" "));
  const lines = [
    `CM HF Antenna Studio parametric template: ${model.name}`,
    "CM Generated dimensions are starting points, not resonance guarantees",
    "CE",
  ];
  model.wires.forEach((wire) => {
    const segmented = segmentation.wires.find((item) => item.wireId === wire.id)!;
    lines.push(`GW ${segmented.tag} ${segmented.segments} ${fmt(wire.startM.x)} ${fmt(wire.startM.y)} ${fmt(wire.startM.z)} ${fmt(wire.endM.x)} ${fmt(wire.endM.y)} ${fmt(wire.endM.z)} ${fmt(wire.diameterM / 2)}`);
  });
  lines.push(model.groundConnection === "touching" ? "GE 1" : "GE -1");
  if (model.ground.kind === "perfect") lines.push("GN 1 0 0 0 0 0");
  else lines.push(`GN 2 0 0 0 ${fmt(model.ground.relativePermittivity)} ${fmt(model.ground.conductivitySPerM)}`);
  for (const load of model.loads) {
    const segmented = segmentation.wires.find((item) => item.wireId === load.wireId);
    if (!segmented) throw new RangeError(`Load references missing wire ${load.wireId}.`);
    const segment = Math.max(1, Math.min(segmented.segments, Math.floor(load.position * segmented.segments) + 1));
    lines.push(`LD 0 ${segmented.tag} ${segment} ${segment} ${fmt(load.resistanceOhm)} ${fmt(load.inductanceH)} ${fmt(load.capacitanceF)}`);
  }
  lines.push(
    "PT 0 0 0 0",
    `EX 0 ${segmentation.feed.tag} ${segmentation.feed.segment} 0 ${fmt(model.feed.voltage.realV)} ${fmt(model.feed.voltage.imaginaryV)}`,
    `FR 0 1 0 0 ${fmt(model.frequencyHz / 1_000_000)} 0`,
    "RP 0 19 72 1000 0 0 5 5",
    "EN",
  );
  const deck = applyConductorToDeck(`${lines.join("\n")}\n`, useUIStore.getState().conductor);
  return {
    deck,
    segmentation,
    issues: segmentation.issues,
    runRequest: {
      deck,
      parse: { nTheta: 19, nPhi: 72, thetaStart: 0, thetaStep: 5, phiStart: 0, phiStep: 5, computeCurrents: true, totalSegments: segmentation.totalSegments },
    },
  };
}
