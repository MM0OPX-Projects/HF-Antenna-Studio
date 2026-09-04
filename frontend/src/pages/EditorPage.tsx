/**
 * EditorPage — V2 full wire editor mode.
 *
 * Desktop layout:
 *   [Toolbar] [3D Viewport] [Wire Table + Properties]
 *
 * Mobile layout:
 *   [3D Viewport (45%)] [Bottom Sheet: Wires | Properties | Results]
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "../stores/editorStore";
import { useSimulationStore } from "../stores/simulationStore";
import { useUIStore } from "../stores/uiStore";
import { MAX_FREQUENCY_MHZ, MIN_FREQUENCY_MHZ } from "../engine/limits";
import { EditorScene } from "../components/three/EditorScene";
import { getGroundGridMetrics } from "../components/three/ground-grid";
import { ErrorBoundary } from "../components/common/ErrorBoundary";
import { ViewToggleToolbar } from "../components/three/ViewToggleToolbar";
import { WireMeasurementTool } from "../components/three/WireMeasurementTool";
import { useWireMeasurement } from "../components/three/useWireMeasurement";
import { resolveWireMeasurementKeyboardAction } from "../utils/wire-measurement-interaction";
import { Navbar } from "../components/layout/Navbar";
import { EditorToolbar } from "../components/editors/EditorToolbar";
import { EndpointConnectionControls } from "../components/editors/EndpointConnectionControls";
import { WireTable } from "../components/editors/WireTable";
import { WirePropertiesPanel } from "../components/editors/WirePropertiesPanel";
import { DrawingControls } from "../components/editors/DrawingControls";
import { WireEditor2D } from "../components/editors/WireEditor2D";
import { ModelTransferStatus } from "../components/model-transfer/ModelTransferStatus";
import { GroundEditor } from "../components/editors/GroundEditor";
import { GeometryGroundEditor } from "../components/editors/GeometryGroundEditor";
import { BalunEditor } from "../components/editors/BalunEditor";
import { TemplatePicker } from "../components/editors/TemplatePicker";
import { ParameterPanel } from "../components/editors/ParameterPanel";
import { ResultsPanel } from "../components/results/ResultsTabs";
import { PatternFrequencySlider } from "../components/results/PatternFrequencySlider";
import { CompareOverlay } from "../components/results/CompareOverlay";
import { ImportExportPanel } from "../components/editors/ImportExportPanel";
import { TransformPanel } from "../components/editors/TransformPanel";
import { OptimizerPanel } from "../components/editors/OptimizerPanel";
import { ColorScale } from "../components/ui/ColorScale";
import { SimulationLoadingOverlay } from "../components/ui/SimulationLoadingOverlay";
import { BandPresets } from "../components/ui/BandPresets";
import { FrequencySegmentEditor } from "../components/ui/FrequencySegmentEditor";
import { ProjectActions } from "../components/ui/ProjectActions";
import { ValidationWarnings } from "../components/ui/ValidationWarnings";
import { Button } from "../components/ui/Button";
import { Slider } from "../components/ui/Slider";
import { NumberInput } from "../components/ui/NumberInput";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { createEditorProject } from "../utils/project-file";
import {
  IMPERIAL_LENGTH_UNIT_OPTIONS,
  lengthUnitToMeters,
  METRIC_LENGTH_UNIT_OPTIONS,
  metersToLengthUnit,
} from "../utils/units";
import type { LengthUnit } from "../utils/units";
import { validateSimulationRequest } from "../engine/validation";
import { resolveGeometryGroundFlag } from "../engine/geometry-ground";
import { templates } from "../templates";
import { getDefaultParams } from "../templates/types";
import type { ProjectFile } from "../utils/project-file";
import type { AntennaTemplate, FrequencyRange } from "../templates/types";
import { bandToSegment, hasBandSegment, removeBandSegment } from "../utils/ham-bands";
import type { HamBand } from "../utils/ham-bands";
import type { ViewToggles } from "../components/three/types";

/** Mobile tab options */
const MOBILE_SEGMENTS = [
  { key: "wires", label: "Wires" },
  { key: "properties", label: "Props" },
  { key: "settings", label: "Settings" },
  { key: "tools", label: "Tools" },
  { key: "results", label: "Results" },
];

type MobileEditorTab = "wires" | "properties" | "settings" | "tools" | "results";

const HEIGHT_UNIT_DECIMALS: Record<LengthUnit, number> = {
  m: 3,
  cm: 1,
  mm: 0,
  ft: 2,
  in: 1,
};

