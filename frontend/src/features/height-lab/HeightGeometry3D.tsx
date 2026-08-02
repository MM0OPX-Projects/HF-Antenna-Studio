import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";

interface HeightGeometry3DProps {
  heightWavelengths: number;
}

function Geometry({ heightWavelengths }: HeightGeometry3DProps) {
  const displayHeight = 0.3 + Math.min(2, heightWavelengths) * 1.15;
  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[3, 6, 4]} intensity={2} />
      <Grid args={[8, 8]} cellColor="#2dd4bf" sectionColor="#0f766e" fadeDistance={9} position={[0, 0, 0]} />
      <mesh position={[0, displayHeight, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, 4.5, 18]} />
        <meshStandardMaterial color="#fb923c" emissive="#7c2d12" emissiveIntensity={0.22} />
      </mesh>
      <mesh position={[0, displayHeight, 0]}>
        <sphereGeometry args={[0.12, 20, 20]} />
        <meshStandardMaterial color="#60a5fa" emissive="#1d4ed8" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, displayHeight / 2, 0]}>
        <cylinderGeometry args={[0.014, 0.014, displayHeight, 10]} />
        <meshStandardMaterial color="#94a3b8" transparent opacity={0.55} />
      </mesh>
      <OrbitControls makeDefault enablePan={false} minDistance={3.5} maxDistance={10} />
    </>
  );
}

export function HeightGeometry3D(props: HeightGeometry3DProps) {
  return (
    <div className="relative h-64 overflow-hidden rounded-md bg-[#07111f]" data-testid="geometry-3d" data-height-wavelengths={props.heightWavelengths.toFixed(2)}>
      <span className="sr-only">Interactive three-dimensional dipole geometry. Drag to orbit and scroll to zoom.</span>
      <Canvas camera={{ position: [4.8, 3.1, 5.2], fov: 42 }} dpr={[1, 1.5]}>
        <Geometry {...props} />
      </Canvas>
      <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/55 px-2 py-1 text-[10px] text-slate-200">Drag to orbit · scroll to zoom · geometry updates immediately</div>
    </div>
  );
}
