/** Segment-resolved NEC current overlay with magnitude, phase and phasor-time modes. */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { BufferGeometry, Color, Float32BufferAttribute, InstancedMesh, Mesh, Object3D, SphereGeometry, Vector3 } from "three";
import type { SegmentCurrent } from "../../api/nec";
import { instantaneousNormalizedCurrent, maximumCurrentMagnitude, normalizedCurrentMagnitude, phaseUnit } from "../../features/current-visualisation/math";
import type { CurrentVisualMode } from "../../features/current-visualisation/types";

interface Props {
  currents: SegmentCurrent[];
  mode?: CurrentVisualMode;
  animated?: boolean;
  selected?: SegmentCurrent | null;
  onSelect?: (current: SegmentCurrent) => void;
  tubeRadius?: number;
  particleRadius?: number;
}

type Stop = { t: number; color: Color };
const MAGNITUDE_STOPS: Stop[] = [
  { t: 0, color: new Color("#1d4ed8") }, { t: 0.35, color: new Color("#06b6d4") },
  { t: 0.6, color: new Color("#22c55e") }, { t: 0.82, color: new Color("#f59e0b") },
  { t: 1, color: new Color("#ef4444") },
];

function interpolateStops(value: number, stops: Stop[]): Color {
  const t = Math.max(0, Math.min(1, value));
  for (let index = 0; index < stops.length - 1; index += 1) {
    const a = stops[index]!; const b = stops[index + 1]!;
    if (t >= a.t && t <= b.t) return new Color().lerpColors(a.color, b.color, (t - a.t) / (b.t - a.t));
  }
  return stops[stops.length - 1]!.color.clone();
}

function phaseColor(phaseDeg: number): Color {
  return new Color().setHSL(phaseUnit(phaseDeg), 0.86, 0.56);
}

function staticColor(current: SegmentCurrent, mode: CurrentVisualMode, maximum: number): Color {
  return mode === "magnitude" ? interpolateStops(normalizedCurrentMagnitude(current, maximum), MAGNITUDE_STOPS) : phaseColor(current.current_phase_deg);
}

function groupByTag(currents: SegmentCurrent[]): Map<number, SegmentCurrent[]> {
  const grouped = new Map<number, SegmentCurrent[]>();
  for (const current of currents) grouped.set(current.tag, [...(grouped.get(current.tag) ?? []), current]);
  for (const values of grouped.values()) values.sort((a, b) => a.segment - b.segment);
  return grouped;
}

function nearestCurrent(point: Vector3, currents: SegmentCurrent[]): SegmentCurrent {
  const nec = { x: point.x, y: -point.z, z: point.y };
  return currents.reduce((closest, candidate) => {
    const candidateDistance = (candidate.x - nec.x) ** 2 + (candidate.y - nec.y) ** 2 + (candidate.z - nec.z) ** 2;
    const closestDistance = (closest.x - nec.x) ** 2 + (closest.y - nec.y) ** 2 + (closest.z - nec.z) ** 2;
    return candidateDistance < closestDistance ? candidate : closest;
  });
}

