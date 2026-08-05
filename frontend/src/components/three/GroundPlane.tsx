import { useMemo } from "react";
import { Grid } from "@react-three/drei";
import type { WireData } from "./types";
import { useUIStore } from "../../stores/uiStore";
import { getGroundGridMetrics } from "./ground-grid";

/**
 * Ground plane visualization with auto-sizing grid at Y=0.
 * Grid extends at least 2x the antenna's horizontal footprint.
 * Grid cell size adapts to antenna scale.
 */

interface GroundPlaneProps {
  /** Wire data for computing grid extents */
  wires?: WireData[];
}

export function GroundPlane({ wires = [] }: GroundPlaneProps) {
  const theme = useUIStore((s) => s.theme);
  const isDark = theme === "dark";

  const { gridSize, cellSize, sectionSize, fadeDistance } = useMemo(
    () => getGroundGridMetrics(wires),
    [wires],
  );

  return (
    <group>
      {/* Main grid */}
      <Grid
        position={[0, 0, 0]}
        args={[gridSize, gridSize]}
        cellSize={cellSize}
        cellThickness={0.5}
        cellColor={isDark ? "#1A1A24" : "#C0C0C8"}
        sectionSize={sectionSize}
        sectionThickness={1}
        sectionColor={isDark ? "#2A2A35" : "#9090A0"}
        fadeDistance={fadeDistance}
        fadeStrength={1.5}
        infiniteGrid
      />
      {/* Semi-transparent ground surface — offset below grid to prevent z-fighting */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -gridSize * 0.0025, 0]}>
        <planeGeometry args={[gridSize * 2, gridSize * 2]} />
        <meshStandardMaterial
          color={isDark ? "#1a2a1a" : "#90a890"}
          transparent
          opacity={isDark ? 0.15 : 0.1}
          roughness={1}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
