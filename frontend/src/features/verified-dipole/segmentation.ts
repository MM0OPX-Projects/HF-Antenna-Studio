import type { HorizontalDipoleModel } from "./model";
import { wavelengthMetres } from "./units";

export interface DipoleSegmentation {
  segments: number;
  centreSegment: number;
  segmentLengthM: number;
  segmentLengthWavelengths: number;
  segmentLengthToRadius: number;
  warnings: string[];
}

const TARGET_SEGMENT_WAVELENGTHS = 0.025;
const MAX_SEGMENTS = 199;

function toOdd(value: number): number {
  return value % 2 === 0 ? value + 1 : value;
}

function greatestOddAtMost(value: number): number {
  const integer = Math.floor(value);
  return integer % 2 === 0 ? integer - 1 : integer;
}

/**
 * Choose a conservative odd segment count while preserving NEC's thin-wire
 * geometry constraints. Throws when no safe automatic choice exists.
 */
export function segmentDipole(model: HorizontalDipoleModel): DipoleSegmentation {
  if (!Number.isFinite(model.totalLengthM) || model.totalLengthM <= 0) {
    throw new RangeError("Dipole length must be a positive finite value.");
  }
  if (!Number.isFinite(model.wireDiameterM) || model.wireDiameterM <= 0) {
    throw new RangeError("Wire diameter must be a positive finite value.");
  }
  const wavelengthM = wavelengthMetres(model.frequencyHz);
  const radiusM = model.wireDiameterM / 2;
  const desired = Math.max(
    3,
    toOdd(Math.ceil(model.totalLengthM / (TARGET_SEGMENT_WAVELENGTHS * wavelengthM))),
  );

  // NEC guidance calls for Delta/a >= about 2 unless the extended kernel is
  // deliberately selected. This adapter uses the ordinary thin-wire kernel.
  const maxByRadius = greatestOddAtMost(model.totalLengthM / (2 * radiusM));
  if (maxByRadius < 3) {
    throw new RangeError(
      "The wire is too thick relative to its length to create three safe NEC segments.",
    );
  }

  const segments = Math.min(desired, MAX_SEGMENTS, maxByRadius);
  const segmentLengthM = model.totalLengthM / segments;
  const segmentLengthWavelengths = segmentLengthM / wavelengthM;
  const segmentLengthToRadius = segmentLengthM / radiusM;
  const warnings: string[] = [];

  if (desired > MAX_SEGMENTS) {
    warnings.push(
      `Automatic segmentation was capped at ${MAX_SEGMENTS} segments for browser performance.`,
    );
  }
  if (desired > maxByRadius) {
    warnings.push(
      "The segment count was reduced to keep segment length at least twice the wire radius.",
    );
  }
  if (segmentLengthWavelengths >= 0.1) {
    throw new RangeError(
      "No safe automatic segmentation is possible: segment length would be 0.1 wavelength or longer.",
    );
  }
  if (segmentLengthWavelengths > 0.05) {
    warnings.push(
      "Segment length exceeds 0.05 wavelength; convergence testing is recommended.",
    );
  }
  if (segmentLengthWavelengths < 0.001) {
    throw new RangeError(
      "Automatic segments would be shorter than 0.001 wavelength, where NEC numerical accuracy can degrade.",
    );
  }
  if (segmentLengthToRadius < 2) {
    throw new RangeError(
      "Segment length is less than twice the wire radius; the ordinary NEC thin-wire kernel is unsuitable.",
    );
  }

  return {
    segments,
    centreSegment: (segments + 1) / 2,
    segmentLengthM,
    segmentLengthWavelengths,
    segmentLengthToRadius,
    warnings,
  };
}
