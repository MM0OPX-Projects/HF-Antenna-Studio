/**
 * Main Simulator page — the core UI of AntennaSim.
 *
 * Desktop layout:
 *   [Left Panel: Template + Params] [3D Viewport] [Right Panel: Results]
 *
 * Mobile layout:
 *   [3D Viewport (45%)] [Bottom Sheet: Antenna | Results tabs]
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAntennaStore } from "../stores/antennaStore";
import { useSimulationStore } from "../stores/simulationStore";
import { useUIStore } from "../stores/uiStore";
import { SceneRoot } from "../components/three/SceneRoot";
import { resolveTransmissionLines } from "../components/three/transmissionLineViz";
import { ErrorBoundary } from "../components/common/ErrorBoundary";
import { KeyboardShortcutsPanel } from "../components/common/KeyboardShortcutsPanel";
import { ViewToggleToolbar } from "../components/three/ViewToggleToolbar";
import { WireMeasurementTool } from "../components/three/WireMeasurementTool";
import { useWireMeasurement } from "../components/three/useWireMeasurement";
import { Navbar } from "../components/layout/Navbar";
import { StatusBar } from "../components/layout/StatusBar";
import { TemplatePicker } from "../components/editors/TemplatePicker";
import { ParameterPanel } from "../components/editors/ParameterPanel";
import { GroundEditor } from "../components/editors/GroundEditor";
import { BalunEditor } from "../components/editors/BalunEditor";
import { WireEditorPromo } from "../components/editors/WireEditorPromo";
import { Button } from "../components/ui/Button";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { ColorScale } from "../components/ui/ColorScale";
import { SimulationLoadingOverlay } from "../components/ui/SimulationLoadingOverlay";
import { BandPresets } from "../components/ui/BandPresets";
import { FrequencySegmentEditor } from "../components/ui/FrequencySegmentEditor";
import { ProjectActions } from "../components/ui/ProjectActions";
import { ValidationWarnings } from "../components/ui/ValidationWarnings";
import { ResultsPanel } from "../components/results/ResultsTabs";
import { PatternFrequencySlider } from "../components/results/PatternFrequencySlider";
import { createSimulatorProject } from "../utils/project-file";
import { validateSimulationRequest } from "../engine/validation";
import { getTemplate, templateMap } from "../templates";
import type { ProjectFile } from "../utils/project-file";
import type { AntennaTemplate, FrequencyRange } from "../templates/types";
import { bandToSegment, hasBandSegment, removeBandSegment } from "../utils/ham-bands";
import type { HamBand } from "../utils/ham-bands";
import type { ViewToggles } from "../components/three/types";
import { PanelResizeHandle } from "../components/workspace/PanelResizeHandle";
import { InspectorSection } from "../components/workspace/InspectorSection";
import { EngineeringSummaryPanel, CalculationStatus } from "../components/workspace/EngineeringSummaryPanel";
import { HelpTip } from "../components/workspace/HelpTip";

/** Mobile bottom sheet tabs */
const MOBILE_SEGMENTS = [
  { key: "antenna", label: "Antenna" },
  { key: "results", label: "Results" },
];

