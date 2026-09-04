import type { HorizontalDipoleModel } from "./model";
import type { DipoleSegmentation } from "./segmentation";
import { assessDipoleModel } from "./validation";
import { hertzToMegahertz } from "./units";
import type { NecDeckRunRequest } from "../../engine/wasm/worker";
import { applyConductorToDeck } from "../../engine/conductor";
import { useUIStore } from "../../stores/uiStore";

export interface DipoleNecModel {
  wire: {
    tag: 1;
    segments: number;
    startM: readonly [number, number, number];
    endM: readonly [number, number, number];
    radiusM: number;
  };
  source: { tag: 1; segment: number; voltage: readonly [number, number] };
  frequencyMhz: number;
  ground: HorizontalDipoleModel["ground"];
  pattern: NecDeckRunRequest["parse"];
}

export interface AdaptedDipoleNec {
  model: DipoleNecModel;
  segmentation: DipoleSegmentation;
  deck: string;
  runRequest: NecDeckRunRequest;
  warnings: string[];
}

function fmt(value: number, digits = 9): string {
  if (!Number.isFinite(value)) throw new RangeError("NEC values must be finite.");
  return Number(value.toPrecision(digits)).toString();
}

export function serializeDipoleNec(nec: DipoleNecModel): string {
  const lines = [
    "CM HF Antenna Studio verified centre-fed horizontal dipole",
    "CM SI units; one continuous wire; source on the centre segment",
    "CE",
    `GW ${nec.wire.tag} ${nec.wire.segments} ${nec.wire.startM.map((v) => fmt(v)).join(" ")} ${nec.wire.endM.map((v) => fmt(v)).join(" ")} ${fmt(nec.wire.radiusM)}`,
    // GE 0 means no geometry ground plane. For this always-elevated wire,
    // GE -1 marks ground present without interpolating a touching segment to
    // its image (GE 1 behavior). GN below selects the electromagnetic ground.
    nec.ground.kind === "free-space" ? "GE 0" : "GE -1",
  ];

  if (nec.ground.kind === "free-space") {
    lines.push("GN -1");
  } else if (nec.ground.kind === "perfect") {
    lines.push("GN 1 0 0 0 0 0");
  } else {
    lines.push(
      `GN 2 0 0 0 ${fmt(nec.ground.relativePermittivity)} ${fmt(nec.ground.conductivitySPerM)}`,
    );
  }

  lines.push(
    "PT 0 0 0 0",
    `EX 0 ${nec.source.tag} ${nec.source.segment} 0 ${fmt(nec.source.voltage[0])} ${fmt(nec.source.voltage[1])}`,
    `FR 0 1 0 0 ${fmt(nec.frequencyMhz)} 0`,
    `RP 0 ${nec.pattern.nTheta} ${nec.pattern.nPhi} 1000 ${fmt(nec.pattern.thetaStart)} ${fmt(nec.pattern.phiStart)} ${fmt(nec.pattern.thetaStep)} ${fmt(nec.pattern.phiStep)}`,
    "EN",
  );

  return `${lines.join("\n")}\n`;
}

/** Map the independent domain model into an explicit NEC-2 representation. */
export function adaptDipoleToNec(model: HorizontalDipoleModel): AdaptedDipoleNec {
  const assessment = assessDipoleModel(model);
  if (!assessment.valid || !assessment.segmentation) {
    throw new RangeError(assessment.errors.join(" "));
  }

  const thetaStop = model.ground.kind === "free-space" ? 180 : 90;
  const thetaStep = 5;
  const phiStep = 5;
  const pattern: NecDeckRunRequest["parse"] = {
    nTheta: Math.floor(thetaStop / thetaStep) + 1,
    nPhi: Math.floor(360 / phiStep),
    thetaStart: 0,
    thetaStep,
    phiStart: 0,
    phiStep,
    computeCurrents: true,
    totalSegments: assessment.segmentation.segments,
  };
  const halfLengthM = model.totalLengthM / 2;
  const necModel: DipoleNecModel = {
    wire: {
      tag: 1,
      segments: assessment.segmentation.segments,
      startM: [-halfLengthM, 0, model.heightM],
      endM: [halfLengthM, 0, model.heightM],
      radiusM: model.wireDiameterM / 2,
    },
    source: {
      tag: 1,
      segment: assessment.segmentation.centreSegment,
      voltage: [1, 0],
    },
    frequencyMhz: hertzToMegahertz(model.frequencyHz),
    ground: model.ground,
    pattern,
  };
  const deck = applyConductorToDeck(serializeDipoleNec(necModel), useUIStore.getState().conductor);

  return {
    model: necModel,
    segmentation: assessment.segmentation,
    deck,
    runRequest: { deck, parse: pattern },
    warnings: assessment.warnings,
  };
}
