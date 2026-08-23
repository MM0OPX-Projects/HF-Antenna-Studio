import { Grid, Line, OrbitControls } from "@react-three/drei";
import { useMemo } from "react";
import { SafeCanvas } from "../../components/three/SafeCanvas";
import type { GeneratedPhasedArray, PhasedPoint3M } from "./schema";

function Scene({ generated }: { generated: GeneratedPhasedArray }) {
  const bounds = useMemo(() => {
    const points = generated.wires.flatMap((wire) => [wire.startM, wire.endM]);
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const zs = points.map((point) => point.z);
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), Math.max(...zs) - Math.min(...zs), 0.1);
    return { x: (Math.max(...xs) + Math.min(...xs)) / 2, y: (Math.max(...ys) + Math.min(...ys)) / 2, scale: 6 / span };
  }, [generated]);
  const map = (point: PhasedPoint3M): [number, number, number] => [(point.x - bounds.x) * bounds.scale, point.z * bounds.scale, (point.y - bounds.y) * bounds.scale];
  const colour = (family: string) => family === "element-1" ? "#fb923c" : family === "element-2" ? "#22d3ee" : family === "source-junction" ? "#facc15" : "#94a3b8";
  return <>
    <ambientLight intensity={1.25} /><directionalLight position={[4, 8, 5]} intensity={2} />
    <Grid args={[15, 15]} cellColor="#334155" sectionColor="#0f766e" fadeDistance={15} />
    {generated.wires.map((wire) => <Line key={wire.id} points={[map(wire.startM), map(wire.endM)]} color={colour(wire.family)} lineWidth={wire.family.startsWith("element") ? 5 : 2.2} />)}
    {generated.networkPaths.map((path) => <Line key={path.id} points={[map(path.fromM), map(path.toM)]} color="#e879f9" lineWidth={2.5} dashed dashSize={0.12} gapSize={0.08} />)}
    <OrbitControls makeDefault enablePan={false} minDistance={3} maxDistance={16} />
  </>;
}

export function PhasedArrayGeometry3D({ generated, modelKey }: { generated: GeneratedPhasedArray; modelKey: string }) {
  return <div className="relative h-96 overflow-hidden rounded-md bg-[#07111f]" data-testid="phased-array-geometry-3d" data-model-key={modelKey} data-wire-count={generated.wires.length}>
    <span className="sr-only">Interactive phased vertical array geometry. Orange is element one, cyan is element two, gray wires are explicit radials, yellow is the physical source junction, and dashed magenta paths are non-radiating ideal transmission lines.</span>
    <SafeCanvas camera={{ position: [7, 5, 8], fov: 43 }} dpr={[1, 1.5]}><Scene generated={generated} /></SafeCanvas>
    <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-[10px] text-slate-200">E1 orange · E2 cyan · radials gray · TL paths dashed magenta</div>
  </div>;
}
