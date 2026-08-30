import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { PatternData } from "../../api/nec";
import { normaliseGainGrid } from "./metrics";
import type { PatternDisplayMode } from "./types";
import { SafeCanvas } from "../../components/three/SafeCanvas";

interface HeightRadiation3DProps {
  pattern: PatternData | null;
  mode: PatternDisplayMode;
  pending: boolean;
}

function PatternSurface({ pattern, mode }: { pattern: PatternData; mode: PatternDisplayMode }) {
  const geometry = useMemo(() => {
    const output = new THREE.BufferGeometry();
    const values = mode === "normalised" ? normaliseGainGrid(pattern.gain_dbi) : pattern.gain_dbi;
    const vertices: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const color = new THREE.Color();
    const min = mode === "normalised" ? -40 : -30;
    const max = mode === "normalised" ? 0 : 12;

    for (let ti = 0; ti < pattern.theta_count; ti += 1) {
      const theta = (pattern.theta_start + ti * pattern.theta_step) * Math.PI / 180;
      for (let pi = 0; pi < pattern.phi_count; pi += 1) {
        const phi = (pattern.phi_start + pi * pattern.phi_step) * Math.PI / 180;
        const gain = values[ti]?.[pi] ?? min;
        const level = Math.max(0, Math.min(1, (gain - min) / (max - min)));
        const radius = 0.22 + level * 1.72;
        vertices.push(
          radius * Math.sin(theta) * Math.cos(phi),
          radius * Math.cos(theta),
          radius * Math.sin(theta) * Math.sin(phi),
        );
        color.setHSL(0.67 - level * 0.67, 0.9, 0.5);
        colors.push(color.r, color.g, color.b);
      }
    }
    for (let ti = 0; ti < pattern.theta_count - 1; ti += 1) {
      for (let pi = 0; pi < pattern.phi_count; pi += 1) {
        const nextPi = (pi + 1) % pattern.phi_count;
        const a = ti * pattern.phi_count + pi;
        const b = ti * pattern.phi_count + nextPi;
        const c = (ti + 1) * pattern.phi_count + pi;
        const d = (ti + 1) * pattern.phi_count + nextPi;
        indices.push(a, c, b, b, c, d);
      }
    }
    output.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    output.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    output.setIndex(indices);
    output.computeVertexNormals();
    return output;
  }, [mode, pattern]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} transparent opacity={0.9} roughness={0.6} metalness={0.05} />
    </mesh>
  );
}

export function HeightRadiation3D({ pattern, mode, pending }: HeightRadiation3DProps) {
  return (
    <div className="relative h-80 overflow-hidden rounded-md bg-[#07111f]" data-testid="radiation-pattern-3d">
      {pattern ? <SafeCanvas camera={{ position: [3.2, 2.5, 3.6], fov: 45 }} dpr={[1, 1.5]}>
        <ambientLight intensity={1.3} />
        <directionalLight position={[4, 6, 3]} intensity={2.1} />
        <PatternSurface pattern={pattern} mode={mode} />
        <axesHelper args={[2.2]} />
        <OrbitControls makeDefault enablePan={false} minDistance={2.7} maxDistance={8} />
      </SafeCanvas> : <div className="grid h-full place-items-center px-5 text-center text-sm text-slate-300">{pending ? "Pattern withheld while NEC calculates this height…" : "Radiation pattern appears after the first NEC calculation."}</div>}
      <span className="sr-only">Interactive three-dimensional radiation pattern. Drag to orbit and scroll to zoom.</span>
      <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/55 px-2 py-1 text-[10px] text-slate-200">3D {mode === "absolute" ? "absolute gain (dBi)" : "relative pattern (dB; peak = 0)"} · drag to orbit</div>
    </div>
  );
}
