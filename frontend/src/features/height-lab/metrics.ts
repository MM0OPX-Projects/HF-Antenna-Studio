import type { NormalizedPatternPoint, VerifiedDipoleResult } from "../verified-dipole/result";

export function lowAngleGainDbi(result: VerifiedDipoleResult, limitDeg = 10): number | null {
  const candidates = result.elevationPattern.filter(
    (point) => point.angleDeg >= 0 && point.angleDeg <= limitDeg && Number.isFinite(point.gainDbi),
  );
  return candidates.length > 0 ? Math.max(...candidates.map((point) => point.gainDbi)) : null;
}

export function displayedGain(point: NormalizedPatternPoint, mode: "absolute" | "normalised"): number {
  return mode === "absolute" ? point.gainDbi : point.normalizedDb;
}

export function normaliseGainGrid(gainDbi: number[][]): number[][] {
  const finite = gainDbi.flat().filter((gain) => Number.isFinite(gain) && gain > -999);
  const maximum = finite.length > 0 ? Math.max(...finite) : 0;
  return gainDbi.map((row) => row.map((gain) => Number.isFinite(gain) && gain > -999
    ? Math.max(-40, gain - maximum)
    : -40));
}
