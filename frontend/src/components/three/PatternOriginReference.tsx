import { Line } from "@react-three/drei";

export function PatternOriginReference({ center, radius }: { center: [number, number, number]; radius: number }) {
  const circle = Array.from({ length: 65 }, (_, index) => {
    const angle = index / 64 * Math.PI * 2;
    return [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] as [number, number, number];
  });
  const color = "#A78BFA";
  return <group position={center}>
    <Line points={circle} color={color} transparent opacity={0.34} lineWidth={1} />
    <Line points={[[-radius, 0, 0], [radius, 0, 0]]} color={color} transparent opacity={0.24} lineWidth={1} />
    <Line points={[[0, 0, -radius], [0, 0, radius]]} color={color} transparent opacity={0.24} lineWidth={1} />
  </group>;
}
