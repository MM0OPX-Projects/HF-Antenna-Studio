import { Canvas } from "@react-three/fiber";
import { useMemo, useState } from "react";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import type { SegmentCurrent } from "../../api/nec";
import { AntennaModel } from "../../components/three/AntennaModel";
import { AxesHelper } from "../../components/three/AxesHelper";
import { CameraControls } from "../../components/three/CameraControls";
import { CurrentDistribution3D } from "../../components/three/CurrentDistribution3D";
import { GroundPlane } from "../../components/three/GroundPlane";
import { createVisualScale } from "../../components/three/visualScale";
import type { WireData } from "../../components/three/types";
import { useUIStore } from "../../stores/uiStore";
import { CurrentVisualisationControls } from "./CurrentVisualisationControls";
import type { CurrentVisualData, CurrentVisualMode } from "./types";

export function CurrentVisualisationPanel({ data, title = "NEC current distribution", testId = "current-visualisation-panel" }: { data: CurrentVisualData; title?: string; testId?: string }) {
  const theme = useUIStore((state) => state.theme);
  const [mode, setMode] = useState<CurrentVisualMode>("magnitude");
  const [animated, setAnimated] = useState(false);
  const [selected, setSelected] = useState<SegmentCurrent | null>(null);
  const effectiveSelected = selected && data.currents.includes(selected) ? selected : null;
  const wires = useMemo<WireData[]>(() => data.wires.map((wire) => ({ tag: wire.tag, x1: wire.startM.x, y1: wire.startM.y, z1: wire.startM.z, x2: wire.endM.x, y2: wire.endM.y, z2: wire.endM.z, radius: wire.radiusM ?? 0.001, segments: Math.max(1, data.currents.filter((current) => current.tag === wire.tag).length) })), [data]);
  const renderableWires = useMemo(() => wires.filter((wire) => Math.hypot(wire.x2 - wire.x1, wire.y2 - wire.y1, wire.z2 - wire.z1) > 1e-9), [wires]);
  const visualScale = useMemo(() => createVisualScale(wires), [wires]);
  const background = theme === "dark" ? "#07111f" : "#e8e8ed";
  const gl = useMemo(() => ({ antialias: true, toneMapping: ACESFilmicToneMapping, outputColorSpace: SRGBColorSpace }), []);
  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-3" data-testid={testId} data-current-source={data.source} data-current-count={data.currents.length}>
      <div><h2 className="text-sm font-semibold">{title}</h2><p className="text-[10px] text-text-secondary">Every sample shown is a parsed NEC segment-current result; no textbook current shape is substituted.</p></div>
      <CurrentVisualisationControls currents={data.currents} mode={mode} animated={animated} selected={effectiveSelected} onModeChange={setMode} onAnimatedChange={setAnimated} onSelect={setSelected} />
      <div className="h-80 overflow-hidden rounded-md" data-testid={`${testId}-3d`}>
        <Canvas gl={gl} camera={{ position: [10, 8, 10], fov: 48, near: 0.05, far: 1000 }} style={{ background }} dpr={[1, 1.5]}>
          <color attach="background" args={[background]} />
          <ambientLight intensity={theme === "dark" ? 0.55 : 0.8} />
          <directionalLight position={[12, 18, 8]} intensity={1.1} />
          <GroundPlane wires={wires} />
          <AxesHelper />
          {renderableWires.map((wire) => <AntennaModel key={wire.tag} wire={wire} visualScale={visualScale} dimmed />)}
          <CurrentDistribution3D currents={data.currents} mode={mode} animated={animated} selected={effectiveSelected} onSelect={setSelected} tubeRadius={visualScale.currentRadius} particleRadius={visualScale.particleRadius} />
          <CameraControls wires={wires} hasGround />
        </Canvas>
      </div>
    </section>
  );
}
