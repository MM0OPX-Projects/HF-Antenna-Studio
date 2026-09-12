import type { ComparisonRunConfig, ComparisonResult } from "./types";

function radialDefinition(config: ComparisonRunConfig): string {
  const radial = config.conditions.radialSystems;
  return `Vertical ${radial.verticalMode}; phased ${radial.phasedMode}; length ${radial.radialLengthWavelengths}λ; diameter ${radial.radialDiameterM} m; clearance ${radial.nearSurfaceClearanceM} m; elevated height ${radial.elevatedHeightWavelengths}λ; droop ${radial.elevatedDroopAngleDeg}°; phased count ${radial.phasedRadialCount}`;
}

function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function value(value: number | null, digits: number, unit: string): string {
  return value === null || !Number.isFinite(value) ? "N/A" : `${value.toFixed(digits)} ${unit}`.trim();
}

function impedance(real: number, imag: number): string {
  return `${real.toFixed(2)} ${imag >= 0 ? "+" : "−"} j${Math.abs(imag).toFixed(2)} Ω`;
}

function polarPath(points: Array<{ angleDeg: number; normalizedDb: number }>, plane: "azimuth" | "elevation"): string {
  const samples = plane === "azimuth" ? points : [
    ...points.filter((point) => point.angleDeg >= 0 && point.angleDeg <= 90).sort((a, b) => a.angleDeg - b.angleDeg),
    ...points.filter((point) => point.angleDeg >= 0 && point.angleDeg <= 90).sort((a, b) => b.angleDeg - a.angleDeg).slice(1).map((point) => ({ ...point, angleDeg: 180 - point.angleDeg })),
  ];
  return samples.map((point, index) => {
    const angle = (plane === "azimuth" ? point.angleDeg - 90 : -point.angleDeg) * Math.PI / 180;
    const radius = Math.max(0, Math.min(1, (point.normalizedDb + 40) / 40)) * 120;
    return `${index ? "L" : "M"}${(150 + Math.cos(angle) * radius).toFixed(2)},${(145 + Math.sin(angle) * radius).toFixed(2)}`;
  }).join(" ") + (points.length > 2 ? " Z" : "");
}

function polarSvg(results: ComparisonResult[], plane: "azimuth" | "elevation"): string {
  const paths = results.map((result) => `<path d="${polarPath(plane === "azimuth" ? result.azimuthPattern : result.elevationPattern, plane)}" fill="none" stroke="${escapeHtml(result.color)}" stroke-width="2"/>`).join("");
  return `<svg viewBox="0 0 300 285" role="img" aria-label="${plane} radiation comparison relative to each trace peak"><rect width="300" height="285" fill="#fff"/><g fill="none" stroke="#ccd2da">${[30,60,90,120].map((radius) => `<circle cx="150" cy="145" r="${radius}"/>`).join("")}<line x1="30" y1="145" x2="270" y2="145"/><line x1="150" y1="25" x2="150" y2="265"/></g>${paths}<text x="150" y="18" text-anchor="middle" font-size="12">${plane === "azimuth" ? "Azimuth" : "Elevation"} · relative to each trace peak</text></svg>`;
}

function sweepSvg(results: ComparisonResult[]): string {
  const sweeps = results.flatMap((result) => result.sweep ? [{ result, sweep: result.sweep }] : []);
  if (sweeps.length === 0) return "<p>No single-port impedance sweeps are available for this comparison group.</p>";
  const points = sweeps.flatMap(({ sweep }) => sweep.points);
  const minX = Math.min(...points.map((point) => point.frequencyMhz)); const maxX = Math.max(...points.map((point) => point.frequencyMhz));
  const maxY = Math.max(2, Math.min(10, ...points.map((point) => Number.isFinite(point.swr) ? point.swr : 10)));
  const x = (frequency: number) => 48 + (frequency - minX) / Math.max(maxX - minX, 1e-12) * 500;
  const y = (swr: number) => 225 - (Math.min(swr, maxY) - 1) / Math.max(maxY - 1, 1e-12) * 190;
  const paths = sweeps.map(({ result, sweep }) => `<path d="${sweep.points.map((point, index) => `${index ? "L" : "M"}${x(point.frequencyMhz).toFixed(2)},${y(point.swr).toFixed(2)}`).join(" ")}" fill="none" stroke="${escapeHtml(result.color)}" stroke-width="2"/>`).join("");
  return `<svg viewBox="0 0 570 255" role="img" aria-label="SWR frequency sweep comparison"><rect width="570" height="255" fill="#fff"/><g stroke="#ccd2da"><line x1="48" y1="35" x2="48" y2="225"/><line x1="48" y1="225" x2="548" y2="225"/><line x1="48" y1="${y(2).toFixed(2)}" x2="548" y2="${y(2).toFixed(2)}" stroke-dasharray="4 3"/></g>${paths}<g font-size="11" fill="#172033"><text x="298" y="250" text-anchor="middle">Frequency (MHz)</text><text x="12" y="130" transform="rotate(-90 12 130)" text-anchor="middle">SWR (:1), clipped at 10</text><text x="48" y="242" text-anchor="middle">${minX.toFixed(3)}</text><text x="548" y="242" text-anchor="middle">${maxX.toFixed(3)}</text><text x="40" y="229" text-anchor="end">1</text><text x="40" y="${(y(2) + 4).toFixed(2)}" text-anchor="end">2</text></g></svg>`;
}

