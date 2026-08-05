import type { SegmentCurrent } from "../../api/nec";

export function normalizePhaseDeg(phaseDeg: number): number {
  if (!Number.isFinite(phaseDeg)) return 0;
  return ((phaseDeg + 180) % 360 + 360) % 360 - 180;
}

export function phaseUnit(phaseDeg: number): number {
  return (normalizePhaseDeg(phaseDeg) + 180) / 360;
}

export function maximumCurrentMagnitude(currents: SegmentCurrent[]): number {
  return currents.reduce((maximum, current) => Number.isFinite(current.current_magnitude) ? Math.max(maximum, Math.max(0, current.current_magnitude)) : maximum, 0);
}

export function normalizedCurrentMagnitude(current: SegmentCurrent, maximum: number): number {
  if (!Number.isFinite(current.current_magnitude) || maximum <= 0) return 0;
  return Math.max(0, Math.min(1, current.current_magnitude / maximum));
}

/** Slowed visual phasor snapshot: Re{I exp(j omega t)} / max(|I|). */
export function instantaneousNormalizedCurrent(current: SegmentCurrent, maximum: number, cycle: number): number {
  if (maximum <= 0) return 0;
  const phaseRad = normalizePhaseDeg(current.current_phase_deg) * Math.PI / 180;
  return normalizedCurrentMagnitude(current, maximum) * Math.cos(2 * Math.PI * cycle + phaseRad);
}

export function formatCurrent(valueA: number): string {
  const absolute = Math.abs(valueA);
  if (absolute >= 1) return `${valueA.toFixed(4)} A`;
  if (absolute >= 0.001) return `${(valueA * 1_000).toFixed(3)} mA`;
  return `${(valueA * 1_000_000).toFixed(2)} µA`;
}
