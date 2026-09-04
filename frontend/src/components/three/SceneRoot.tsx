import { Suspense, useMemo, useRef, useState } from "react";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import { GroundPlane } from "./GroundPlane";
import { CompassRose } from "./CompassRose";
import { AxesHelper } from "./AxesHelper";
import { AntennaModel, JunctionSpheres } from "./AntennaModel";
import { FeedpointMarker } from "./FeedpointMarker";
import { NonRadiatingLines } from "./NonRadiatingLines";
import type { NonRadiatingSegment } from "./transmissionLineViz";
import { CameraControls } from "./CameraControls";
import { PostProcessing } from "./PostProcessing";
import { RadiationPattern3D } from "./RadiationPattern3D";
import { VolumetricShells } from "./VolumetricShells";
import { patternOriginForGeometry } from "./pattern-origin";
import { GroundReflection } from "./GroundReflection";
import { CurrentDistribution3D } from "./CurrentDistribution3D";
import { NearFieldPlane } from "./NearFieldPlane";
import { RadiationSlice } from "./RadiationSlice";
import { SceneRaycaster } from "./SceneRaycaster";
import { WireMeasurementOverlay3D } from "./WireMeasurementOverlay3D";
import type { WireData, FeedpointData, ViewToggles } from "./types";
import type { PatternData, SegmentCurrent, NearFieldResult } from "../../api/nec";
import { useUIStore } from "../../stores/uiStore";
import { createVisualScale } from "./visualScale";
import type { WireMeasurementPointMode } from "../../utils/wire-measurement";
import { CurrentVisualisationControls } from "../../features/current-visualisation/CurrentVisualisationControls";
import type { CurrentVisualMode } from "../../features/current-visualisation/types";
import { SafeCanvas } from "./SafeCanvas";

interface SceneRootProps {
  wires: WireData[];
  feedpoints: FeedpointData[];
  viewToggles: ViewToggles;
  /** Non-radiating structures (e.g. transmission-line feeders) drawn dashed */
  nonRadiatingLines?: NonRadiatingSegment[];
  /** Radiation pattern data to render as 3D mesh */
  patternData?: PatternData | null;
  /** V2: Current distribution data */
  currents?: SegmentCurrent[] | null;
  /** V2: Near-field visualization data */
  nearField?: NearFieldResult | null;
  measurementActive?: boolean;
  measurementSelectedTags?: readonly number[];
  measurementPointMode?: WireMeasurementPointMode;
  onMeasurementWireSelect?: (tag: number) => void;
}