function WireTube({ currents, maximum, mode, tubeRadius, onSelect }: { currents: SegmentCurrent[]; maximum: number; mode: CurrentVisualMode; tubeRadius: number; onSelect?: (current: SegmentCurrent) => void }) {
  const meshRef = useRef<Mesh>(null);
  const geometry = useMemo(() => {
    if (currents.length < 2) return null;
    const positions: number[] = []; const colors: number[] = []; const indices: number[] = [];
    const points = currents.map((current) => new Vector3(current.x, current.z, -current.y));
    const radialSegments = 8;
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index]!;
      const normalized = normalizedCurrentMagnitude(currents[index]!, maximum);
      const radius = tubeRadius * (mode === "phase" ? 0.9 : 0.45 + normalized * 0.85);
      const color = staticColor(currents[index]!, mode, maximum);
      const tangent = index === 0 ? new Vector3().subVectors(points[1]!, point).normalize() : index === points.length - 1 ? new Vector3().subVectors(point, points[index - 1]!).normalize() : new Vector3().subVectors(points[index + 1]!, points[index - 1]!).normalize();
      const reference = Math.abs(tangent.y) > 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
      const right = new Vector3().crossVectors(tangent, reference).normalize();
      const up = new Vector3().crossVectors(right, tangent).normalize();
      for (let radial = 0; radial <= radialSegments; radial += 1) {
        const angle = radial / radialSegments * Math.PI * 2;
        const offset = right.clone().multiplyScalar(Math.cos(angle) * radius).add(up.clone().multiplyScalar(Math.sin(angle) * radius));
        positions.push(point.x + offset.x, point.y + offset.y, point.z + offset.z);
        colors.push(color.r, color.g, color.b);
      }
      if (index > 0) {
        const ring = radialSegments + 1; const currentStart = index * ring; const previousStart = (index - 1) * ring;
        for (let radial = 0; radial < radialSegments; radial += 1) indices.push(previousStart + radial, previousStart + radial + 1, currentStart + radial + 1, previousStart + radial, currentStart + radial + 1, currentStart + radial);
      }
    }
    const result = new BufferGeometry();
    result.setAttribute("position", new Float32BufferAttribute(positions, 3));
    result.setAttribute("color", new Float32BufferAttribute(colors, 3));
    result.setIndex(indices); result.computeVertexNormals(); return result;
  }, [currents, maximum, mode, tubeRadius]);
  useEffect(() => { if (meshRef.current) meshRef.current.userData = { hoverType: "current", segments: currents }; }, [currents]);
  if (!geometry) return null;
  return <mesh ref={meshRef} geometry={geometry} onClick={(event: ThreeEvent<MouseEvent>) => { if (!onSelect) return; event.stopPropagation(); onSelect(nearestCurrent(event.point, currents)); }}><meshStandardMaterial vertexColors metalness={0.15} roughness={0.45} /></mesh>;
}

function SegmentGlyphs({ currents, maximum, mode, animated, selected, radius, onSelect }: { currents: SegmentCurrent[]; maximum: number; mode: CurrentVisualMode; animated: boolean; selected: SegmentCurrent | null; radius: number; onSelect?: (current: SegmentCurrent) => void }) {
  const meshRef = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => new SphereGeometry(radius, 10, 8), [radius]);
  const object = useMemo(() => new Object3D(), []);
  const update = useCallback((cycle: number) => {
    const mesh = meshRef.current; if (!mesh) return;
    currents.forEach((current, index) => {
      const normalized = normalizedCurrentMagnitude(current, maximum);
      const instantaneous = instantaneousNormalizedCurrent(current, maximum, cycle);
      const magnitudeScale = mode === "phase" ? 0.9 : 0.45 + normalized * 1.2;
      const animationScale = animated ? 0.25 + Math.abs(instantaneous) * 1.15 : 1;
      const isSelected = selected?.tag === current.tag && selected.segment === current.segment;
      object.position.set(current.x, current.z, -current.y);
      object.scale.setScalar(magnitudeScale * animationScale * (isSelected ? 1.65 : 1));
      object.updateMatrix(); mesh.setMatrixAt(index, object.matrix);
      const color = animated ? (instantaneous >= 0 ? new Color("#ffb000") : new Color("#00d8ff")) : staticColor(current, mode, maximum);
      if (isSelected) color.lerp(new Color("#ffffff"), 0.55);
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [animated, currents, maximum, mode, object, selected]);
  useEffect(() => update(0), [update]);
  useFrame((state) => { if (animated) update((state.clock.elapsedTime * 0.18) % 1); });
  return <instancedMesh ref={meshRef} args={[geometry, undefined, currents.length]} frustumCulled={false} userData={{ hoverType: "current", segments: currents }} onClick={(event: ThreeEvent<MouseEvent>) => { if (!onSelect || event.instanceId === undefined) return; event.stopPropagation(); const current = currents[event.instanceId]; if (current) onSelect(current); }}><meshStandardMaterial vertexColors emissive="#111111" emissiveIntensity={0.4} roughness={0.35} /></instancedMesh>;
}

export function CurrentDistribution3D({ currents, mode = "magnitude", animated = false, selected = null, onSelect, tubeRadius = 0.05, particleRadius = 0.04 }: Props) {
  const maximum = useMemo(() => maximumCurrentMagnitude(currents), [currents]);
  const grouped = useMemo(() => groupByTag(currents), [currents]);
  if (currents.length === 0 || maximum <= 0) return null;
  return <group>{[...grouped.entries()].map(([tag, values]) => <WireTube key={tag} currents={values} maximum={maximum} mode={mode} tubeRadius={tubeRadius} onSelect={onSelect} />)}<SegmentGlyphs currents={currents} maximum={maximum} mode={mode} animated={animated} selected={selected} radius={particleRadius * 1.15} onSelect={onSelect} /></group>;
}
