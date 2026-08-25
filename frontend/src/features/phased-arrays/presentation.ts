export function formatPhaseDegrees(phaseDeg: number, decimals = 1): string {
  const rounded = Number(phaseDeg.toFixed(decimals));
  return (Object.is(rounded, -0) ? 0 : rounded).toFixed(decimals);
}
