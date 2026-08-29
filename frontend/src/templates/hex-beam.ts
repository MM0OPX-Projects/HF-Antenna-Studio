/**
 * Hex Beam antenna template.
 *
 * A single-band G3TXQ broadband Hexbeam using the published M-shaped
 * driven element and the reflector path around five frame sides.
 *
 * Geometry (top view):
 *
 *          /\   /\       ← classic M-shaped driven element
 *         /  \_/  \
 *        ·         ·      ← insulated driver/reflector tip gaps
 *         \       /
 *          \_____/        ← broadband reflector on frame perimeter
 *
 * The antenna is modelled as a two-element parasitic beam on a hexagonal
 * frame. Element width is along X and intended forward direction is +Y.
 * NEC2 coordinates: X=east, Y=north, Z=up.
 */

import type {
  AntennaTemplate,
  WireGeometry,
  Excitation,
  FeedpointData,
  FrequencyRange,
} from "./types";
import { autoSegment } from "../engine/segmentation";
import { MAX_FREQUENCY_MHZ, MIN_FREQUENCY_MHZ } from "../engine/limits";
import { buildG3txqBroadbandHexbeam, g3txqFeedGapM } from "../engine/g3txq-hexbeam";

const INCH_M = 0.0254;
const G3TXQ_REFERENCE_FREQUENCY_MHZ = 14.175;

export const hexBeamTemplate: AntennaTemplate = {
  id: "hex-beam",
  name: "G3TXQ Broadband Hexbeam",
  nameShort: "Hex",
  description:
    "Single-band G3TXQ broadband wire geometry on a hexagonal support frame.",
  longDescription:
    "This template implements Steve Hunt G3TXQ's broadband Hexbeam topology: a classic " +
    "M-shaped driven element and a separate reflector routed around five sides of a " +
    "regular hexagonal frame. Published bare-wire 20 m dimensions are wavelength-scaled " +
    "as starting values. It is a single-band NEC model, not a complete stacked multiband " +
    "construction, and its dimensions are not a guarantee of resonance or performance.",
  icon: "W",
  category: "directional",
  difficulty: "intermediate",
  bands: ["20m", "17m", "15m", "12m", "10m"],
  defaultGround: { type: "average" },
  tips: [
    "The driver is M-shaped; the broadband reflector follows five frame sides.",
    "Published dimensions are starting points and assume bare #14 or #16 copper wire.",
    "Element sag, insulation, hardware, mast and feed-line common mode are not modelled.",
    "A real multiband Hexbeam needs all band wire sets and their interaction modelled together.",
    "Inspect segmentation convergence before relying on feed impedance or rear-null depth.",
  ],
  relatedTemplates: ["moxon", "yagi", "quad"],

  parameters: [
    {
      key: "frequency",
      label: "Design Frequency",
      description: "Center frequency for the hex beam design",
      unit: "MHz",
      min: 5,
      max: MAX_FREQUENCY_MHZ,
      step: 0.1,
      defaultValue: 14.15,
      decimals: 3,
    },
    {
      key: "height",
      label: "Height",
      description: "Height above ground",
      unit: "m",
      min: 3,
      max: 50,
      step: 0.5,
      defaultValue: 12,
      decimals: 1,
    },
    {
      key: "wire_diameter",
      label: "Wire Diameter",
      description: "Conductor diameter",
      unit: "mm",
      min: 0.5,
      max: 10,
      step: 0.1,
      defaultValue: 2.0,
      decimals: 1,
    },
  ],

  generateGeometry(params: Record<string, number>): WireGeometry[] {
    const freq = params.frequency ?? 14.15;
    const height = params.height ?? 12;
    const wireDiamMm = params.wire_diameter ?? 2.0;

    const wavelength = 299.792458 / freq;
    const radius = wireDiamMm / 1000 / 2;
    const maxFreq = freq * 1.1;
    const scale = G3TXQ_REFERENCE_FREQUENCY_MHZ / freq;
    const geometry = buildG3txqBroadbandHexbeam({
      drivenHalfLengthM: 218 * INCH_M * scale,
      reflectorTotalLengthM: 412 * INCH_M * scale,
      endSpacingM: 24 * INCH_M * scale,
      feedGapM: g3txqFeedGapM(wavelength, wireDiamMm / 1000),
      heightM: height,
    });

    return geometry.sections.map((section, index) => {
      const lengthM = Math.hypot(section.endM.x - section.startM.x, section.endM.y - section.startM.y, section.endM.z - section.startM.z);
      return {
        tag: index + 1,
        segments: section.source ? 1 : autoSegment(lengthM, maxFreq, 7),
        x1: section.startM.x,
        y1: section.startM.y,
        z1: section.startM.z,
        x2: section.endM.x,
        y2: section.endM.y,
        z2: section.endM.z,
        radius,
      };
    });
  },

  generateExcitation(
    _params: Record<string, number>,
    wires: WireGeometry[]
  ): Excitation {
    const feedBridge = wires[0]!;
    return {
      wire_tag: feedBridge.tag,
      segment: 1,
      voltage_real: 1.0,
      voltage_imag: 0.0,
    };
  },

  generateFeedpoints(
    params: Record<string, number>,
    _wires: WireGeometry[]
  ): FeedpointData[] {
    const height = params.height ?? 12;
    return [{ position: [0, 0, height], wireTag: 1 }];
  },

  defaultFrequencyRange(params: Record<string, number>): FrequencyRange {
    const freq = params.frequency ?? 14.15;
    const bw = freq * 0.1;
    return {
      start_mhz: Math.max(MIN_FREQUENCY_MHZ, freq - bw / 2),
      stop_mhz: Math.min(MAX_FREQUENCY_MHZ, freq + bw / 2),
      steps: 31,
    };
  },
};
