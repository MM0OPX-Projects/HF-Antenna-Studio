import { useEffect, useMemo } from "react";
import { CanvasTexture } from "three";
import { useUIStore } from "../../stores/uiStore";

function CardinalLabel({
  text,
  color,
  position,
  size,
}: {
  text: string;
  color: string;
  position: [number, number, number];
  size: number;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = color;
    context.font = "700 88px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width / 2, canvas.height / 2 + 3);
    return new CanvasTexture(canvas);
  }, [color, text]);

  useEffect(() => () => texture?.dispose(), [texture]);
  if (!texture) return null;

  return (
    <sprite position={position} scale={[size * 1.8, size * 1.8, 1]} renderOrder={2}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}

/**
 * Compass rose on the ground plane showing N/S/E/W with degree markings.
 */
interface CompassRoseProps {
  radius?: number;
}

export function CompassRose({ radius = 20 }: CompassRoseProps) {
  const theme = useUIStore((s) => s.theme);
  const isDark = theme === "dark";

  const labelOffset = radius * 0.075;
  const fontSize = radius * 0.06;
  const ringWidth = radius * 0.0025;
  const secondaryColor = isDark ? "#8888A0" : "#505068";
  const labels = useMemo(
    () => [
      { text: "N", angle: 0, color: "#EF4444" },
      { text: "E", angle: 90, color: secondaryColor },
      { text: "S", angle: 180, color: secondaryColor },
      { text: "W", angle: 270, color: secondaryColor },
    ],
    [secondaryColor]
  );

  const tickMarks = useMemo(() => {
    const ticks: { angle: number; length: number }[] = [];
    for (let deg = 0; deg < 360; deg += 30) {
      if (deg % 90 !== 0) {
        ticks.push({ angle: deg, length: 0.8 });
      }
    }
    return ticks;
  }, []);

  return (
    <group position={[0, radius * 0.001, 0]}>
      {/* Cardinal direction labels */}
      {labels.map(({ text, angle, color }) => {
        const rad = (angle * Math.PI) / 180;
        // NEC2: Y=north, X=east. Three.js: X=east, Z=south(=-north)
        const x = Math.sin(rad) * (radius + labelOffset);
        const z = -Math.cos(rad) * (radius + labelOffset);
        return (
          <CardinalLabel
            key={text}
            position={[x, radius * 0.0025, z]}
            size={fontSize}
            color={color}
            text={text}
          />
        );
      })}

      {/* Circle ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, radius * 0.0005, 0]}>
        <ringGeometry args={[radius - ringWidth, radius + ringWidth, 64]} />
        <meshBasicMaterial color={isDark ? "#2A2A35" : "#9090A0"} transparent opacity={0.6} />
      </mesh>

      {/* 30-degree tick marks */}
      {tickMarks.map(({ angle, length }) => {
        const rad = (angle * Math.PI) / 180;
        const innerR = radius - length * radius * 0.04;
        const x1 = Math.sin(rad) * innerR;
        const z1 = -Math.cos(rad) * innerR;
        const x2 = Math.sin(rad) * radius;
        const z2 = -Math.cos(rad) * radius;
        return (
          <line key={angle}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[new Float32Array([x1, radius * 0.001, z1, x2, radius * 0.001, z2]), 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial color={isDark ? "#2A2A35" : "#9090A0"} transparent opacity={0.6} />
          </line>
        );
      })}
    </group>
  );
}
