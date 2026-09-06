/**
 * Ground Plane Vertical antenna template.
 *
 * A quarter-wave vertical element with elevated radials.
 * Omnidirectional pattern in the horizontal plane.
 * NEC2 coordinates: X=east, Y=north, Z=up.
 */

import type { AntennaTemplate, WireGeometry, Excitation, FeedpointData, FrequencyRange } from "./types";
import { autoSegment } from "../engine/segmentation";
import { MAX_FREQUENCY_MHZ, MIN_FREQUENCY_MHZ } from "../engine/limits";

export const verticalTemplate: AntennaTemplate = {
  id: "vertical",
  name: "Ground Plane Vertical",
  nameShort: "Vertical",
  description: "Quarter-wave vertical with radials — omnidirectional, low-angle radiation.",
  longDescription:
    "A ground plane vertical consists of a quarter-wave vertical radiator with horizontal or " +
    "slightly drooping radial wires at its base. It produces an omnidirectional pattern in the " +
    "horizontal plane with peak radiation at low elevation angles — excellent for DX. " +
    "Feed impedance is approximately 36 ohms with horizontal radials (use a 4:1 or adjust radial droop). " +
    "With drooping radials at 45 degrees, impedance rises to ~50 ohms for direct coax feed.",
  icon: "⊥",
  category: "vertical",
  difficulty: "beginner",
  bands: ["40m", "20m", "15m", "10m", "6m", "2m"],
  defaultGround: { type: "average" },
  tips: [
    "4 radials is the minimum; more radials improve ground plane but with diminishing returns.",
    "Droop radials at 45 degrees to raise impedance toward 50 ohms.",
    "Elevated radials (not on ground) are more efficient than buried radials.",
    "Height of the radial junction above ground affects low-angle performance.",
    "For 20m band: vertical ~5.1m, radials ~5.1m each.",
  ],
  relatedTemplates: ["j-pole", "slim-jim", "efhw"],

  parameters: [
    {
      key: "frequency",
      label: "Design Frequency",
      description: "Center frequency for quarter-wave resonance",
      unit: "MHz",
      min: 1,
      max: MAX_FREQUENCY_MHZ,
      step: 0.1,
      defaultValue: 14.2,
      decimals: 3,
    },
    {
      key: "radial_count",
      label: "Radials",
      description: "Number of explicit radial wires (2-128)",
      unit: "",
      min: 2,
      max: 128,
      step: 1,
      defaultValue: 4,
      decimals: 0,
    },
    {
      key: "radial_mode",
      label: "Radial placement",
      description: "Choose elevated radials or the near-surface NEC approximation used by the Wire Editor.",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      defaultValue: 0,
      decimals: 0,
      options: [
        { value: 0, label: "Elevated radials" },
        { value: 1, label: "Near-surface radials" },
      ],
    },
    {
      key: "radial_length",
      label: "Radial Length",
      description: "Physical length of each radial wire.",
      unit: "m",
      min: 0.2,
      max: 100,
      step: 0.01,
      defaultValue: 5.0,
      decimals: 2,
    },
    {
      key: "radial_droop",
      label: "Radial Droop",
      description: "Droop angle below horizontal (0=flat, 45=drooping)",
      unit: "deg",
      min: 0,
      max: 60,
      step: 5,
      defaultValue: 0,
      decimals: 0,
      visibleWhen: (values) => (values.radial_mode ?? 0) === 0,
    },
    {
      key: "radial_clearance",
      label: "Near-surface clearance",
      description: "Wire-axis clearance above soil; NEC cannot represent buried or exactly-on-ground wires.",
      unit: "m",
      min: 0.001,
      max: 0.1,
      step: 0.001,
      defaultValue: 0.01,
      decimals: 3,
      visibleWhen: (values) => (values.radial_mode ?? 0) === 1,
    },
    {
      key: "radial_rotation",
      label: "Radial rotation",
      description: "Compass rotation applied to the radial field.",
      unit: "deg",
      min: 0,
      max: 360,
      step: 1,
      defaultValue: 0,
      decimals: 0,
    },
    {
      key: "base_height",
      label: "Base Height",
      description: "Height of the radial junction above ground",
      unit: "m",
      min: 0.3,
      max: 30,
      step: 0.1,
      defaultValue: 0.5,
      decimals: 1,
    },
    {
      key: "wire_diameter",
      label: "Wire Diameter",
      description: "Conductor diameter",
      unit: "mm",
      min: 0.5,
      max: 25,
      step: 0.5,
      defaultValue: 1.0,
      decimals: 1,
    },
  ],

  generateGeometry(params: Record<string, number>): WireGeometry[] {
    const freq = params.frequency ?? 14.2;
    const radialCount = Math.round(params.radial_count ?? 4);
    const radialMode = Math.round(params.radial_mode ?? 0);
    const radialDroopDeg = params.radial_droop ?? 0;
    const baseHeight = params.base_height ?? 0.5;
    const radialClearance = Math.max(0.001, params.radial_clearance ?? 0.01);
    const radialRotationDeg = params.radial_rotation ?? 0;
    const wireDiamMm = params.wire_diameter ?? 1.0;

    const wavelength = 300.0 / freq;
    const quarterWave = (wavelength / 4) * 0.95; // 5% shortening
    const radialLength = params.radial_length ?? quarterWave;
    const junctionHeight = radialMode === 1 ? radialClearance : baseHeight;
    const radius = (wireDiamMm / 1000) / 2;

    const maxFreq = freq * 1.15;
    const verticalSegs = autoSegment(quarterWave, maxFreq, 11);
    const radialSegs = autoSegment(radialLength, maxFreq, 7);

    const wires: WireGeometry[] = [];

    // Vertical element (tag 1)
    wires.push({
      tag: 1,
      segments: verticalSegs,
      x1: 0,
      y1: 0,
      z1: junctionHeight,
      x2: 0,
      y2: 0,
      z2: junctionHeight + quarterWave,
      radius,
    });

    // Radials (tags 2, 3, 4, ...)
    const droopRad = (radialMode === 1 ? 0 : radialDroopDeg) * Math.PI / 180;
    const radialHorizLength = radialLength * Math.cos(droopRad);
    const radialVertDrop = radialLength * Math.sin(droopRad);
    const rotationRad = radialRotationDeg * Math.PI / 180;

    for (let i = 0; i < radialCount; i++) {
      const angle = rotationRad + (2 * Math.PI * i) / radialCount;
      const endX = radialHorizLength * Math.cos(angle);
      const endY = radialHorizLength * Math.sin(angle);
      const endZ = junctionHeight - radialVertDrop;

      wires.push({
        tag: i + 2,
        segments: radialSegs,
        x1: 0,
        y1: 0,
        z1: junctionHeight,
        x2: endX,
        y2: endY,
        z2: endZ,
        radius,
      });
    }

    return wires;
  },

  generateExcitation(
    _params: Record<string, number>,
    _wires: WireGeometry[]
  ): Excitation {
    // Feed at the base of the vertical element (segment 1)
    return {
      wire_tag: 1,
      segment: 1,
      voltage_real: 1.0,
      voltage_imag: 0.0,
    };
  },

  generateFeedpoints(
    params: Record<string, number>,
    _wires: WireGeometry[]
  ): FeedpointData[] {
    const radialMode = Math.round(params.radial_mode ?? 0);
    const baseHeight = radialMode === 1 ? Math.max(0.001, params.radial_clearance ?? 0.01) : (params.base_height ?? 0.5);
    return [{ position: [0, 0, baseHeight], wireTag: 1 }];
  },

  defaultFrequencyRange(params: Record<string, number>): FrequencyRange {
    const freq = params.frequency ?? 14.2;
    const bw = freq * 0.15; // verticals tend to have broader bandwidth response
    return {
      start_mhz: Math.max(MIN_FREQUENCY_MHZ, freq - bw / 2),
      stop_mhz: Math.min(MAX_FREQUENCY_MHZ, freq + bw / 2),
      steps: 31,
    };
  },
};
