import { Grid, Line, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import type { YagiWire } from "./schema";

function Scene({ wires }: { wires: YagiWire[] }) {
  const bounds = useMemo(() => {
    const points = wires.flatMap((wire) => [wire.startM, wire.endM]);
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const centre = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    return { centre, scale: 6 / Math.max(maxX - minX, maxY - minY, 0.1) };
  }, [wires]);
  const map = (point: { x: number; y: number; z: number }): [number, number, number] => [(point.x - bounds.centre.x) * bounds.scale, 2.5, (point.y - bounds.centre.y) * bounds.scale];
  const yValues = wires.map((wire) => map(wire.startM)[2]);
  const boomStart: [number, number, number] = [0, 2.5, Math.min(...yValues)];
  const boomEnd: [number, number, number] = [0, 2.5, Math.max(...yValues) + 0.8];
  const colour = (family: YagiWire["family"]) => family === "reflector" ? "#a855f7" : family === "driven" ? "#fb923c" : "#22d3ee";
  return <>
    <ambientLight intensity={1.25} /><directionalLight position={[4, 8, 5]} intensity={2} />
    <Grid args={[12, 12]} cellColor="#334155" sectionColor="#0f766e" fadeDistance={12} />
    <Line points={[boomStart, boomEnd]} color="#64748b" lineWidth={2} dashed dashSize={0.12} gapSize={0.08} />
    {wires.map((wire) => <Line key={wire.id} points={[map(wire.startM), map(wire.endM)]} color={colour(wire.family)} lineWidth={wire.family === "driven" ? 5 : 3} />)}
    <mesh position={map(wires.find((wire) => wire.family === "driven")!.startM).map((value, index) => index === 0 ? 0 : value) as [number, number, number]}><sphereGeometry args={[0.12, 18, 18]} /><meshStandardMaterial color="#60a5fa" emissive="#1d4ed8" emissiveIntensity={0.5} /></mesh>
    <Line points={[[0, 2.5, boomEnd[2] - 0.6], [0, 2.5, boomEnd[2]]]} color="#facc15" lineWidth={4} />
    <OrbitControls makeDefault enablePan={false} minDistance={3} maxDistance={13} />
  </>;
}

export function YagiGeometry3D({ wires, modelKey }: { wires: YagiWire[]; modelKey: string }) {
  return <div className="relative h-80 overflow-hidden rounded-md bg-[#07111f]" data-testid="yagi-geometry-3d" data-model-key={modelKey} data-wire-count={wires.length}>
    <span className="sr-only">Interactive Yagi geometry. Purple is the reflector, orange is the driven element, cyan marks directors, and yellow shows the intended forward direction.</span>
    <Canvas camera={{ position: [7, 6, 7], fov: 43 }} dpr={[1, 1.5]}><Scene wires={wires} /></Canvas>
    <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-[10px] text-slate-200">Reflector: purple · driven: orange · directors: cyan · forward +Y: yellow</div>
  </div>;
}
