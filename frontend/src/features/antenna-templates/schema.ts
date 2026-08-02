/** Solver-independent, SI-only schema produced by every parametric template. */

export type TemplateId =
  | "horizontal-dipole"
  | "inverted-v"
  | "sloper"
  | "quarter-wave-vertical"
  | "ground-plane-vertical"
  | "full-wave-loop"
  | "delta-loop"
  | "square-loop";

export interface Point3M { x: number; y: number; z: number }

export interface TemplateWire {
  id: string;
  startM: Point3M;
  endM: Point3M;
  diameterM: number;
}

export interface TemplateFeed {
  wireId: string;
  /** Fraction along the wire from start (0) to end (1). */
  position: number;
  voltage: { realV: number; imaginaryV: number };
}

export type TemplateLoad = {
  kind: "series-rlc";
  wireId: string;
  position: number;
  resistanceOhm: number;
  inductanceH: number;
  capacitanceF: number;
};

export type TemplateGround =
  | { kind: "perfect" }
  | { kind: "real"; conductivitySPerM: number; relativePermittivity: number };

export interface TemplateAntennaModel {
  schemaVersion: 1;
  kind: "parametric-wire-antenna";
  template: { id: TemplateId; version: 1 };
  name: string;
  frequencyHz: number;
  parametersSI: Readonly<Record<string, number>>;
  wires: TemplateWire[];
  feed: TemplateFeed;
  loads: TemplateLoad[];
  ground: TemplateGround;
  groundConnection: "none" | "touching";
  referenceImpedanceOhm: 50;
  provenance: {
    dimensionsAreStartingPoints: true;
    manualDimensions: boolean;
  };
}

export type ParameterQuantity = "frequency" | "length" | "diameter" | "angle" | "integer";
export type ParameterDisplayUnit = "MHz" | "m" | "ft" | "mm" | "in" | "deg" | "count";

export interface TemplateParameterDefinition {
  key: string;
  label: string;
  description: string;
  quantity: ParameterQuantity;
  internalUnit: "Hz" | "m" | "rad" | "count";
  metricUnit: ParameterDisplayUnit;
  imperialUnit: ParameterDisplayUnit;
  minSI: number;
  maxSI: number;
  stepSI: number;
  defaultSI: number;
  decimals: number;
  slider: true;
  /** Editing this parameter switches the workbench to manual-dimension mode. */
  dimensional: boolean;
}

export interface AmateurBandPreset {
  id: string;
  label: string;
  frequencyHz: number;
}

export type TemplateGroundRequirement = "required" | "recommended";

export interface TemplateSegmentationRecommendation {
  maximumSegmentLengthWavelengths: number;
  minimumSegmentsPerWire: number;
  maximumSegmentsPerWire: number;
  rationale: string;
}

export interface TemplateValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
}

export interface AntennaTemplateDefinition {
  id: TemplateId;
  version: 1;
  name: string;
  shortDescription: string;
  rfNotes: string[];
  parameters: TemplateParameterDefinition[];
  presets: AmateurBandPreset[];
  defaultBandId: string;
  groundRequirement: TemplateGroundRequirement;
  defaultGround?: TemplateGround;
  /** Declares the exceptional NEC geometry-ground contact case. */
  groundConnection?: "touching";
  segmentation: TemplateSegmentationRecommendation;
  startingParameters: (frequencyHz: number) => Record<string, number>;
  geometryGenerator: (parametersSI: Readonly<Record<string, number>>) => TemplateWire[];
  feedPoint: (parametersSI: Readonly<Record<string, number>>, wires: TemplateWire[]) => TemplateFeed;
  loads: (parametersSI: Readonly<Record<string, number>>, wires: TemplateWire[]) => TemplateLoad[];
  validationRules: Array<(model: TemplateAntennaModel) => TemplateValidationIssue[]>;
}

export interface GeneratedTemplateModel {
  model: TemplateAntennaModel;
  issues: TemplateValidationIssue[];
}
