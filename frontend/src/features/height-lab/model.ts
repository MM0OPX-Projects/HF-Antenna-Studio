import type { HorizontalDipoleModel } from "../verified-dipole/model";
import { megahertzToHertz, wavelengthMetres } from "../verified-dipole/units";
import type { GroundPresetId } from "./types";
import { useUIStore } from "../../stores/uiStore";

export interface HeightLabParameters {
  frequencyMhz: number;
  heightWavelengths: number;
  groundPreset: GroundPresetId;
  conductivitySPerM: number;
  relativePermittivity: number;
}

export function createHeightLabModel(parameters: HeightLabParameters): HorizontalDipoleModel {
  const frequencyHz = megahertzToHertz(parameters.frequencyMhz);
  const wavelengthM = wavelengthMetres(frequencyHz);
  return {
    schemaVersion: 1,
    kind: "center-fed-horizontal-dipole",
    frequencyHz,
    totalLengthM: wavelengthM * 0.5,
    wireDiameterM: 0.001,
    heightM: wavelengthM * parameters.heightWavelengths,
    ground: parameters.groundPreset === "perfect"
      ? { kind: "perfect" }
      : {
          kind: "real",
          conductivitySPerM: parameters.conductivitySPerM,
          relativePermittivity: parameters.relativePermittivity,
        },
    referenceImpedanceOhm: 50,
    orientation: "x",
  };
}

export function heightLabModelKey(model: HorizontalDipoleModel): string {
  return JSON.stringify({ model, conductor: useUIStore.getState().conductor });
}