export function SimulatorPage() {
  // Antenna store
  const template = useAntennaStore((s) => s.template);
  const params = useAntennaStore((s) => s.params);
  const ground = useAntennaStore((s) => s.ground);
  const wireData = useAntennaStore((s) => s.wireData);
  const feedpoints = useAntennaStore((s) => s.feedpoints);
  const wireGeometry = useAntennaStore((s) => s.wireGeometry);
  const excitations = useAntennaStore((s) => s.excitations);
  const loads = useAntennaStore((s) => s.loads);
  const transmissionLines = useAntennaStore((s) => s.transmissionLines);
  const frequencyRange = useAntennaStore((s) => s.frequencyRange);
  const frequencySegments = useAntennaStore((s) => s.frequencySegments);
  const setTemplate = useAntennaStore((s) => s.setTemplate);
  const setParam = useAntennaStore((s) => s.setParam);
  const setGround = useAntennaStore((s) => s.setGround);
  const setFrequencyRange = useAntennaStore((s) => s.setFrequencyRange);
  const setFrequencySegments = useAntennaStore((s) => s.setFrequencySegments);

  // Simulation store
  const simStatus = useSimulationStore((s) => s.status);
  const simError = useSimulationStore((s) => s.error);
  const result = useSimulationStore((s) => s.result);
  const simulateAdvanced = useSimulationStore((s) => s.simulateAdvanced);
  const resetSimulation = useSimulationStore((s) => s.reset);
  const selectedFreqResult = useSimulationStore((s) =>
    s.getSelectedFrequencyResult()
  );

  // UI store
  const viewToggles = useUIStore((s) => s.viewToggles);
  const toggleView = useUIStore((s) => s.toggleView);
  const setViewToggle = useUIStore((s) => s.setViewToggle);
  const mobileTab = useUIStore((s) => s.mobileTab);
  const setMobileTab = useUIStore((s) => s.setMobileTab);
  const matching = useUIStore((s) => s.matching);
  const setMatching = useUIStore((s) => s.setMatching);
  const {
    active: measurementActive,
    selectedTags: measurementSelectedTags,
    pointMode: measurementPointMode,
    toggle: toggleWireMeasurement,
    selectWire: selectMeasurementWire,
    setPointMode: setMeasurementPointMode,
    clear: clearWireMeasurement,
  } = useWireMeasurement();

  // Clear stale results on page entry (prevents cross-page state leaks)
  // and whenever antenna geometry or ground changes.
  useEffect(() => {
    resetSimulation();
  }, [wireGeometry, ground, resetSimulation]);

  // Handlers
  const handleTemplateSelect = useCallback(
    (t: AntennaTemplate) => {
      setTemplate(t);
      setMatching(t.defaultMatching ?? { type: "none", ratio: 1, feedlineZ0: 50 });
    },
    [setTemplate, setMatching]
  );

  const handleToggle = useCallback(
    (key: keyof ViewToggles) => toggleView(key),
    [toggleView]
  );

  const handleMeasurementToggle = useCallback(() => {
    if (!measurementActive) setViewToggle("wires", true);
    toggleWireMeasurement();
  }, [measurementActive, setViewToggle, toggleWireMeasurement]);

  // Pattern resolution
  const [patternStep, setPatternStep] = useState(5);

  const handleRunSimulation = useCallback(() => {
    simulateAdvanced({
      wires: wireGeometry,
      excitations,
      ground,
      frequency: frequencyRange,
      frequencySegments: frequencySegments.length ? frequencySegments : undefined,
      loads: loads.length ? loads : undefined,
      transmission_lines: transmissionLines.length ? transmissionLines : undefined,
      pattern_step: patternStep,
    });
  }, [simulateAdvanced, wireGeometry, excitations, loads, transmissionLines, ground, frequencyRange, patternStep, frequencySegments]);

  const handleBandSelect = useCallback(
    (range: FrequencyRange, _band: HamBand) => {
      // Single-select fallback — clear segments and set single range
      setFrequencySegments([]);
      setFrequencyRange(range);
      // Also update the template's frequency param if it has one, using band center
      const center = (range.start_mhz + range.stop_mhz) / 2;
      const freqParam = template.parameters.find(
        (p) => p.key === "frequency" || p.key === "freq"
      );
      if (freqParam) {
        setParam(freqParam.key, Math.round(center * 1000) / 1000);
      }
    },
    [setFrequencySegments, setFrequencyRange, setParam, template.parameters]
  );

  const handleToggleBand = useCallback(
    (band: HamBand) => {
      if (hasBandSegment(frequencySegments, band)) {
        const updated = removeBandSegment(frequencySegments, band);
        setFrequencySegments(updated);
      } else {
        setFrequencySegments(
          [...frequencySegments, bandToSegment(band)].sort(
            (a, b) => a.start_mhz - b.start_mhz
          )
        );
      }
    },
    [frequencySegments, setFrequencySegments]
  );

  const handleProjectSave = useCallback((): ProjectFile => {
    return createSimulatorProject(
      template.id,
      params,
      ground,
      result ?? null,
      frequencyRange,
      frequencySegments,
    );
  }, [template.id, params, ground, result, frequencyRange, frequencySegments]);

  const handleProjectLoad = useCallback(
    (project: ProjectFile) => {
      if (project.mode !== "simulator" || !project.simulator) {
        alert("This project was saved from the Wire Editor. Open it there instead.");
        return;
      }
      const { templateId, params: savedParams, ground: savedGround } = project.simulator;
      if (!templateMap.has(templateId)) {
        alert(`Unknown template "${templateId}". It may have been removed in a newer version.`);
        return;
      }
      const t = getTemplate(templateId);
      setTemplate(t);
      // setTemplate resets params to defaults — override with saved values
      // Use a microtask to let setTemplate's state settle first
      queueMicrotask(() => {
        const store = useAntennaStore.getState();
        const merged = { ...store.params, ...savedParams };
        useAntennaStore.getState().setParams(merged);
        useAntennaStore.getState().setGround(savedGround);
        if (project.simulator?.frequencyRange) {
          useAntennaStore.getState().setFrequencyRange(project.simulator.frequencyRange);
        }
        useAntennaStore.getState().setFrequencySegments(project.simulator?.frequencySegments ?? []);
      });
    },
    [setTemplate]
  );

  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [leftWidth, setLeftWidth] = useState(310);
  const [rightWidth, setRightWidth] = useState(292);
  const [analysisHeight, setAnalysisHeight] = useState(220);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [analysisCollapsed, setAnalysisCollapsed] = useState(false);
  const [desktopWorkbench, setDesktopWorkbench] = useState(
    () => window.matchMedia?.("(min-width: 1280px)").matches ?? false,
  );

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1280px)");
    const updateLayout = (event: MediaQueryListEvent) => setDesktopWorkbench(event.matches);
    query.addEventListener("change", updateLayout);
    return () => query.removeEventListener("change", updateLayout);
  }, []);

  useEffect(() => {
    const handleWorkspaceKey = (event: KeyboardEvent) => {
      const target = event.target;
      const editing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        handleRunSimulation();
        return;
      }
      if (editing) return;
      if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen(true);
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey) {
        if (event.key.toLowerCase() === "l") {
          event.preventDefault();
          setLeftCollapsed((value) => !value);
        }
        if (event.key.toLowerCase() === "r") {
          event.preventDefault();
          setRightCollapsed((value) => !value);
        }
        if (event.key.toLowerCase() === "b") {
          event.preventDefault();
          setAnalysisCollapsed((value) => !value);
        }
      }
    };
    window.addEventListener("keydown", handleWorkspaceKey);
    return () => window.removeEventListener("keydown", handleWorkspaceKey);
  }, [handleRunSimulation]);

  const isLoading = simStatus === "loading";

  // Pre-simulation validation
  const validation = useMemo(
    () => validateSimulationRequest(wireGeometry, excitations, ground, frequencyRange),
    [wireGeometry, excitations, ground, frequencyRange]
  );

  // Transmission-line feeders drawn as dashed lines in the 3D viewport.
  const feederLines = useMemo(
    () => resolveTransmissionLines(transmissionLines, wireGeometry),
    [transmissionLines, wireGeometry]
  );

  // Pattern data for 3D viewport
  const patternData = selectedFreqResult?.pattern ?? null;
  const currents = selectedFreqResult?.currents ?? null;
  const nearField = result?.near_field ?? null;

  return (
    <div className="flex flex-col h-dvh bg-background">
      <Navbar />

      {/* Desktop Windows workbench: resizable input, viewport, summary and analysis regions. */}
      {desktopWorkbench && <div className="flex min-h-0 flex-1 overflow-hidden" data-testid="professional-workbench">
        {leftCollapsed ? (
          <aside className="flex w-9 shrink-0 flex-col items-center border-r border-border bg-surface py-3" aria-label="Inputs panel collapsed">
            <button type="button" className="rounded-md p-2 text-text-secondary hover:bg-surface-hover hover:text-accent" onClick={() => setLeftCollapsed(false)} title="Show antenna inputs (Ctrl+Shift+L)" aria-label="Show antenna inputs">›</button>
            <span className="mt-3 [writing-mode:vertical-rl] text-[9px] font-semibold uppercase tracking-[0.18em] text-text-secondary">Inputs</span>
          </aside>
        ) : (
          <aside className="flex shrink-0 flex-col overflow-hidden border-r border-border bg-surface" style={{ width: leftWidth }} aria-label="Antenna and project inputs" data-testid="workbench-inputs">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div><p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-accent">Model inputs</p><h2 className="text-sm font-semibold">Antenna setup</h2></div>
              <button type="button" className="rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary" onClick={() => setLeftCollapsed(true)} title="Collapse inputs (Ctrl+Shift+L)" aria-label="Collapse antenna inputs">‹</button>
            </div>
            <div className="border-b border-border px-4 py-3"><ProjectActions onSave={handleProjectSave} onLoad={handleProjectLoad} /></div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <InspectorSection title="Antenna model" eyebrow="01 · Geometry" help="Choose a parametric antenna and edit its physical dimensions. Geometry updates immediately; NEC results do not update until calculation.">
                <WireEditorPromo />
                <TemplatePicker selectedId={template.id} onSelect={handleTemplateSelect} />
                <ParameterPanel parameters={template.parameters} values={params} onParamChange={setParam} />
              </InspectorSection>
              <InspectorSection title="Environment and feed" eyebrow="02 · Installation" help="Ground and matching choices are model or feed-system inputs, not calculated values." defaultOpen={false}>
                <GroundEditor ground={ground} onChange={setGround} />
                <div className="border-t border-border" />
                <BalunEditor matching={matching} onChange={setMatching} />
              </InspectorSection>
              <InspectorSection title="Frequency study" eyebrow="03 · Solver request" help="Define the frequencies and angular resolution requested from NEC. Every editable number is shown with its engineering unit.">
                <BandPresets currentRange={frequencyRange} onSelectBand={handleBandSelect} segments={frequencySegments} onToggleBand={handleToggleBand} hfOnly />
                <div className="border-t border-border" />
                <FrequencySegmentEditor frequencyRange={frequencyRange} onFrequencyRangeChange={setFrequencyRange} segments={frequencySegments} onSegmentsChange={setFrequencySegments} />
                <label className="block space-y-1 text-xs text-text-secondary">
                  <span className="font-medium uppercase tracking-wider">Pattern resolution</span>
                  <select aria-label="Radiation pattern angular resolution" value={patternStep} onChange={(event) => setPatternStep(parseInt(event.target.value, 10))} className="w-full rounded-md border border-border bg-background px-2 py-2 font-mono text-xs text-text-primary">
                    <option value="1">1° angular step · very fine</option><option value="2">2° angular step · fine</option><option value="5">5° angular step · standard</option><option value="10">10° angular step · fast</option>
                  </select>
                </label>
                {patternStep <= 2 && <p className="rounded-md border border-swr-warning/30 bg-swr-warning/5 p-2 text-[10px] leading-4"><strong className="text-swr-warning">Longer calculation:</strong> fine angular resolution substantially increases NEC output size and run time.</p>}
              </InspectorSection>
              {template.tips.length > 0 && <InspectorSection title="Context help" eyebrow="Model guidance" help="Educational guidance is separate from solver output and does not replace a validity review." defaultOpen={false}><ul className="space-y-2">{template.tips.slice(0, 4).map((tip, index) => <li key={index} className="border-l-2 border-accent/40 pl-3 text-xs leading-5 text-text-secondary">{tip}</li>)}</ul></InspectorSection>}
            </div>
            <div className="space-y-2 border-t border-border bg-surface-elevated p-3">
              <ValidationWarnings validation={validation} />
              <Button onClick={handleRunSimulation} loading={isLoading} disabled={isLoading || !validation.valid} className="w-full" size="md">{isLoading ? "Calculating with NEC-2…" : "Run Simulation"}</Button>
              <p className="text-center text-[10px] text-text-secondary">Ctrl+Enter · results clear when inputs change</p>
              {simError && <p role="alert" className="text-xs text-swr-bad">{simError}</p>}
            </div>
          </aside>
        )}

        {!leftCollapsed && <PanelResizeHandle orientation="horizontal" value={leftWidth} min={260} max={440} label="Resize antenna inputs" onChange={setLeftWidth} onReset={() => setLeftWidth(310)} />}

        <main className="flex min-w-0 flex-1 flex-col bg-background" aria-label="Antenna design workbench">
          <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-3">
            <div className="min-w-0"><p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-text-secondary">Design workspace</p><h1 className="truncate text-sm font-semibold">{template.name} <span className="font-normal text-text-secondary">· interactive geometry</span></h1></div>
            <div className="flex items-center gap-3">
              <CalculationStatus status={simStatus} compact />
              <div className="h-6 w-px bg-border" />
              <button type="button" aria-pressed={!leftCollapsed} className="rounded-md border border-border px-2 py-1 text-[10px] text-text-secondary hover:border-accent hover:text-text-primary" onClick={() => setLeftCollapsed((value) => !value)}>Inputs</button>
              <button type="button" aria-pressed={!analysisCollapsed} className="rounded-md border border-border px-2 py-1 text-[10px] text-text-secondary hover:border-accent hover:text-text-primary" onClick={() => setAnalysisCollapsed((value) => !value)}>Analysis</button>
              <button type="button" aria-pressed={!rightCollapsed} className="rounded-md border border-border px-2 py-1 text-[10px] text-text-secondary hover:border-accent hover:text-text-primary" onClick={() => setRightCollapsed((value) => !value)}>Summary</button>
              <HelpTip label="Workbench help">Drag dividers to resize panels. Use Ctrl+Shift+L, R, or B to toggle Inputs, Summary, or Analysis. Press ? for every shortcut.</HelpTip>
              <Button onClick={handleRunSimulation} loading={isLoading} disabled={isLoading || !validation.valid} size="sm">Calculate</Button>
            </div>
          </header>

          <div className="relative min-h-0 flex-1" data-testid="geometry-viewport">
            <ErrorBoundary label="3D Viewport"><SceneRoot wires={wireData} feedpoints={feedpoints} viewToggles={viewToggles} nonRadiatingLines={feederLines} patternData={patternData} currents={currents} nearField={nearField} measurementActive={measurementActive} measurementSelectedTags={measurementSelectedTags} measurementPointMode={measurementPointMode} onMeasurementWireSelect={selectMeasurementWire} /></ErrorBoundary>
            <ViewToggleToolbar toggles={viewToggles} onToggle={handleToggle} />
            <WireMeasurementTool wires={wireData} active={measurementActive} selectedTags={measurementSelectedTags} pointMode={measurementPointMode} onToggle={handleMeasurementToggle} onPointModeChange={setMeasurementPointMode} onClear={clearWireMeasurement} />
            {(viewToggles.pattern || viewToggles.volumetric) && patternData && <div className="absolute left-1/2 top-2 z-10 -translate-x-1/2"><ColorScale minLabel="Minimum" maxLabel="Maximum" unit="dBi" /></div>}
            {simStatus === "success" && result && result.frequency_data.length > 1 && <div className="absolute bottom-2 left-1/2 z-10 w-64 -translate-x-1/2"><PatternFrequencySlider /></div>}
          </div>

          {analysisCollapsed ? (
            <button type="button" className="flex h-8 shrink-0 items-center justify-center gap-2 border-t border-border bg-surface text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary hover:text-accent" onClick={() => setAnalysisCollapsed(false)} aria-label="Show analysis panel">Analysis and plots <span aria-hidden="true">⌃</span></button>
          ) : (
            <div className="flex shrink-0 flex-col" style={{ height: analysisHeight }} data-testid="workbench-analysis">
              <PanelResizeHandle orientation="vertical" value={analysisHeight} min={180} max={420} direction={-1} label="Resize analysis panel" onChange={setAnalysisHeight} onReset={() => setAnalysisHeight(220)} />
              <div className="flex min-h-0 flex-1 flex-col bg-surface"><div className="flex h-8 shrink-0 items-center justify-between border-b border-border px-3"><span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-text-secondary">Analysis · solver outputs</span><button type="button" className="rounded px-2 py-1 text-[10px] text-text-secondary hover:bg-surface-hover hover:text-text-primary" onClick={() => setAnalysisCollapsed(true)} aria-label="Collapse analysis panel">Collapse</button></div><div className="min-h-0 flex-1"><ErrorBoundary label="Analysis results"><ResultsPanel showSummary={false} /></ErrorBoundary></div></div>
            </div>
          )}
        </main>

        {!rightCollapsed && <PanelResizeHandle orientation="horizontal" value={rightWidth} min={250} max={420} direction={-1} label="Resize calculated results" onChange={setRightWidth} onReset={() => setRightWidth(292)} />}
        {rightCollapsed ? (
          <aside className="flex w-9 shrink-0 flex-col items-center border-l border-border bg-surface py-3" aria-label="Calculated results collapsed"><button type="button" className="rounded-md p-2 text-text-secondary hover:bg-surface-hover hover:text-accent" onClick={() => setRightCollapsed(false)} title="Show calculated results (Ctrl+Shift+R)" aria-label="Show calculated results">‹</button><span className="mt-3 [writing-mode:vertical-rl] text-[9px] font-semibold uppercase tracking-[0.18em] text-text-secondary">Calculated</span></aside>
        ) : (
          <aside className="shrink-0 overflow-hidden border-l border-border bg-surface" style={{ width: rightWidth }} aria-label="Calculated results" data-testid="workbench-summary"><EngineeringSummaryPanel templateName={template.name} frequencyRange={frequencyRange} ground={ground} modelSegments={wireGeometry.reduce((sum, wire) => sum + wire.segments, 0)} validation={validation} /></aside>
        )}
      </div>}

      {/* Main content area */}
      {!desktopWorkbench && <>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* === LEFT PANEL (desktop only) === */}
        <aside className="hidden lg:flex w-72 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface">
          <div className="p-3 space-y-4 flex-1">
            <ProjectActions
              onSave={handleProjectSave}
              onLoad={handleProjectLoad}
            />

            <WireEditorPromo />

            <TemplatePicker
              selectedId={template.id}
              onSelect={handleTemplateSelect}
            />

            <div className="border-t border-border" />

            <ParameterPanel
              parameters={template.parameters}
              values={params}
              onParamChange={setParam}
            />

            <div className="border-t border-border" />

            <GroundEditor ground={ground} onChange={setGround} />

            <div className="border-t border-border" />

            <BalunEditor matching={matching} onChange={setMatching} />

            <div className="border-t border-border" />

            <BandPresets
              currentRange={frequencyRange}
              onSelectBand={handleBandSelect}
              segments={frequencySegments}
              onToggleBand={handleToggleBand}
              hfOnly
            />

            <div className="border-t border-border" />

            <FrequencySegmentEditor
              frequencyRange={frequencyRange}
              onFrequencyRangeChange={setFrequencyRange}
              segments={frequencySegments}
              onSegmentsChange={setFrequencySegments}
            />

            <div className="border-t border-border" />

            {/* Pattern resolution */}
            <div className="space-y-1">
              <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider px-1">
                Pattern Resolution
              </h3>
              <div className="flex items-center gap-2 px-1">
                <select
                  value={patternStep}
                  onChange={(e) => setPatternStep(parseInt(e.target.value, 10))}
                  className="flex-1 bg-background text-text-primary text-xs font-mono px-1.5 py-1 rounded border border-border outline-none"
                >
                  <option value="1">1° (very fine — slow)</option>
                  <option value="2">2° (fine)</option>
                  <option value="5">5° (standard)</option>
                  <option value="10">10° (fast)</option>
                </select>
              </div>
              {patternStep <= 2 && (
                <p className="text-[10px] text-swr-warning px-1 leading-tight">
                  Fine resolution increases computation time significantly.
                </p>
              )}
            </div>

            {/* Tips */}
            {template.tips.length > 0 && (
              <>
                <div className="border-t border-border" />
                <div className="space-y-1">
                  <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider px-1">
                    Tips
                  </h3>
                  <ul className="space-y-1">
                    {template.tips.slice(0, 3).map((tip, i) => (
                      <li
                        key={i}
                        className="text-[11px] text-text-secondary leading-relaxed pl-3 relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-1 before:h-1 before:rounded-full before:bg-accent/40"
                      >
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>

          {/* Run button — bottom of left panel */}
          <div className="p-3 border-t border-border space-y-2">
            <ValidationWarnings validation={validation} />
            <Button
              onClick={handleRunSimulation}
              loading={isLoading}
              disabled={isLoading || !validation.valid}
              className="w-full"
              size="md"
            >
              {isLoading ? "Simulating..." : "Run Simulation"}
            </Button>
            {simError && (
              <p className="text-xs text-swr-bad mt-1.5 px-0.5">{simError}</p>
            )}
          </div>
        </aside>

        {/* === CENTER: 3D VIEWPORT === */}
        <main className="flex-1 relative min-w-0 min-h-0">
          <ErrorBoundary label="3D Viewport">
            <SceneRoot
              wires={wireData}
              feedpoints={feedpoints}
              viewToggles={viewToggles}
              nonRadiatingLines={feederLines}
              patternData={patternData}
              currents={currents}
              nearField={nearField}
              measurementActive={measurementActive}
              measurementSelectedTags={measurementSelectedTags}
              measurementPointMode={measurementPointMode}
              onMeasurementWireSelect={selectMeasurementWire}
            />
          </ErrorBoundary>

          {/* Overlays */}
          <ViewToggleToolbar toggles={viewToggles} onToggle={handleToggle} />
          <WireMeasurementTool
            wires={wireData}
            active={measurementActive}
            selectedTags={measurementSelectedTags}
            pointMode={measurementPointMode}
            onToggle={handleMeasurementToggle}
            onPointModeChange={setMeasurementPointMode}
            onClear={clearWireMeasurement}
          />

          {/* Color scale legend (when pattern is visible) */}
          {(viewToggles.pattern || viewToggles.volumetric) && patternData && (
            <div className="absolute top-2 left-1/2 z-10 -translate-x-1/2">
              <ColorScale minLabel="Min" maxLabel="Max" unit="dBi" />
            </div>
          )}

          {/* Pattern frequency slider — bottom-right above dBi legend on mobile, centered on desktop */}
          {simStatus === "success" && result && result.frequency_data.length > 1 && (
            <>
              {!measurementActive && (
                <div className="absolute bottom-14 left-1/2 z-10 w-36 -translate-x-1/2 lg:hidden">
                  <PatternFrequencySlider compact />
                </div>
              )}
              <div className="hidden lg:block absolute bottom-2 left-1/2 -translate-x-1/2 z-10 w-64">
                <PatternFrequencySlider />
              </div>
            </>
          )}

        </main>

        {/* === RIGHT PANEL (desktop only) === */}
        <aside className="hidden lg:flex w-72 shrink-0 flex-col overflow-hidden border-l border-border bg-surface">
          <ErrorBoundary label="Results">
            <ResultsPanel />
          </ErrorBoundary>
        </aside>
      </div>

      {/* === MOBILE BOTTOM SHEET === */}
      <div className="lg:hidden border-t border-border bg-surface flex flex-col max-h-[50%]">
        <div className="px-3 pt-2 pb-1 shrink-0 flex items-center gap-2">
          <div className="flex-1">
            <SegmentedControl
              segments={MOBILE_SEGMENTS}
              activeKey={mobileTab}
              onChange={(key) => setMobileTab(key as typeof mobileTab)}
            />
          </div>
          <Button
            onClick={handleRunSimulation}
            loading={isLoading}
            disabled={isLoading}
            size="sm"
            className="shrink-0"
          >
            {isLoading ? "Running..." : "Run"}
          </Button>
        </div>
        {simError && (
          <p className="text-xs text-swr-bad px-3 pb-1">{simError}</p>
        )}
        <div className="px-3 py-2 flex-1 overflow-y-auto">
          {mobileTab === "antenna" && (
            <div className="space-y-3">
              <ProjectActions
                onSave={handleProjectSave}
                onLoad={handleProjectLoad}
              />
              <WireEditorPromo />
              <TemplatePicker
                selectedId={template.id}
                onSelect={handleTemplateSelect}
              />
              <ParameterPanel
                parameters={template.parameters}
                values={params}
                onParamChange={setParam}
              />
              <GroundEditor ground={ground} onChange={setGround} />
              <BalunEditor matching={matching} onChange={setMatching} />

              <BandPresets
                currentRange={frequencyRange}
                onSelectBand={handleBandSelect}
                segments={frequencySegments}
                onToggleBand={handleToggleBand}
                hfOnly
              />

              <FrequencySegmentEditor
                frequencyRange={frequencyRange}
                onFrequencyRangeChange={setFrequencyRange}
                segments={frequencySegments}
                onSegmentsChange={setFrequencySegments}
                size="sm"
              />

              {/* Pattern resolution */}
              <div className="space-y-1">
                <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Pattern Resolution
                </h3>
                <select
                  value={patternStep}
                  onChange={(e) => setPatternStep(parseInt(e.target.value, 10))}
                  className="w-full bg-background text-text-primary text-xs font-mono px-1.5 py-1.5 rounded border border-border outline-none"
                >
                  <option value="1">1° (very fine — slow)</option>
                  <option value="2">2° (fine)</option>
                  <option value="5">5° (standard)</option>
                  <option value="10">10° (fast)</option>
                </select>
                {patternStep <= 2 && (
                  <p className="text-[11px] text-swr-warning leading-tight">
                    Fine resolution increases computation time significantly.
                  </p>
                )}
              </div>

              <ValidationWarnings validation={validation} />
            </div>
          )}
          {mobileTab === "results" && <ResultsPanel />}
        </div>
      </div>
      </>}

      {/* StatusBar (desktop only — mobile has essential info in overlays) */}
      <div className="hidden lg:block">
        <StatusBar />
      </div>

      <KeyboardShortcutsPanel
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        mode="simulator"
      />

      {/* Full-page simulation loading overlay — blocks all interaction */}
      {isLoading && <SimulationLoadingOverlay />}
    </div>
  );
}