export function SceneRoot({
  wires,
  feedpoints,
  viewToggles,
  nonRadiatingLines,
  patternData,
  currents,
  nearField,
  measurementActive = false,
  measurementSelectedTags = [],
  measurementPointMode = "closest",
  onMeasurementWireSelect,
}: SceneRootProps) {
  const theme = useUIStore((s) => s.theme);
  const sceneBg = theme === "dark" ? "#0A0A0F" : "#E8E8ED";
  const fogColor = theme === "dark" ? "#0A0A0F" : "#E8E8ED";
  const [currentMode, setCurrentMode] = useState<CurrentVisualMode>("magnitude");
  const [currentAnimated, setCurrentAnimated] = useState(false);
  const [selectedCurrent, setSelectedCurrent] = useState<SegmentCurrent | null>(null);
  const effectiveSelectedCurrent = selectedCurrent && currents?.includes(selectedCurrent) ? selectedCurrent : null;

  // Dim wires when current/flow overlays are active so the colors show through
  const wiresDimmed = viewToggles.current && !!currents && currents.length > 0;
  const visualScale = useMemo(() => createVisualScale(wires), [wires]);

  // Tooltip ref — direct DOM mutation, no React state
  const tooltipRef = useRef<HTMLDivElement>(null);

  const glConfig = useMemo(
    () => ({
      antialias: true,
      preserveDrawingBuffer: true,
      toneMapping: ACESFilmicToneMapping,
      outputColorSpace: SRGBColorSpace,
      toneMappingExposure: 1.0,
    }),
    []
  );

  // Compute a visual-only pattern reference at the lowest physical antenna
  // point, never at the feedpoint. NEC far-field results have no emission
  // origin; this avoids a misleading detached bubble for centre-fed models.
  const antennaCentroid = useMemo((): [number, number, number] => {
    return patternOriginForGeometry(wires) ?? [0, 0, 0];
  }, [wires]);

  return (
    <>
    <SafeCanvas
      gl={glConfig}
      camera={{ position: [15, 12, 15], fov: 50, near: 0.1, far: 500 }}
      style={{ background: sceneBg, cursor: measurementActive ? "crosshair" : undefined }}
    >
      {/* Scene background as Three.js Color so it appears in screenshots */}
      <color attach="background" args={[sceneBg]} />
      <Suspense fallback={null}>
        {/* Lighting */}
        <ambientLight intensity={theme === "dark" ? 0.3 : 0.5} />
        <directionalLight
          position={[20, 30, 10]}
          intensity={theme === "dark" ? 0.7 : 0.8}
          castShadow={false}
        />

        {/* Fog for depth perception */}
        <fog
          attach="fog"
          args={[fogColor, visualScale.fogNear, visualScale.fogFar]}
        />

        {/* Ground — auto-sized to antenna footprint */}
        {viewToggles.grid && <GroundPlane wires={wires} />}

        {/* Compass Rose */}
        {viewToggles.compass && <CompassRose radius={visualScale.span * 2} />}

        {/* Axes */}
        <AxesHelper />

        {/* Antenna Wires */}
        {viewToggles.wires &&
          wires.map((wire) => (
            <AntennaModel
              key={wire.tag}
              wire={wire}
              visualScale={visualScale}
              dimmed={wiresDimmed}
              measurementOrder={
                measurementSelectedTags[0] === wire.tag
                  ? 1
                  : measurementSelectedTags[1] === wire.tag
                    ? 2
                    : undefined
              }
              onMeasurementSelect={
                measurementActive ? onMeasurementWireSelect : undefined
              }
            />
          ))}

        {measurementActive && (
          <WireMeasurementOverlay3D
            wires={wires}
            selectedTags={measurementSelectedTags}
            pointMode={measurementPointMode}
            visualScale={visualScale}
          />
        )}

        {/* Wire junction spheres */}
        {viewToggles.wires && (
          <JunctionSpheres wires={wires} visualScale={visualScale} dimmed={wiresDimmed} />
        )}

        {/* Feedpoints */}
        {viewToggles.wires &&
          feedpoints.map((fp, i) => (
            <FeedpointMarker key={i} position={fp.position} radius={visualScale.markerRadius} />
          ))}

        {/* Non-radiating structures (transmission-line feeders) drawn dashed */}
        {viewToggles.wires && nonRadiatingLines && nonRadiatingLines.length > 0 && (
          <NonRadiatingLines
            segments={nonRadiatingLines}
            dashSize={visualScale.dashSize}
            gapSize={visualScale.gapSize}
          />
        )}

        {/* 3D Radiation Pattern — surface mode */}
        {viewToggles.pattern && !viewToggles.volumetric && patternData && (
          <RadiationPattern3D
            pattern={patternData}
            scale={visualScale.patternScale}
            opacity={0.65}
            center={antennaCentroid}
          />
        )}

        {/* Volumetric pattern shells — alternative to surface */}
        {viewToggles.volumetric && patternData && (
          <VolumetricShells
            pattern={patternData}
            scale={visualScale.patternScale}
            center={antennaCentroid}
          />
        )}

        {/* Ground Reflection (ghost mirror) */}
        {viewToggles.reflection && (
          <GroundReflection wires={wires} visualScale={visualScale} />
        )}

        {/* Current Distribution overlay */}
        {viewToggles.current && currents && currents.length > 0 && (
          <CurrentDistribution3D
            currents={currents}
            mode={currentMode}
            animated={currentAnimated}
            selected={effectiveSelectedCurrent}
            onSelect={setSelectedCurrent}
            tubeRadius={visualScale.currentRadius}
            particleRadius={visualScale.particleRadius}
          />
        )}

        {/* Near-field heatmap plane */}
        {viewToggles.nearField && nearField && (
          <NearFieldPlane data={nearField} />
        )}

        {/* Radiation pattern slice animation */}
        {viewToggles.slice && patternData && (
          <RadiationSlice
            pattern={patternData}
            scale={visualScale.patternScale}
            center={antennaCentroid}
          />
        )}

        {/* Camera — auto-frames to antenna bounding box */}
        <CameraControls wires={wires} hasGround={viewToggles.grid} />

        {/* Post-processing */}
        <PostProcessing />

        {/* 3D hover measurement raycaster */}
        {!measurementActive && <SceneRaycaster tooltipRef={tooltipRef} />}
      </Suspense>
    </SafeCanvas>
    {viewToggles.current && currents && currents.length > 0 && (
      <div className="absolute left-2 top-2 z-20 max-w-[min(620px,calc(100%-1rem))]" data-testid="viewport-current-visualisation">
        <CurrentVisualisationControls currents={currents} mode={currentMode} animated={currentAnimated} selected={effectiveSelectedCurrent} onModeChange={setCurrentMode} onAnimatedChange={setCurrentAnimated} onSelect={setSelectedCurrent} compact />
      </div>
    )}
    <div
      ref={tooltipRef}
      className="fixed z-50 pointer-events-none bg-surface/95 backdrop-blur-sm border border-border rounded-md px-2.5 py-1.5 shadow-lg text-[11px] font-mono leading-relaxed whitespace-nowrap"
      style={{ display: "none" }}
    />
    </>
  );
}
