import type { HorizontalDipoleModel } from "./model";
import { adaptDipoleToNec } from "./nec-adapter";
import type { EditorModelTransfer } from "../model-transfer/types";
import { assessTransferDeckParity } from "../model-transfer/parity";
import { conductorLoad } from "../../engine/conductor";
import { useUIStore } from "../../stores/uiStore";

export function createVerifiedDipoleTransfer(model: HorizontalDipoleModel, transferredAt = new Date().toISOString()): EditorModelTransfer {
  const adapted = adaptDipoleToNec(model);
  const ground = model.ground.kind === "free-space"
    ? { type: "free_space" as const }
    : model.ground.kind === "perfect"
      ? { type: "perfect" as const }
      : { type: "custom" as const, custom_conductivity: model.ground.conductivitySPerM, custom_permittivity: model.ground.relativePermittivity };
  const frequencyMhz = model.frequencyHz / 1_000_000;
  const frequencyRange = { start_mhz: frequencyMhz, stop_mhz: frequencyMhz, steps: 1 };
  const wires = [{
    tag: adapted.model.wire.tag,
    segments: adapted.model.wire.segments,
    x1: adapted.model.wire.startM[0], y1: adapted.model.wire.startM[1], z1: adapted.model.wire.startM[2],
    x2: adapted.model.wire.endM[0], y2: adapted.model.wire.endM[1], z2: adapted.model.wire.endM[2],
    radius: adapted.model.wire.radiusM,
    selected: false,
    segmentsManual: true,
  }];
  const excitations = [{
    wire_tag: adapted.model.source.tag,
    segment: adapted.model.source.segment,
    voltage_real: adapted.model.source.voltage[0],
    voltage_imag: adapted.model.source.voltage[1],
    position_ratio: 0.5,
  }];
  const core = {
    wires,
    excitations,
    loads: [conductorLoad(useUIStore.getState().conductor)].filter((load) => load !== null),
    transmissionLines: [],
    ground,
    geometryGroundFlag: (model.ground.kind === "free-space" ? 0 : -1) as 0 | -1,
    frequencyRange,
    frequencySegments: [],
  };
  const parity = assessTransferDeckParity(adapted.deck, core);
  if (!parity.semanticMatch) throw new Error(`Verified dipole transfer parity failed. ${parity.summary}`);
  const losses = ["Verified Dipole sliders become ordinary editable wire coordinates after transfer; they do not remain linked to this free-form copy."];
  const warnings = [...adapted.warnings];
  return {
    schemaVersion: 1,
    title: "Verified centre-fed horizontal dipole",
    fidelity: "exact-editable",
    ...core,
    junctions: [],
    radialSystems: [],
    designFrequencyMhz: frequencyMhz,
    referenceImpedanceOhm: model.referenceImpedanceOhm,
    parity: { semanticMatch: parity.semanticMatch, summary: parity.summary, regeneratedCards: parity.regeneratedCards },
    provenance: {
      schemaVersion: 1,
      sourceModuleId: "verified-dipole",
      sourceModuleName: "Verified Dipole",
      sourceModelKind: model.kind,
      sourceModelSchemaVersion: model.schemaVersion,
      transferredAt,
      fidelity: "exact-editable",
      referenceImpedanceOhm: model.referenceImpedanceOhm,
      sourceParameters: structuredClone(model) as unknown as Record<string, unknown>,
      sourceNecDeck: adapted.deck,
      sourceModelFingerprint: parity.sourceFingerprint,
      editorModelFingerprint: parity.editorFingerprint,
      warnings,
      losses,
    },
  };
}
