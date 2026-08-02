import { Canvas } from "@react-three/fiber";
import { Grid, Line, OrbitControls } from "@react-three/drei";
import { useMemo } from "react";
import type { TemplateAntennaModel } from "./schema";
import { feedPointCoordinates } from "./model";

function Geometry({ model }: { model: TemplateAntennaModel }) {
  const geometry = useMemo(() => {
    const points = model.wires.flatMap((wire) => [wire.startM, wire.endM]);
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const minZ = Math.min(...points.map((point) => point.z));
    const maxZ = Math.max(...points.map((point) => point.z));
    const centre = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 };
    const extent = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 0.1);
    return { centre, scale: 4.5 / extent, feed: feedPointCoordinates(model) };
  }, [model]);
  const mapPoint = (point: { x: number; y: number; z: number }): [number, number, number] => [
    (point.x - geometry.centre.x) * geometry.scale,
    (point.z - geometry.centre.z) * geometry.scale + 2.4,
    (point.y - geometry.centre.y) * geometry.scale,
  ];
  return <>
    <ambientLight intensity={1.2} />
    <directionalLight position={[4, 7, 4]} intensity={2} />
    <Grid args={[10, 10]} cellColor="#2dd4bf" sectionColor="#0f766e" fadeDistance={10} />
    {model.wires.map((wire) => <Line key={wire.id} points={[mapPoint(wire.startM), mapPoint(wire.endM)]} color="#fb923c" lineWidth={4} />)}
    <mesh position={mapPoint(geometry.feed)}><sphereGeometry args={[0.13, 18, 18]} /><meshStandardMaterial color="#60a5fa" emissive="#1d4ed8" emissiveIntensity={0.5} /></mesh>
    <OrbitControls makeDefault enablePan={false} minDistance={3} maxDistance={12} />
  </>;
}

export function TemplateGeometry3D({ model }: { model: TemplateAntennaModel }) {
  const totalWireLengthM = model.wires.reduce((total, wire) => total + Math.hypot(
    wire.endM.x - wire.startM.x,
    wire.endM.y - wire.startM.y,
    wire.endM.z - wire.startM.z,
  ), 0);
  return <div className="relative h-80 overflow-hidden rounded-md bg-[#07111f]" data-testid="template-geometry-3d" data-template-id={model.template.id} data-total-wire-length-m={totalWireLengthM.toFixed(4)}>
    <span className="sr-only">Interactive three-dimensional geometry for {model.name}. The blue marker is the feed point.</span>
    <Canvas camera={{ position: [5, 4, 6], fov: 43 }} dpr={[1, 1.5]}><Geometry model={model} /></Canvas>
    <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/55 px-2 py-1 text-[10px] text-slate-200">Orange: wire · blue: feed · drag to orbit</div>
  </div>;
}