function resultCondition(result: ComparisonResult): string {
  const ground = result.conditions.ground.kind === "perfect" ? "perfect" : `S/N εr ${result.conditions.ground.relativePermittivity}, σ ${result.conditions.ground.conductivitySPerM} S/m`;
  const conditions = result.savedConditionMode === "saved" ? "saved model conditions" : `${result.conditions.frequencyMhz.toFixed(6)} MHz; ${ground}; Z₀ ${result.conditions.referenceImpedanceOhm} Ω`;
  const bearing = `${result.elevationBearingDeg.toFixed(1)}° ${result.elevationBearingMode === "strongest" ? "strongest" : "common"} bearing`;
  const port = result.impedanceMode === "balanced-differential"
    ? "; balanced junction feed · 1 differential port (raw impedance derived from two NEC rows)"
    : "";
  return `${conditions}; ${bearing}; sweep ${result.sweepConfig.startMhz.toFixed(3)}–${result.sweepConfig.stopMhz.toFixed(3)} MHz/${result.sweepConfig.points} points${port}`;
}

export function buildComparisonHtml(results: ComparisonResult[], runConfig: ComparisonRunConfig, warnings: string[], createdAt = new Date().toISOString()): string {
  if (results.length === 0) throw new Error("At least one solved model is required for an HTML comparison report.");
  const ground = runConfig.conditions.ground.kind === "perfect" ? "Infinite perfect ground" : `Sommerfeld/Norton, εr ${runConfig.conditions.ground.relativePermittivity}, σ ${runConfig.conditions.ground.conductivitySPerM} S/m`;
  const groups = new Map<string, ComparisonResult[]>();
  for (const result of results) groups.set(result.conditionKey, [...(groups.get(result.conditionKey) ?? []), result]);
  const overlayResults = [...groups.values()].sort((a, b) => b.length - a.length)[0]!;
  const rows = results.map((result) => `<tr><th>${escapeHtml(result.label)}</th><td>${escapeHtml(resultCondition(result))}</td><td>${result.elevationBearingDeg.toFixed(1)}° ${result.elevationBearingMode === "strongest" ? "strongest" : "common"}</td><td>${value(result.metrics.gainDbi, 2, "dBi")}</td><td>${value(result.metrics.takeOffAngleDeg, 1, "°")}</td><td>${value(result.metrics.frontToBackDb, 2, "dB")}</td><td>${value(result.metrics.beamwidthDeg, 1, "°")}</td><td>${value(result.metrics.resistanceOhm, 2, "Ω")}</td><td>${value(result.metrics.reactanceOhm, 2, "Ω")}</td><td>${value(result.metrics.swr, 2, ":1")}</td></tr>`).join("");
  const legends = overlayResults.map((result) => `<li><span style="background:${escapeHtml(result.color)}"></span>${escapeHtml(result.label)}</li>`).join("");
  const warningList = warnings.length ? `<section class="warning"><h2>Comparison warnings</h2><ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul></section>` : "";
  const sweepTables = results.map((result) => result.sweep ? `<details><summary>${escapeHtml(result.label)} frequency sweep</summary><table><thead><tr><th>MHz</th><th>R Ω</th><th>X Ω</th><th>SWR</th></tr></thead><tbody>${result.sweep.points.map((point) => `<tr><td>${point.frequencyMhz.toFixed(6)}</td><td>${point.resistanceOhms.toFixed(4)}</td><td>${point.reactanceOhms.toFixed(4)}</td><td>${Number.isFinite(point.swr) ? point.swr.toFixed(4) : "∞"}</td></tr>`).join("")}</tbody></table></details>` : `<p><strong>${escapeHtml(result.label)}:</strong> ${escapeHtml(result.sweepUnavailableReason ?? "No sweep available.")}</p>`).join("");
  const resultWarnings = results.map((result) => `<details><summary>${escapeHtml(result.label)} warnings (${result.warnings.length})</summary>${result.warnings.length ? `<ul>${result.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>` : "<p>No solver or model warnings reported.</p>"}${result.sweepUnavailableReason ? `<p>${escapeHtml(result.sweepUnavailableReason)}</p>` : ""}</details>`).join("");
  const decks = results.map((result) => `<details><summary>${escapeHtml(result.label)} generated NEC model</summary><pre>${escapeHtml(result.generatedNec)}</pre></details>`).join("");
  const balancedPortNotes = results.filter((result) => result.impedanceMode === "balanced-differential").map((result) => {
    const rows = result.inputImpedances?.map((row, index) => `NEC row ${index + 1}: ${impedance(row.real, row.imag)}`).join("; ") ?? "individual NEC rows unavailable";
    const raw = result.metrics.resistanceOhm === null || result.metrics.reactanceOhm === null ? "N/A" : impedance(result.metrics.resistanceOhm, result.metrics.reactanceOhm);
    return `<li><strong>${escapeHtml(result.label)}</strong> · raw balanced antenna impedance: ${escapeHtml(raw)} · ${escapeHtml(rows)} · no transformer is applied by Model Comparison (post-transform impedance/SWR must be read from the matching-aware analysis view).</li>`;
  }).join("");
  const balancedSection = balancedPortNotes ? `<section><h2>Balanced-port impedance evidence</h2><p>Each balanced junction is one differential port. The raw antenna value is derived from the two equal-and-opposite NEC source rows; it is kept separate from any optional balun/unun transformation.</p><ul>${balancedPortNotes}</ul></section>` : "";
  const overlayNote = overlayResults.length < results.length ? `<p class="warning">Radiation and sweep plots include the largest compatible condition group (${overlayResults.length} of ${results.length} models); differently conditioned results remain in the metric and evidence tables.</p>` : "";
  const bearingDescription = runConfig.conditions.elevationBearingMode === "strongest" ? "each model's strongest solved compass bearing; actual bearings are listed per model" : `${runConfig.conditions.elevationBearingDeg.toFixed(1)}° common compass bearing`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HF Antenna Studio model comparison</title><style>body{font:14px system-ui,sans-serif;color:#172033;background:#fff;margin:32px;line-height:1.45}h1{margin-bottom:4px}h2{margin-top:24px}small{color:#556070}.summary,table{width:100%;border-collapse:collapse;margin:16px 0}.summary th,.summary td,table th,table td{padding:7px;border-bottom:1px solid #d7dce3;text-align:right}.summary th:first-child,.summary td:first-child,table th:first-child,table td:first-child{text-align:left}.charts{display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:800px}.legend{display:flex;flex-wrap:wrap;gap:14px;list-style:none;padding:0}.legend span{display:inline-block;width:18px;height:3px;margin-right:6px;vertical-align:middle}.warning{border-left:4px solid #b7791f;padding:8px 14px;background:#fff8e6}pre{white-space:pre-wrap;font-size:11px;background:#f5f7fa;padding:12px}details{margin:9px 0}@media(max-width:650px){body{margin:16px}.charts{grid-template-columns:1fr}.summary{display:block;overflow-x:auto}}</style></head><body><header><h1>HF Antenna Studio model comparison</h1><small>Created ${escapeHtml(createdAt)} · report controls ${runConfig.conditions.frequencyMhz.toFixed(6)} MHz · ${escapeHtml(ground)} · Z₀ ${runConfig.conditions.referenceImpedanceOhm} Ω</small><p>Azimuth cut: ${runConfig.conditions.azimuthElevationDeg.toFixed(1)}° elevation. Elevation cut: ${escapeHtml(bearingDescription)}. Calculations are NEC model results, not measured performance.</p><p><strong>Radial definition:</strong> ${escapeHtml(radialDefinition(runConfig))}. Near-surface means raised NEC wire axes, not buried or exact soil contact.</p></header>${warningList}<h2>Metrics</h2><table class="summary"><thead><tr><th>Model</th><th>Solved conditions</th><th>Elevation bearing</th><th>Gain</th><th>Take-off</th><th>F/B</th><th>Beamwidth</th><th>Raw R</th><th>Raw X</th><th>Raw SWR</th></tr></thead><tbody>${rows}</tbody></table>${balancedSection}${overlayNote}<ul class="legend">${legends}</ul><div class="charts">${polarSvg(overlayResults, "azimuth")}${polarSvg(overlayResults, "elevation")}</div><h2>SWR sweep overlay</h2>${sweepSvg(overlayResults)}<h2>Frequency-sweep evidence</h2>${sweepTables}<h2>Warnings and unavailable quantities</h2>${resultWarnings}<h2>Exact generated NEC models</h2>${decks}</body></html>`;
}

export function exportComparisonHtml(results: ComparisonResult[], runConfig: ComparisonRunConfig, warnings: string[]): void {
  const blob = new Blob([buildComparisonHtml(results, runConfig, warnings)], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = "hf-antenna-studio-model-comparison.html"; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