export function EditorPage() {
  const viewportRef = useRef<HTMLElement>(null);
  // Editor store
  const wires = useEditorStore((s) => s.wires);
  const excitations = useEditorStore((s) => s.excitations);
  const junctions = useEditorStore((s) => s.junctions);
  const radialSystems = useEditorStore((s) => s.radialSystems);
  const ground = useEditorStore((s) => s.ground);
  const setGround = useEditorStore((s) => s.setGround);
  const geometryGroundFlag = useEditorStore((s) => s.geometryGroundFlag);
  const setGeometryGroundFlag = useEditorStore((s) => s.setGeometryGroundFlag);
  const frequencyRange = useEditorStore((s) => s.frequencyRange);
  const frequencySegments = useEditorStore((s) => s.frequencySegments);
  const setFrequencyRange = useEditorStore((s) => s.setFrequencyRange);
  const setFrequencySegments = useEditorStore((s) => s.setFrequencySegments);
  const designFrequencyMhz = useEditorStore((s) => s.designFrequencyMhz);
  const setDesignFrequency = useEditorStore((s) => s.setDesignFrequency);
  const mode = useEditorStore((s) => s.mode);
  const setMode = useEditorStore((s) => s.setMode);
  const verticalDrag = useEditorStore((s) => s.verticalDrag);
  const setVerticalDrag = useEditorStore((s) => s.setVerticalDrag);
  const snapSize = useEditorStore((s) => s.snapSize);
  const setSnapSize = useEditorStore((s) => s.setSnapSize);
  const selectedTags = useEditorStore((s) => s.selectedTags);
  const clearEndpointSelection = useEditorStore((s) => s.clearEndpointSelection);
  const snapSelectedEndpoints = useEditorStore((s) => s.snapSelectedEndpoints);
  const toggleSelectedJunction = useEditorStore((s) => s.toggleSelectedJunction);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const undoCount = useEditorStore((s) => s.undoStack.length);
  const redoCount = useEditorStore((s) => s.redoStack.length);
  const deselectAll = useEditorStore((s) => s.deselectAll);
  const deleteSelected = useEditorStore((s) => s.deleteSelected);
  const selectAll = useEditorStore((s) => s.selectAll);
  const copySelected = useEditorStore((s) => s.copySelected);
  const paste = useEditorStore((s) => s.paste);
  const duplicateSelected = useEditorStore((s) => s.duplicateSelected);
  const getWireGeometry = useEditorStore((s) => s.getWireGeometry);
  const getTotalSegments = useEditorStore((s) => s.getTotalSegments);
  const moveAllWiresZ = useEditorStore((s) => s.moveAllWiresZ);
  const clearAll = useEditorStore((s) => s.clearAll);
  const setWires = useEditorStore((s) => s.setWires);
  const addLoad = useEditorStore((s) => s.addLoad);
  const addTransmissionLine = useEditorStore((s) => s.addTransmissionLine);
  const necImport = useEditorStore((s) => s.necImport);
  const setNecImport = useEditorStore((s) => s.setNecImport);
  const modelTransfer = useEditorStore((s) => s.modelTransfer);
  const setModelTransfer = useEditorStore((s) => s.setModelTransfer);
  const setPickingExcitationForTag = useEditorStore(
    (s) => s.setPickingExcitationForTag,
  );

  // Simulation store
  const simStatus = useSimulationStore((s) => s.status);
  const simResult = useSimulationStore((s) => s.result);
  const simError = useSimulationStore((s) => s.error);
  const simulateAdvanced = useSimulationStore((s) => s.simulateAdvanced);
  const resetSimulation = useSimulationStore((s) => s.reset);
  const selectedFreqResult = useSimulationStore((s) =>
    s.getSelectedFrequencyResult()
  );

  // V2 features from editor store
  const loads = useEditorStore((s) => s.loads);
  const transmissionLines = useEditorStore((s) => s.transmissionLines);
  const computeCurrents = useEditorStore((s) => s.computeCurrents);

  // UI store
  const viewToggles = useUIStore((s) => s.viewToggles);
  const toggleView = useUIStore((s) => s.toggleView);
  const setViewToggle = useUIStore((s) => s.setViewToggle);
  const matching = useUIStore((s) => s.matching);
  const setMatching = useUIStore((s) => s.setMatching);
  const imperial = useUIStore((s) => s.imperial);
  const metricLengthUnit = useUIStore((s) => s.metricLengthUnit);
  const imperialLengthUnit = useUIStore((s) => s.imperialLengthUnit);
  const setLengthUnit = useUIStore((s) => s.setLengthUnit);
  const {
    active: measurementActive,
    selectedTags: measurementSelectedTags,
    pointMode: measurementPointMode,
    toggle: toggleWireMeasurement,
    selectWire: selectMeasurementWire,
    setPointMode: setMeasurementPointMode,
    clear: clearWireMeasurement,
  } = useWireMeasurement();

  const [viewportMode, setViewportMode] = useState<"2d" | "3d">("2d");
  // Keep the radiation surface at a stable, readable size. Camera controls
  // remain the primary way to zoom the complete 3D scene.
  const patternScaleMultiplier = 1.5;

  // Editor section dropdown: replaces 6 individual accordion toggles
  type EditorSection = "wires" | "templates" | "tools" | "settings";
  const [editorSection, setEditorSection] = useState<EditorSection>("wires");

  // Tools sub-section accordion state (only used within "tools" section)
  const [toolsImportOpen, setToolsImportOpen] = useState(false);
  const [toolsTransformOpen, setToolsTransformOpen] = useState(true);
  const [toolsCompareOpen, setToolsCompareOpen] = useState(false);
  const [toolsOptimizerOpen, setToolsOptimizerOpen] = useState(false);

  // Template loader state
  const [selectedTemplate, setSelectedTemplate] = useState<AntennaTemplate>(templates[0]!);
  const [templateParams, setTemplateParams] = useState<Record<string, number>>(
    () => getDefaultParams(templates[0]!)
  );

  // Pattern resolution
  const [patternStep, setPatternStep] = useState(5);
  const effectiveGeometryGroundFlag = useMemo(
    () => resolveGeometryGroundFlag(wires, ground, geometryGroundFlag),
    [wires, ground, geometryGroundFlag],
  );
  // Mobile tab state (local to editor)
  const [mobileTab, setMobileTab] = useState<MobileEditorTab>("wires");

  // The editor canvas owns deliberate wheel gestures for zoom. Prevent the
  // newly scrollable desktop page from moving at the same time; users can use
  // its scrollbar or the Analysis/Back controls for page navigation.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const keepWheelInsideViewport = (event: WheelEvent) => event.preventDefault();
    viewport.addEventListener("wheel", keepWheelInsideViewport, { passive: false });
    return () => viewport.removeEventListener("wheel", keepWheelInsideViewport);
  }, []);

  // Keep the compact mobile workflow focused on results after a calculation.
  // Desktop results remain in the full-width analysis workspace below the editor.
  useEffect(() => {
    if (simStatus === "success") {
      setMobileTab("results");
    }
  }, [simStatus]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      )
        return;

      const measurementKeyboardAction =
        resolveWireMeasurementKeyboardAction(measurementActive, e.key);
      if (measurementKeyboardAction === "exit-measurement") {
        e.preventDefault();
        toggleWireMeasurement();
        deselectAll();
        clearEndpointSelection();
        setMode("select");
        return;
      }
      if (measurementKeyboardAction === "ignore") return;

      if ((e.key === "s" || e.key === "S") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        snapSelectedEndpoints(e.shiftKey);
      } else if ((e.key === "j" || e.key === "J") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggleSelectedJunction();
      } else if ((e.key === "v" || e.key === "V") && !e.ctrlKey && !e.metaKey) setMode("select");
      else if (e.key === "a" && !e.ctrlKey && !e.metaKey) setMode("add");
      else if ((e.key === "m" || e.key === "M") && !e.ctrlKey && !e.metaKey) setMode("move");
      else if (e.key === "Escape") {
        deselectAll();
        clearEndpointSelection();
        setMode("select");
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedTags.size > 0) {
          e.preventDefault();
          deleteSelected();
        }
      }
      else if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "Z" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        selectAll();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        e.preventDefault();
        copySelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "v" && !e.shiftKey) {
        // Only intercept Ctrl+V when not also pressing shift (which some browsers use for paste-as-text)
        e.preventDefault();
        paste();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        duplicateSelected();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setMode, deselectAll, clearEndpointSelection, snapSelectedEndpoints, toggleSelectedJunction, deleteSelected, selectedTags.size, undo, redo, selectAll, copySelected, paste, duplicateSelected, measurementActive, toggleWireMeasurement]);

  // Clear stale results on page entry (prevents cross-page state leaks)
  // and whenever antenna geometry or config changes.
  useEffect(() => {
    resetSimulation();
  }, [wires, excitations, loads, transmissionLines, ground, effectiveGeometryGroundFlag, resetSimulation]);

  // Handlers
  const handleToggle = useCallback(
    (key: keyof ViewToggles) => toggleView(key),
    [toggleView]
  );

  const handleMeasurementToggle = useCallback(() => {
    if (!measurementActive) {
      setMode("select");
      clearEndpointSelection();
      setPickingExcitationForTag(null);
      setViewToggle("wires", true);
    }
    toggleWireMeasurement();
  }, [measurementActive, toggleWireMeasurement, setMode, clearEndpointSelection, setPickingExcitationForTag, setViewToggle]);

  const handleRunSimulation = useCallback(() => {
    if (wires.length === 0 || excitations.length === 0) return;
    const wireGeometry = getWireGeometry();
    simulateAdvanced({
      wires: wireGeometry,
      excitations,
      ground,
      geometry_ground_flag: effectiveGeometryGroundFlag,
      frequency: frequencyRange,
      frequencySegments: frequencySegments.length > 0 ? frequencySegments : undefined,
      loads: loads.length > 0 ? loads : undefined,
      transmission_lines: transmissionLines.length > 0 ? transmissionLines : undefined,
      compute_currents: computeCurrents,
      near_field: {
        plane: "horizontal",
        height_m: 1.8,
        extent_m: 20.0,
        resolution_m: 0.5,
      },
      pattern_step: patternStep,
    });
  }, [wires, excitations, ground, effectiveGeometryGroundFlag, frequencyRange, frequencySegments, loads, transmissionLines, computeCurrents, patternStep, simulateAdvanced, getWireGeometry]);

  // Template loader handlers
  const handleTemplateSelect = useCallback((t: AntennaTemplate) => {
    setSelectedTemplate(t);
    setTemplateParams(getDefaultParams(t));
  }, []);

  const handleTemplateParamChange = useCallback((key: string, value: number) => {
    setTemplateParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleLoadTemplate = useCallback(() => {
    const geom = selectedTemplate.generateGeometry(templateParams);
    const rawExc = selectedTemplate.generateExcitation(templateParams, geom);
    const excitations = Array.isArray(rawExc) ? rawExc : [rawExc];
    const templateLoads = selectedTemplate.generateLoads?.(templateParams, geom) ?? [];
    const templateTLs = selectedTemplate.generateTransmissionLines?.(templateParams, geom) ?? [];
    const freqRange = selectedTemplate.defaultFrequencyRange(templateParams);
    const freqParam = templateParams.frequency ?? templateParams.freq ?? 14.15;

    // Clear editor and load template wires + excitations
    clearAll();
    setWires(
      geom.map((w) => ({ ...w, selected: false })),
      excitations
    );

    // Carry over any template loads / transmission lines
    templateLoads.forEach((load) => addLoad(load));
    templateTLs.forEach((tl) => addTransmissionLine(tl));

    // Update design frequency and sweep range
    setDesignFrequency(freqParam);
    setFrequencyRange(freqRange);

    // Set ground and matching from template defaults
    setGround(selectedTemplate.defaultGround);
    setMatching(selectedTemplate.defaultMatching ?? { type: "none", ratio: 1, feedlineZ0: 50 });

    // Switch to wires section after loading
    setEditorSection("wires");
  }, [selectedTemplate, templateParams, clearAll, setWires, addLoad, addTransmissionLine, setDesignFrequency, setFrequencyRange, setGround, setMatching, setEditorSection]);

  const handleBandSelect = useCallback(
    (range: FrequencyRange, _band: HamBand) => {
      setFrequencySegments([]);
      setFrequencyRange(range);
      const center = (range.start_mhz + range.stop_mhz) / 2;
      setDesignFrequency(center);
    },
    [setFrequencySegments, setFrequencyRange, setDesignFrequency]
  );

  const handleToggleBand = useCallback(
    (band: HamBand) => {
      if (hasBandSegment(frequencySegments, band)) {
        setFrequencySegments(removeBandSegment(frequencySegments, band));
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
    return createEditorProject(
      wires,
      excitations,
      loads,
      transmissionLines,
      ground,
      frequencyRange,
      designFrequencyMhz,
      junctions,
      simResult ?? null,
      necImport,
      frequencySegments,
      geometryGroundFlag,
      radialSystems,
      modelTransfer,
    );
  }, [wires, excitations, loads, transmissionLines, ground, geometryGroundFlag, frequencyRange, frequencySegments, designFrequencyMhz, junctions, radialSystems, simResult, necImport, modelTransfer]);

  const handleProjectLoad = useCallback(
    (project: ProjectFile) => {
      if (project.mode !== "editor" || !project.editor) {
        alert("This project was saved from the Simulator. Open it there instead.");
        return;
      }
      const ed = project.editor;
      clearAll();
      // Set the auto-segmentation reference while the editor is empty, then
      // restore the saved geometry exactly rather than re-segmenting it.
      setDesignFrequency(ed.designFrequencyMhz);
      setWires(
        ed.wires.map((w) => ({
          ...w,
          selected: false,
          segmentsManual: w.segmentsManual ?? Boolean(ed.necImport),
        })),
        ed.excitations,
        ed.junctions,
        ed.radialSystems,
      );
      ed.loads.forEach((load) => addLoad(load));
      ed.transmissionLines.forEach((line) => addTransmissionLine(line));
      setGround(ed.ground);
      setGeometryGroundFlag(ed.geometryGroundFlag ?? null);
      setFrequencyRange(ed.frequencyRange);
      setFrequencySegments(ed.frequencySegments ?? []);
      setNecImport(ed.necImport ?? null);
      setModelTransfer(ed.modelTransfer ?? null);
      if (ed.modelTransfer) setMatching({ type: "none", ratio: 1, feedlineZ0: ed.modelTransfer.referenceImpedanceOhm });
    },
    [clearAll, setWires, addLoad, addTransmissionLine, setGround, setGeometryGroundFlag, setFrequencyRange, setFrequencySegments, setDesignFrequency, setNecImport, setModelTransfer, setMatching]
  );

  const isLoading = simStatus === "loading";
  const canRun = wires.length > 0 && excitations.length > 0;

  const scrollToAnalysis = useCallback(() => {
    document.getElementById("wire-editor-analysis")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const scrollToEditor = useCallback(() => {
    document.getElementById("wire-editor-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Pre-simulation validation
  // wires is intentionally used as the dep trigger — getWireGeometry() reads from the store
  const wireGeometry = useMemo(() => {
    void wires; // trigger re-computation when wires change
    return getWireGeometry();
  }, [wires, getWireGeometry]);
  const validation = useMemo(
    () => validateSimulationRequest(wireGeometry, excitations, ground, frequencyRange, loads, transmissionLines, frequencySegments, effectiveGeometryGroundFlag),
    [wireGeometry, excitations, ground, frequencyRange, loads, transmissionLines, frequencySegments, effectiveGeometryGroundFlag]
  );

  const patternData = selectedFreqResult?.pattern ?? null;
  const currentData = selectedFreqResult?.currents ?? null;
  const nearFieldData = simResult?.near_field ?? null;
  const totalSegments = getTotalSegments();
  const groundGridMetrics = useMemo(
    () => getGroundGridMetrics(wireGeometry),
    [wireGeometry],
  );

  // Compute current antenna height (min Z across all wire endpoints)
  const antennaMinZ = useMemo(() => {
    if (wires.length === 0) return 0;
    let minZ = Infinity;
    for (const w of wires) {
      minZ = Math.min(minZ, w.z1, w.z2);
    }
    return minZ;
  }, [wires]);

  const antennaMaxZ = useMemo(() => {
    if (wires.length === 0) return 0;
    let maxZ = -Infinity;
    for (const w of wires) {
      maxZ = Math.max(maxZ, w.z1, w.z2);
    }
    return maxZ;
  }, [wires]);

  const heightUnitOptions = imperial
    ? IMPERIAL_LENGTH_UNIT_OPTIONS
    : METRIC_LENGTH_UNIT_OPTIONS;
  const activeHeightUnit: LengthUnit = imperial
    ? imperialLengthUnit
    : metricLengthUnit;
  const heightUnitDecimals = HEIGHT_UNIT_DECIMALS[activeHeightUnit];
  const antennaHeightValue = metersToLengthUnit(
    antennaMinZ,
    activeHeightUnit,
  );
  const antennaHeightDescription = `Lowest point: ${metersToLengthUnit(
    antennaMinZ,
    activeHeightUnit,
  ).toFixed(heightUnitDecimals)}${activeHeightUnit}, highest: ${metersToLengthUnit(
    antennaMaxZ,
    activeHeightUnit,
  ).toFixed(heightUnitDecimals)}${activeHeightUnit}`;

  // Height adjustment handler — shifts all wires so that the lowest point is at the target height
  const handleHeightChange = useCallback(
    (targetMinZ: number) => {
      const dz = targetMinZ - antennaMinZ;
      if (Math.abs(dz) > 1e-9) {
        moveAllWiresZ(dz);
      }
    },
    [antennaMinZ, moveAllWiresZ]
  );

  const handleDisplayedHeightChange = useCallback(
    (value: number) =>
      handleHeightChange(lengthUnitToMeters(value, activeHeightUnit)),
    [activeHeightUnit, handleHeightChange],
  );

  const handleHeightUnitChange = useCallback((unit: string) => {
    setLengthUnit(unit as LengthUnit);
  }, [setLengthUnit]);

  return (
    <div data-testid="wire-editor-page" className="flex h-dvh flex-col overflow-hidden bg-background lg:overflow-y-auto">
      <Navbar />

      {/* Main content area */}
      <div id="wire-editor-workspace" className="flex flex-1 overflow-hidden lg:h-[calc(100dvh-4.5rem)] lg:min-h-[640px] lg:flex-none">
        {/* === LEFT: TOOLBAR (desktop only) === */}
        <div className="hidden lg:block">
          <EditorToolbar />
        </div>

        {/* === CENTER: 3D VIEWPORT === */}
        <main ref={viewportRef} className="flex-1 relative min-w-0 min-h-0">
          {viewportMode === "2d" ? (
            <ErrorBoundary label="2D Wire Editor">
              <WireEditor2D />
            </ErrorBoundary>
          ) : (
            <ErrorBoundary label="3D Viewport">
              <EditorScene
                viewToggles={viewToggles}
                patternData={patternData}
                currents={currentData}
                nearField={nearFieldData}
                measurementActive={measurementActive}
                measurementSelectedTags={measurementSelectedTags}
                measurementPointMode={measurementPointMode}
                onMeasurementWireSelect={selectMeasurementWire}
                patternScaleMultiplier={patternScaleMultiplier}
              />
            </ErrorBoundary>
          )}

          <div className="absolute left-1/2 top-2 z-30 flex -translate-x-1/2 rounded-md border border-border bg-surface/95 p-0.5 shadow-lg backdrop-blur-sm" role="group" aria-label="Editor view">
            {(["2d", "3d"] as const).map((view) => (
              <button
                key={view}
                type="button"
                data-testid={`editor-view-${view}`}
                aria-pressed={viewportMode === view}
                onClick={() => setViewportMode(view)}
                className={`rounded px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${viewportMode === view ? "bg-accent text-white" : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"}`}
              >
                {view}
              </button>
            ))}
            <button
              type="button"
              onClick={scrollToAnalysis}
              className="ml-0.5 rounded border-l border-border px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-secondary hover:bg-surface-hover hover:text-accent"
              aria-label="Show analysis and calculated results"
            >
              Analysis
            </button>
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              className="ml-0.5 rounded border-l border-border px-2.5 py-1 text-[10px] font-semibold tracking-wide text-text-secondary hover:bg-surface-hover hover:text-accent disabled:cursor-not-allowed disabled:opacity-35"
              title={`Undo last edit (${undoCount} available) · Ctrl+Z`}
              aria-label="Undo last Wire Editor action"
            >
              ↩ Undo
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              className="rounded px-2.5 py-1 text-[10px] font-semibold tracking-wide text-text-secondary hover:bg-surface-hover hover:text-accent disabled:cursor-not-allowed disabled:opacity-35"
              title={`Redo last undone edit (${redoCount} available) · Ctrl+Y`}
              aria-label="Redo last Wire Editor action"
            >
              ↪ Redo
            </button>
            {viewportMode === "3d" && (
              <button
                type="button"
                onClick={() => handleToggle("pattern")}
                disabled={!patternData}
                aria-pressed={viewToggles.pattern}
                className={`ml-0.5 rounded border-l border-border px-2.5 py-1 text-[10px] font-semibold tracking-wide disabled:cursor-not-allowed disabled:opacity-35 ${viewToggles.pattern && patternData ? "bg-violet-500/20 text-violet-300" : "text-text-secondary hover:bg-surface-hover hover:text-accent"}`}
                title={patternData ? "Show or hide the solved 3D radiation-pattern surface" : "Run a simulation to calculate the radiation pattern"}
              >
                Pattern {viewToggles.pattern && patternData ? "on" : "off"}
              </button>
            )}
          </div>

          <EndpointConnectionControls />
          {viewportMode === "3d" && <DrawingControls />}

          {/* Overlays */}
          {viewportMode === "3d" && (
            <>
              <ViewToggleToolbar toggles={viewToggles} onToggle={handleToggle} />
              <WireMeasurementTool
                wires={wireGeometry}
                active={measurementActive}
                selectedTags={measurementSelectedTags}
                pointMode={measurementPointMode}
                onToggle={handleMeasurementToggle}
                onPointModeChange={setMeasurementPointMode}
                onClear={clearWireMeasurement}
              />
            </>
          )}

          {/* Mode indicator */}
          <div className="absolute top-2 left-2 z-10">
            <div className="bg-surface/80 backdrop-blur-sm border border-border rounded-md px-2 py-1 text-[10px] font-mono text-text-secondary">
              Mode:{" "}
              <span className="text-accent font-bold uppercase">
                {measurementActive ? "measure" : mode}
              </span>
              {!measurementActive && mode === "add" && (
                <span className="text-text-secondary ml-1">
                  <span className="hidden sm:inline">(click empty space or a wire end to start)</span>
                  <span className="sm:hidden">(tap space or an end)</span>
                </span>
              )}
              {!measurementActive && mode === "move" && (
                <span className="text-text-secondary ml-1">
                  <span className="hidden lg:inline">(X/Y/Z = lock axis, Shift+X/Y/Z = exclude axis)</span>
                  <span className="lg:hidden">{verticalDrag ? "(vertical)" : "(drag to move)"}</span>
                </span>
              )}
            </div>
          </div>

          {viewportMode === "3d" && (
            <div className="pointer-events-none absolute bottom-2 left-2 z-10 rounded border border-border bg-surface/80 px-2 py-1 text-[9px] font-mono text-text-secondary backdrop-blur-sm" aria-label="NEC coordinate legend">
              <span className="text-red-500">X</span> / <span className="text-emerald-500">Y</span> / <span className="text-blue-500">Z up</span> · grid {groundGridMetrics.cellSize} m · snap {snapSize > 0 ? `${snapSize} m` : "off"}
            </div>
          )}

          {/* Color scale */}
          {viewportMode === "3d" && (viewToggles.pattern || viewToggles.volumetric) && patternData && (
            <div className="absolute top-2 left-1/2 z-10 -translate-x-1/2">
              <ColorScale minLabel="Min" maxLabel="Max" unit="dBi" />
            </div>
          )}

          {viewportMode === "3d" && (viewToggles.pattern || viewToggles.volumetric) && patternData && (
            <div className="pointer-events-none absolute bottom-12 right-2 z-10 rounded border border-border bg-surface/80 px-2 py-1 text-[9px] text-text-secondary shadow backdrop-blur-sm" data-testid="pattern-scale-status">
              Pattern display 1.50× · zoom with the viewport wheel
            </div>
          )}

          {/* Pattern frequency slider — bottom-right above dBi legend on mobile, centered on desktop */}
          {viewportMode === "3d" && simStatus === "success" && simResult && simResult.frequency_data.length > 1 && (
            <>
              {!measurementActive && (
                <div className="absolute bottom-14 left-1/2 z-10 w-36 -translate-x-1/2 lg:hidden">
                  <PatternFrequencySlider compact />
                </div>
              )}
              <div className="hidden lg:block absolute bottom-2 left-1/2 -translate-x-1/2 z-10 w-56">
                <PatternFrequencySlider />
              </div>
            </>
          )}

          {/* Empty-state hint */}
          {viewportMode === "3d" && wires.length === 0 && (
            <div className="pointer-events-none absolute left-2 top-20 z-10 lg:top-10">
              <div className="max-w-[240px] rounded-lg border border-border bg-surface/90 px-4 py-3 text-left backdrop-blur-sm">
                <p className="text-sm text-text-primary font-medium mb-1">No wires yet</p>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Switch to <span className="text-accent font-medium">Add</span> mode and click the viewport to place wires, or go to <span className="text-accent font-medium">Tools</span> to import a file or load a template.
                </p>
              </div>
            </div>
          )}

          {/* Mobile toolbar (floating, below mode indicator) */}
          <div className="lg:hidden absolute top-10 left-2 z-10 flex gap-1">
            {(["select", "add", "move"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-2 text-xs rounded-md font-mono ${
                  mode === m
                    ? "bg-accent/20 text-accent border border-accent/40"
                    : "bg-surface/80 text-text-secondary border border-border"
                }`}
              >
                {m[0]!.toUpperCase()}
              </button>
            ))}
            {/* Vertical drag toggle — only in move mode */}
            {mode === "move" && (
              <button
                onClick={() => setVerticalDrag(!verticalDrag)}
                className={`px-3 py-2 text-xs rounded-md font-mono ${
                  verticalDrag
                    ? "bg-orange-500/20 text-orange-400 border border-orange-400/50"
                    : "bg-surface/80 text-text-secondary border border-border"
                }`}
                title="Toggle vertical (Z-axis) drag"
              >
                Z
              </button>
            )}
          </div>

        </main>

        {/* === RIGHT PANEL (desktop only) === */}
        <aside className="hidden lg:flex flex-col w-80 xl:w-96 border-l border-border bg-surface overflow-hidden shrink-0">
          {/* Editing controls stay beside the geometry; detailed results live below. */}
          <div className="p-2 border-b border-border shrink-0 space-y-1.5">
            <div className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
              Wire and project controls
            </div>
            <ProjectActions
              onSave={handleProjectSave}
              onLoad={handleProjectLoad}
            />
          </div>

          <>
              <ModelTransferStatus />
              {/* Section selector dropdown */}
              <div className="px-2 py-1.5 border-b border-border shrink-0">
                <select
                  value={editorSection}
                  onChange={(e) => setEditorSection(e.target.value as EditorSection)}
                  className="w-full bg-background text-text-primary text-xs font-medium px-2 py-1 rounded border border-border focus:border-accent/50 outline-none"
                >
                  <option value="wires">Wires ({wires.length})</option>
                  <option value="templates">Templates</option>
                  <option value="tools">Tools</option>
                  <option value="settings">Settings</option>
                </select>
              </div>

              {/* Section content — scrollable */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {/* === Wires section: table + properties, both always visible === */}
                {editorSection === "wires" && (
                  <div className="flex flex-col">
                    <div className="min-h-[150px] max-h-[300px] overflow-y-auto">
                      <WireTable />
                    </div>
                    <div className="border-t border-border">
                      <div className="px-2 py-1.5 text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
                        Properties {selectedTags.size > 0 ? `(${selectedTags.size} selected)` : ""}
                      </div>
                      <div className="min-h-[150px] overflow-y-auto">
                        <WirePropertiesPanel />
                      </div>
                    </div>
                  </div>
                )}

                {/* === Templates section: picker + params + load button === */}
                {editorSection === "templates" && (
                  <div className="px-2 pb-2 pt-1.5 space-y-2">
                    <TemplatePicker
                      selectedId={selectedTemplate.id}
                      onSelect={handleTemplateSelect}
                    />
                    <ParameterPanel
                      parameters={selectedTemplate.parameters}
                      values={templateParams}
                      onParamChange={handleTemplateParamChange}
                    />
                    {wires.length > 0 && (
                      <p className="text-[10px] text-swr-warning leading-tight px-0.5">
                        Loading a template will replace all current wires.
                      </p>
                    )}
                    <Button
                      onClick={handleLoadTemplate}
                      className="w-full"
                      size="sm"
                    >
                      Load into Editor
                    </Button>
                  </div>
                )}

                {/* === Tools section: collapsible sub-sections === */}
                {editorSection === "tools" && (
                  <div className="flex flex-col">
                    {/* Numeric transforms */}
                    <button
                      onClick={() => setToolsTransformOpen(!toolsTransformOpen)}
                      className="flex items-center justify-between w-full px-2 py-1.5 text-[10px] font-semibold text-text-secondary uppercase tracking-wider hover:bg-surface-hover transition-colors"
                    >
                      <span>Transform</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${toolsTransformOpen ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
                    </button>
                    {toolsTransformOpen && (
                      <div className="px-2 pb-2 pt-1">
                        <TransformPanel />
                      </div>
                    )}

                    {/* Import/Export */}
                    <button
                      onClick={() => setToolsImportOpen(!toolsImportOpen)}
                      className="flex items-center justify-between w-full px-2 py-1.5 text-[10px] font-semibold text-text-secondary uppercase tracking-wider hover:bg-surface-hover transition-colors border-t border-border"
                    >
                      <span>Import / Export</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${toolsImportOpen ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
                    </button>
                    {toolsImportOpen && (
                      <div className="px-2 pb-2 pt-1 min-h-[150px]">
                        <ImportExportPanel />
                      </div>
                    )}

                    {/* Compare */}
                    <button
                      onClick={() => setToolsCompareOpen(!toolsCompareOpen)}
                      className="flex items-center justify-between w-full px-2 py-1.5 text-[10px] font-semibold text-text-secondary uppercase tracking-wider hover:bg-surface-hover transition-colors border-t border-border"
                    >
                      <span>Compare</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${toolsCompareOpen ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
                    </button>
                    {toolsCompareOpen && (
                      <div className="px-2 pb-2 pt-1 min-h-[150px]">
                        <CompareOverlay />
                      </div>
                    )}

                    {/* Optimizer */}
                    <button
                      onClick={() => setToolsOptimizerOpen(!toolsOptimizerOpen)}
                      className="flex items-center justify-between w-full px-2 py-1.5 text-[10px] font-semibold text-text-secondary uppercase tracking-wider hover:bg-surface-hover transition-colors border-t border-border"
                    >
                      <span>Optimizer</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${toolsOptimizerOpen ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
                    </button>
                    {toolsOptimizerOpen && (
                      <div className="px-2 pb-2 pt-1 min-h-[150px]">
                        <OptimizerPanel />
                      </div>
                    )}
                  </div>
                )}

                {/* === Settings section: height, snap, ground, balun, pattern res === */}
                {editorSection === "settings" && (
                  <div className="px-2 py-2 space-y-3">
                    {/* Snap size */}
                    <div>
                      <label className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider block mb-1">
                        Snap Size
                      </label>
                      <select
                        value={snapSize}
                        onChange={(e) => setSnapSize(parseFloat(e.target.value))}
                        className="w-full bg-background text-text-primary text-[10px] font-mono px-1.5 py-1 rounded border border-border outline-none"
                      >
                        <option value="0">Off</option>
                        <option value="0.001">0.001 m (1 mm)</option>
                        <option value="0.005">0.005 m (5 mm)</option>
                        <option value="0.01">0.01 m</option>
                        <option value="0.05">0.05 m</option>
                        <option value="0.1">0.1 m</option>
                        <option value="0.25">0.25 m</option>
                        <option value="0.5">0.5 m</option>
                        <option value="1">1.0 m</option>
                      </select>
                    </div>

                    {/* Ground */}
                    <GroundEditor ground={ground} onChange={setGround} />
                    <GeometryGroundEditor
                      value={geometryGroundFlag}
                      effectiveValue={effectiveGeometryGroundFlag}
                      onChange={setGeometryGroundFlag}
                    />

                    {/* Pattern resolution */}
                    <div>
                      <label className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider block mb-1">
                        Pattern Resolution
                      </label>
                      <select
                        value={patternStep}
                        onChange={(e) => setPatternStep(parseInt(e.target.value, 10))}
                        className="w-full bg-background text-text-primary text-[10px] font-mono px-1.5 py-1 rounded border border-border outline-none"
                      >
                        <option value="1">1° (very fine)</option>
                        <option value="2">2° (fine)</option>
                        <option value="5">5° (standard)</option>
                        <option value="10">10° (fast)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
          </>

          {/* Bottom: Frequency, Sweep, Run button (always visible) */}
          <div className="p-2 space-y-2 shrink-0 border-t border-border">
            {/* Design frequency */}
            <NumberInput
              label="Design freq:"
              value={designFrequencyMhz}
              onChange={setDesignFrequency}
              min={MIN_FREQUENCY_MHZ}
              max={MAX_FREQUENCY_MHZ}
              decimals={3}
              unit="MHz"
            />

            {/* Band presets */}
            <BandPresets
              currentRange={frequencyRange}
              onSelectBand={handleBandSelect}
              segments={frequencySegments}
              onToggleBand={handleToggleBand}
              hfOnly
            />

            {/* Frequency sweep / segments */}
            <FrequencySegmentEditor
              frequencyRange={frequencyRange}
              onFrequencyRangeChange={setFrequencyRange}
              segments={frequencySegments}
              onSegmentsChange={setFrequencySegments}
            />

            {/* Matching / Balun — near band presets for discoverability */}
            <BalunEditor matching={matching} onChange={setMatching} />

            {/* Antenna height */}
            {wires.length > 0 && (
              <Slider
                label="Antenna Height"
                value={antennaHeightValue}
                min={1}
                max={100}
                step={1}
                unit={activeHeightUnit}
                unitOptions={heightUnitOptions}
                onUnitChange={handleHeightUnitChange}
                decimals={heightUnitDecimals}
                description={antennaHeightDescription}
                onChange={handleDisplayedHeightChange}
              />
            )}

            {/* Validation warnings */}
            <ValidationWarnings validation={validation} />

            {/* Run */}
            <p data-testid="wire-editor-simulation-status" className="text-[10px] text-text-secondary" aria-live="polite">
              {simStatus === "loading"
                ? "NEC calculation running…"
                : simStatus === "success"
                  ? `${simResult?.frequency_data.length ?? 0} frequency points calculated`
                  : simStatus === "error"
                    ? "NEC calculation failed"
                    : "Ready to validate and calculate"}
            </p>
            <Button
              onClick={handleRunSimulation}
              loading={isLoading}
              disabled={isLoading || !canRun || !validation.valid}
              className="w-full"
              size="sm"
            >
              {isLoading ? "Simulating..." : "Run Simulation"}
            </Button>
            {simError && (
              <p className="text-[10px] text-swr-bad px-0.5">{simError}</p>
            )}
          </div>
        </aside>
      </div>

      {/* === DESKTOP ANALYSIS WORKSPACE === */}
      <section
        id="wire-editor-analysis"
        data-testid="wire-editor-analysis"
        className="hidden min-h-[760px] flex-col border-t border-border bg-surface lg:flex"
        aria-label="Wire Editor analysis and calculated results"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Analysis and calculated results</h2>
            <p className="mt-0.5 text-xs text-text-secondary">
              SWR, impedance, Smith chart, radiation cuts, gain, band analysis and matching for the current Wire Editor model.
            </p>
          </div>
          <span className="rounded border border-border bg-background px-2 py-1 text-[10px] font-mono text-text-secondary" aria-live="polite">
            {simStatus === "success"
              ? `${simResult?.frequency_data.length ?? 0} solved point${(simResult?.frequency_data.length ?? 0) === 1 ? "" : "s"}`
              : simStatus === "loading"
                ? "Calculating…"
                : simStatus === "error"
                  ? "Calculation failed"
                  : "Awaiting calculation"}
          </span>
          <button
            type="button"
            onClick={scrollToEditor}
            className="rounded border border-border bg-background px-3 py-1.5 text-xs font-medium text-text-secondary hover:border-accent/50 hover:text-accent"
          >
            Back to editor
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <ErrorBoundary label="Wire Editor analysis results">
            <ResultsPanel compactRadiationCuts />
          </ErrorBoundary>
        </div>
      </section>

      {/* === MOBILE BOTTOM SHEET === */}
      <div className="lg:hidden border-t border-border bg-surface flex flex-col max-h-[50%]">
        {/* Tab bar + Run button + quick actions */}
        <div className="px-2 pt-2 pb-1 shrink-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="flex-1 overflow-x-auto">
              <SegmentedControl
                segments={MOBILE_SEGMENTS}
                activeKey={mobileTab}
                onChange={(key) => setMobileTab(key as MobileEditorTab)}
              />
            </div>
            <Button
              onClick={handleRunSimulation}
              loading={isLoading}
              disabled={isLoading || !canRun || !validation.valid}
              size="sm"
              className="shrink-0"
            >
              {isLoading ? "..." : "Run"}
            </Button>
          </div>
          {/* Quick operations bar */}
          <div className="flex items-center gap-1">
            <button onClick={undo} className="px-2 py-1 text-[11px] rounded border border-border text-text-secondary hover:bg-surface-hover" title="Undo">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10h13a4 4 0 010 8H7" /><path d="M3 10l4-4M3 10l4 4" /></svg>
            </button>
            <button onClick={redo} className="px-2 py-1 text-[11px] rounded border border-border text-text-secondary hover:bg-surface-hover" title="Redo">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10H8a4 4 0 000 8h10" /><path d="M21 10l-4-4M21 10l-4 4" /></svg>
            </button>
            <button onClick={deleteSelected} disabled={selectedTags.size === 0} className="px-2 py-1 text-[11px] rounded border border-border text-text-secondary hover:bg-surface-hover disabled:opacity-30" title="Delete selected">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6l-1 14H6L5 6M8 6V4h8v2" /></svg>
            </button>
            <button onClick={selectAll} className="px-2 py-1 text-[11px] rounded border border-border text-text-secondary hover:bg-surface-hover" title="Select all">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 12l2 2 4-4" /></svg>
            </button>
            <div className="flex-1" />
            <span className="text-[11px] text-text-secondary font-mono">
              {wires.length}W {totalSegments}S
            </span>
          </div>
        </div>
        {simError && (
          <p className="text-xs text-swr-bad px-3 pb-1">{simError}</p>
        )}
        {/* Tab content */}
        <div className="px-3 py-2 flex-1 overflow-y-auto">
          {mobileTab === "wires" && <WireTable />}
          {mobileTab === "properties" && <WirePropertiesPanel />}
          {mobileTab === "settings" && (
            <div className="space-y-3">
              {/* Antenna height */}
              {wires.length > 0 && (
                <Slider
                  label="Antenna Height"
                  value={antennaHeightValue}
                  min={1}
                  max={100}
                  step={1}
                  unit={activeHeightUnit}
                  unitOptions={heightUnitOptions}
                  onUnitChange={handleHeightUnitChange}
                  decimals={heightUnitDecimals}
                  description={antennaHeightDescription}
                  onChange={handleDisplayedHeightChange}
                />
              )}
              {/* Design frequency */}
              <NumberInput
                label="Design freq:"
                value={designFrequencyMhz}
                onChange={setDesignFrequency}
                min={MIN_FREQUENCY_MHZ}
                max={MAX_FREQUENCY_MHZ}
                decimals={3}
                unit="MHz"
                size="sm"
              />
              {/* Band presets (multi-select) */}
              <BandPresets
                currentRange={frequencyRange}
                onSelectBand={handleBandSelect}
                segments={frequencySegments}
                onToggleBand={handleToggleBand}
                hfOnly
              />
              {/* Frequency sweep / segments */}
              <FrequencySegmentEditor
                frequencyRange={frequencyRange}
                onFrequencyRangeChange={setFrequencyRange}
                segments={frequencySegments}
                onSegmentsChange={setFrequencySegments}
                size="sm"
              />
              {/* Matching / Balun — near band presets for discoverability */}
              <BalunEditor matching={matching} onChange={setMatching} />
              {/* Snap size */}
              <div>
                <label className="text-[11px] text-text-secondary font-semibold uppercase tracking-wider block mb-1">Snap Size</label>
                <select value={snapSize} onChange={(e) => setSnapSize(parseFloat(e.target.value))}
                  className="w-full bg-background text-text-primary text-xs font-mono px-1.5 py-1.5 rounded border border-border outline-none">
                  <option value="0">Off</option>
                  <option value="0.001">0.001 m (1 mm)</option>
                  <option value="0.005">0.005 m (5 mm)</option>
                  <option value="0.01">0.01 m</option>
                  <option value="0.05">0.05 m</option>
                  <option value="0.1">0.1 m</option>
                  <option value="0.25">0.25 m</option>
                  <option value="0.5">0.5 m</option>
                  <option value="1">1.0 m</option>
                </select>
              </div>
              {/* Pattern resolution */}
              <div>
                <label className="text-[11px] text-text-secondary font-semibold uppercase tracking-wider block mb-1">Pattern Resolution</label>
                <select value={patternStep} onChange={(e) => setPatternStep(parseInt(e.target.value, 10))}
                  className="w-full bg-background text-text-primary text-xs font-mono px-1.5 py-1.5 rounded border border-border outline-none">
                  <option value="1">1 deg (very fine)</option>
                  <option value="2">2 deg (fine)</option>
                  <option value="5">5 deg (standard)</option>
                  <option value="10">10 deg (fast)</option>
                </select>
              </div>
              <GroundEditor ground={ground} onChange={setGround} />
              <GeometryGroundEditor
                value={geometryGroundFlag}
                effectiveValue={effectiveGeometryGroundFlag}
                onChange={setGeometryGroundFlag}
              />
            </div>
          )}
          {mobileTab === "tools" && (
            <div className="space-y-3">
              {/* Templates */}
              <div>
                <h4 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Load Template</h4>
                <TemplatePicker selectedId={selectedTemplate.id} onSelect={handleTemplateSelect} />
                <div className="mt-2">
                  <ParameterPanel parameters={selectedTemplate.parameters} values={templateParams} onParamChange={handleTemplateParamChange} />
                </div>
                {wires.length > 0 && (
                  <p className="text-[11px] text-swr-warning leading-tight mt-1.5">Replaces all current wires.</p>
                )}
                <Button onClick={handleLoadTemplate} className="w-full mt-2" size="sm">Load into Editor</Button>
              </div>
              <div className="border-t border-border" />
              <TransformPanel />
              <div className="border-t border-border" />
              {/* Import/Export */}
              <div>
                <h4 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Import / Export</h4>
                <ImportExportPanel />
              </div>
              <div className="border-t border-border" />
              {/* Compare */}
              <div>
                <h4 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Compare</h4>
                <CompareOverlay />
              </div>
              <div className="border-t border-border" />
              {/* Optimizer */}
              <div>
                <h4 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Optimizer</h4>
                <OptimizerPanel />
              </div>
            </div>
          )}
          {mobileTab === "results" && <ResultsPanel />}
        </div>
      </div>

      {/* Status bar (desktop only) */}
      <div className="hidden lg:flex items-center justify-between px-3 h-6 border-t border-border bg-surface text-[10px] font-mono text-text-secondary shrink-0">
        <div className="flex items-center gap-3">
          <span>
            Mode: <span className="text-accent">{mode}</span>
          </span>
          <span>Wires: {wires.length}</span>
          <span>Segments: {totalSegments}</span>
          {wires.length > 0 && (
            <span>
              Height: {antennaMinZ.toFixed(3)}–{antennaMaxZ.toFixed(3)}m
            </span>
          )}
          <span>
            Snap: {snapSize > 0 ? `${snapSize}m` : "Off"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span>
            Design: {designFrequencyMhz} MHz | Sweep: {frequencyRange.start_mhz}–{frequencyRange.stop_mhz} MHz
          </span>
          {selectedTags.size > 0 && (
            <span className="text-accent">
              {selectedTags.size} selected
            </span>
          )}
        </div>
      </div>

      {/* Full-page simulation loading overlay — blocks all interaction */}
      {isLoading && <SimulationLoadingOverlay />}
    </div>
  );
}
