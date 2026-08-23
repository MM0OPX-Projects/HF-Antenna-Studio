import { Grid, Line, OrbitControls } from "@react-three/drei";
import { useMemo } from "react";
import { SafeCanvas } from "../../components/three/SafeCanvas";
import type { VerticalWire } from "./schema";

function Scene({ wires }: { wires: VerticalWire[] }) {
  const bounds = useMemo(() => {
    const points = wires.flatMap((wire) => [wire.startM, wire.endM]);
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const minZ = Math.min(...points.map((point) => point.z));
    const maxZ = Math.max(...points.map((point) => point.z));
    const centre = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 };
    return { centre, scale: 5 / Math.max(maxX - minX, maxY - minY, maxZ - minZ, 0.1) };
  }, [wires]);
  const map = (point: { x: number; y: number; z: number }): [number, number, number] => [
    (point.x - bounds.centre.x) * bounds.scale,
    (point.z - bounds.centre.z) * bounds.scale + 2.5,
    (point.y - bounds.centre.y) * bounds.scale,
  ];
  return <>
    <ambientLight intensity={1.25} />
    <directionalLight position={[4, 8, 5]} intensity={2} />
    <Grid args={[11, 11]} cellColor="#2dd4bf" sectionColor="#0f766e" fadeDistance={11} />
    {wires.map((wire) => <Line key={wire.id} points={[map(wire.startM), map(wire.endM)]} color={wire.family === "radiator" ? "#fb923c" : "#22d3ee"} lineWidth={wire.family === "radiator" ? 5 : 2.5} />)}
    <mesh position={map(wires[0]!.startM)}><sphereGeometry args={[0.13, 18, 18]} /><meshStandardMaterial color="#60a5fa" emissive="#1d4ed8" emissiveIntensity={0.55} /></mesh>
    <OrbitControls makeDefault enablePan={false} minDistance={3} maxDistance={13} />
  </>;
}

export function VerticalGeometry3D({ wires, modelKey }: { wires: VerticalWire[]; modelKey: string }) {
  return <div className="relative h-80 overflow-hidden rounded-md bg-[#07111f]" data-testid="vertical-geometry-3d" data-model-key={modelKey} data-wire-count={wires.length}>
    <span className="sr-only">Interactive vertical antenna geometry. Orange is the radiator, cyan marks explicit radial wires, and blue marks the feed.</span>
    <SafeCanvas camera={{ position: [6, 4.5, 7], fov: 43 }} dpr={[1, 1.5]}><Scene wires={wires} /></SafeCanvas>
    <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-[10px] text-slate-200">Orange: radiator · cyan: explicit radials · blue: feed · drag to orbit</div>
  </div>;
}
