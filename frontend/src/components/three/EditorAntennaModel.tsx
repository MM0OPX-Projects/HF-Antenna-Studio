/**
 * EditorAntennaModel — interactive wire rendering for the V2 wire editor.
 *
 * Extends AntennaModel with:
 * - Click-to-select (raycasting)
 * - Selection highlight (white glow outline)
 * - Endpoint spheres for move mode (drag individual endpoint)
 * - Wire body drag for move mode (translate entire wire)
 * - Feedpoint marker overlay
 */

import { useMemo, useCallback, useEffect, useState, useRef } from "react";
import {
  TubeGeometry,
  LineCurve3,
  Vector3,
  MeshStandardMaterial,
  MeshPhysicalMaterial,
} from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { WireData } from "./types";
import { getWireColor } from "./types";
import type { EditorMode } from "../../stores/editorStore";
import type { WireEndpoint } from "../../utils/editor-junctions";
import { useUIStore } from "../../stores/uiStore";
import type { VisualScale } from "./visualScale";
import { EDITOR_WIRE_VISUAL_RADIUS_MULTIPLIER, shouldShowEditorEndpointHandles } from "./editor-antenna-presentation";

interface EditorAntennaModelProps {
  wire: WireData;
  visualScale: VisualScale;
  isSelected: boolean;
  hasFeedpoint: boolean;
  /** Actual excitation segment number (1-based), or undefined if no excitation */
  feedSegment?: number;
  /** Requested physical feed connection along the wire, from 0 (start) to 1 (end). */
  feedPositionRatio?: number;
  /** Whether this wire is in "pick excitation segment" mode */
  isPicking: boolean;
  /** Show the feed-placement preview at the exact NEC2 segment centre. */
  accurateFeedpoint?: boolean;
  mode: EditorMode;
  endpointSelection: Partial<Record<WireEndpoint, 1 | 2>>;
  junctionSizes: Partial<Record<WireEndpoint, number>>;
  onWireClick: (tag: number, event: ThreeEvent<MouseEvent>) => void;
  onEndpointSelect: (
    tag: number,
    endpoint: WireEndpoint,
    event: ThreeEvent<MouseEvent>,
  ) => void;
  onEndpointDragStart?: (
    tag: number,
    endpoint: "start" | "end",
    event: ThreeEvent<PointerEvent>
  ) => void;
  /** Drag start on the wire body (whole-wire move) */
  onWireDragStart?: (
    tag: number,
    event: ThreeEvent<PointerEvent>
  ) => void;
  /** Called when a segment is picked in pick mode */
  onSegmentPick?: (tag: number, segment: number, positionRatio?: number) => void;
  /** Ref to the tooltip DOM element for showing segment info on hover */
  tooltipRef?: { current: HTMLDivElement | null };
  /** When true, wire becomes semi-transparent so current overlays show through */
  dimmed?: boolean;
  measurementActive?: boolean;
  measurementOrder?: 1 | 2;
  onMeasurementSelect?: (tag: number) => void;
  /** Managed explicit radial wire; rendered consistently rather than by tag colour. */
  isRadial?: boolean;
}

const SELECTED_COLOR = "#FFFFFF";
const FEEDPOINT_COLOR = "#F59E0B";

/** Compute the 3D position of a segment along a wire (in Three.js coords).
 *  When accurate=false (default), endpoint segments snap to wire edges for cleaner junction visuals.
 *  When accurate=true, always positions at the NEC2 segment center. */
function segmentPosition(
  wireStart: Vector3,
  wireEnd: Vector3,
  segment: number,
  totalSegments: number,
  accurate = false
): Vector3 {
  if (!accurate) {
    if (segment === 1) return wireStart.clone();
    if (segment === totalSegments) return wireEnd.clone();
  }
  const t = (segment - 0.5) / totalSegments;
  return wireStart.clone().lerp(wireEnd, t);
}

/** Compute which segment (1-based) a point along the wire falls into. */
function pointToSegment(
  wireStart: Vector3,
  wireEnd: Vector3,
  point: Vector3,
  totalSegments: number
): number {
  const wireDir = wireEnd.clone().sub(wireStart);
  const lenSq = wireDir.lengthSq();
  if (lenSq === 0) return 1;
  const toPoint = point.clone().sub(wireStart);
  const t = Math.max(0, Math.min(1, toPoint.dot(wireDir) / lenSq));
  return Math.max(1, Math.min(totalSegments, Math.ceil(t * totalSegments) || 1));
}

function pointToRatio(wireStart: Vector3, wireEnd: Vector3, point: Vector3): number {
  const direction = wireEnd.clone().sub(wireStart);
  const lengthSquared = direction.lengthSq();
  if (lengthSquared === 0) return 0.5;
  return Math.max(0, Math.min(1, point.clone().sub(wireStart).dot(direction) / lengthSquared));
}

export function EditorAntennaModel({
  wire,
  visualScale,
  isSelected,
  hasFeedpoint,
  feedSegment,
  feedPositionRatio,
  isPicking,
  accurateFeedpoint,
  mode,
  endpointSelection,
  junctionSizes,
  onWireClick,
  onEndpointSelect,
  onEndpointDragStart,
  onWireDragStart,
  onSegmentPick,
  tooltipRef,
  dimmed = false,
  measurementActive = false,
  measurementOrder,
  onMeasurementSelect,
  isRadial = false,
}: EditorAntennaModelProps) {
  const theme = useUIStore((s) => s.theme);
  const isDark = theme === "dark";

  // Pick mode: hovered segment number (null when not hovering)
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null);
  const [hoveredEndpoint, setHoveredEndpoint] = useState<WireEndpoint | null>(null);
  const feedDragRef = useRef(false);
  const lastPointerEvent = useRef<{ clientX: number; clientY: number } | null>(null);

  const { geometry, start, end } = useMemo(() => {
    // NEC2: X=east, Y=north, Z=up -> Three.js: X=east, Y=up, Z=south
    const s = new Vector3(wire.x1, wire.z1, -wire.y1);
    const e = new Vector3(wire.x2, wire.z2, -wire.y2);
    // Editor-only visibility boost. The physical radius in `wire` remains
    // unchanged and is what the NEC adapter emits.
    const visualRadius = visualScale.wireRadius(wire.radius) * EDITOR_WIRE_VISUAL_RADIUS_MULTIPLIER;
    const curve = new LineCurve3(s, e);
    const tubeGeo = new TubeGeometry(
      curve,
      Math.max(2, wire.segments),
      visualRadius,
      8,
      false
    );

    return { geometry: tubeGeo, start: s, end: e };
  }, [wire, visualScale]);

  const measurementHitGeometry = useMemo(
    () =>
      measurementActive
        ? new TubeGeometry(
            new LineCurve3(start, end),
            2,
            Math.max(
              visualScale.wireRadius(wire.radius) * 4,
              visualScale.markerRadius * 0.75,
            ),
            6,
            false,
          )
        : null,
    [measurementActive, start, end, visualScale, wire.radius],
  );

  const material = useMemo(() => {
    const color =
      measurementOrder === 1
        ? "#F59E0B"
        : measurementOrder === 2
          ? "#3B82F6"
          : isSelected
            ? SELECTED_COLOR
            : isRadial
              ? "#22D3EE"
              : getWireColor(wire.tag);
    const emphasized = isSelected || measurementOrder !== undefined;
    const mat = new MeshStandardMaterial({
      color,
      metalness: emphasized ? 0.3 : (isDark ? 0.85 : 0.4),
      roughness: emphasized ? 0.5 : (isDark ? 0.25 : 0.45),
      emissive: color,
      emissiveIntensity: measurementOrder ? 0.65 : isSelected ? 0.3 : 0.14,
      transparent: dimmed,
      opacity: dimmed ? 0.15 : 1,
      depthWrite: !dimmed,
    });
    return mat;
  }, [wire.tag, isSelected, isRadial, dimmed, isDark, measurementOrder]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(
    () => () => measurementHitGeometry?.dispose(),
    [measurementHitGeometry],
  );
  useEffect(() => () => material.dispose(), [material]);

  // Selection outline
  const outlineGeometry = useMemo(() => {
    if (!isSelected) return null;
    const s = new Vector3(wire.x1, wire.z1, -wire.y1);
    const e = new Vector3(wire.x2, wire.z2, -wire.y2);
    const visualRadius = visualScale.wireRadius(wire.radius) * EDITOR_WIRE_VISUAL_RADIUS_MULTIPLIER * 1.35;
    const curve = new LineCurve3(s, e);
    return new TubeGeometry(curve, Math.max(2, wire.segments), visualRadius, 8, false);
  }, [wire, visualScale, isSelected]);

  const outlineMaterial = useMemo(() => {
    if (!isSelected) return null;
    return new MeshStandardMaterial({
      color: "#3B82F6",
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    });
  }, [isSelected]);

  // Feedpoint marker material
  const feedpointMat = useMemo(() => {
    if (!hasFeedpoint) return null;
    return new MeshPhysicalMaterial({
      color: FEEDPOINT_COLOR,
      emissive: FEEDPOINT_COLOR,
      emissiveIntensity: 2,
      transparent: true,
      opacity: 0.9,
    });
  }, [hasFeedpoint]);

  useEffect(() => () => outlineGeometry?.dispose(), [outlineGeometry]);
  useEffect(() => () => outlineMaterial?.dispose(), [outlineMaterial]);
  useEffect(() => () => feedpointMat?.dispose(), [feedpointMat]);

  const feedpointPosition = useMemo((): [number, number, number] => {
    if (feedPositionRatio !== undefined) {
      const pos = start.clone().lerp(end, Math.min(1, Math.max(0, feedPositionRatio)));
      return [pos.x, pos.y, pos.z];
    }
    if (feedSegment && wire.segments > 0) {
      const pos = segmentPosition(start, end, feedSegment, wire.segments, accurateFeedpoint);
      return [pos.x, pos.y, pos.z];
    }
    // Fallback to center if no segment info
    return [
      (start.x + end.x) / 2,
      (start.y + end.y) / 2,
      (start.z + end.z) / 2,
    ];
  }, [start, end, feedPositionRatio, feedSegment, wire.segments, accurateFeedpoint]);

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      onWireClick(wire.tag, event);
    },
    [wire.tag, onWireClick]
  );

  const handleMeasurementClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (!measurementActive || !onMeasurementSelect) return;
      event.stopPropagation();
      onMeasurementSelect(wire.tag);
    },
    [measurementActive, onMeasurementSelect, wire.tag],
  );

  /** Wire body drag — starts a whole-wire move (no need to pre-select) */
  const handleWirePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (mode === "move" && onWireDragStart) {
        event.stopPropagation();
        onWireDragStart(wire.tag, event);
      }
    },
    [mode, wire.tag, onWireDragStart]
  );

  /** Pick mode: compute hovered segment and update tooltip */
  const handlePickPointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!isPicking) return;
      const seg = pointToSegment(start, end, event.point, wire.segments);
      setHoveredSegment(seg);
      lastPointerEvent.current = { clientX: event.nativeEvent.clientX, clientY: event.nativeEvent.clientY };
      // Update tooltip
      if (tooltipRef?.current) {
        const el = tooltipRef.current;
        el.style.display = "block";
        el.style.left = `${event.nativeEvent.clientX + 12}px`;
        el.style.top = `${event.nativeEvent.clientY - 8}px`;
        el.textContent = `Seg ${seg} of ${wire.segments}`;
      }
    },
    [isPicking, start, end, wire.segments, tooltipRef]
  );

  /** Pick mode: hide tooltip on pointer leave */
  const handlePickPointerLeave = useCallback(() => {
    setHoveredSegment(null);
    lastPointerEvent.current = null;
    if (tooltipRef?.current) {
      tooltipRef.current.style.display = "none";
    }
  }, [tooltipRef]);

  const handleFeedPointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (!isPicking) return;
    event.stopPropagation();
    feedDragRef.current = true;
    (event.nativeEvent.target as Element | null)?.setPointerCapture?.(event.pointerId);
    setHoveredSegment(pointToSegment(start, end, event.point, wire.segments));
  }, [end, isPicking, start, wire.segments]);

  const handleFeedPointerUp = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (!isPicking || !feedDragRef.current || !onSegmentPick) return;
    event.stopPropagation();
    feedDragRef.current = false;
    (event.nativeEvent.target as Element | null)?.releasePointerCapture?.(event.pointerId);
    const ratio = pointToRatio(start, end, event.point);
    onSegmentPick(wire.tag, pointToSegment(start, end, event.point, wire.segments), ratio);
  }, [end, isPicking, onSegmentPick, start, wire.segments, wire.tag]);

  // Preview marker position (ghost feedpoint while hovering in pick mode)
  const previewPosition = useMemo((): [number, number, number] | null => {
    if (!isPicking || hoveredSegment === null) return null;
    const pos = segmentPosition(start, end, hoveredSegment, wire.segments, accurateFeedpoint);
    return [pos.x, pos.y, pos.z];
  }, [isPicking, hoveredSegment, start, end, wire.segments, accurateFeedpoint]);

  const capRadius = visualScale.capRadius(wire.radius);
  const endpointRadius = Math.max(capRadius * 1.5, visualScale.markerRadius * 0.42);
  const showEndpointHandles = shouldShowEditorEndpointHandles(mode, endpointSelection);

  const endpointAppearance = (endpoint: WireEndpoint) => {
    if (measurementOrder === 1) {
      return { color: "#F59E0B", emissive: "#F59E0B", intensity: 0.8 };
    }
    if (measurementOrder === 2) {
      return { color: "#3B82F6", emissive: "#3B82F6", intensity: 0.8 };
    }
    const order = endpointSelection[endpoint];
    if (order === 1) return { color: "#F59E0B", emissive: "#F59E0B", intensity: 0.8 };
    if (order === 2) return { color: "#3B82F6", emissive: "#3B82F6", intensity: 0.8 };
    if (junctionSizes[endpoint]) return { color: "#A855F7", emissive: "#A855F7", intensity: 0.65 };
    if (mode === "add") return { color: "#06B6D4", emissive: "#06B6D4", intensity: 0.45 };
    if (mode === "move") return { color: "#10B981", emissive: "#10B981", intensity: 0.5 };
    return { color: isRadial ? "#22D3EE" : getWireColor(wire.tag), emissive: "#000000", intensity: 0 };
  };
  const startAppearance = endpointAppearance("start");
  const endAppearance = endpointAppearance("end");

  return (
    <group>
      {/* Selection outline */}
      {isSelected && !measurementOrder && outlineGeometry && outlineMaterial && (
        <mesh geometry={outlineGeometry} material={outlineMaterial} />
      )}

      {/* Wire tube — clickable for selection, draggable for whole-wire move, pick mode interactions */}
      <mesh
        geometry={geometry}
        material={material}
        onClick={
          measurementActive
            ? handleMeasurementClick
            : isPicking ? undefined : handleClick
        }
        onPointerDown={
          measurementActive ? undefined : isPicking ? handleFeedPointerDown : handleWirePointerDown
        }
        onPointerUp={!measurementActive && isPicking ? handleFeedPointerUp : undefined}
        onPointerMove={
          !measurementActive && isPicking ? handlePickPointerMove : undefined
        }
        onPointerLeave={
          !measurementActive && isPicking ? handlePickPointerLeave : undefined
        }
      />

      {measurementHitGeometry && (
        <mesh geometry={measurementHitGeometry} onClick={handleMeasurementClick}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {/* Endpoint spheres */}
      {showEndpointHandles && <mesh
        position={start}
        onPointerEnter={() => mode === "add" && setHoveredEndpoint("start")}
        onPointerLeave={() => setHoveredEndpoint((current) => current === "start" ? null : current)}
        onClick={(event: ThreeEvent<MouseEvent>) =>
          measurementActive
            ? handleMeasurementClick(event)
            : onEndpointSelect(wire.tag, "start", event)
        }
        onPointerDown={
          !measurementActive && mode === "move" && onEndpointDragStart
            ? (e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                onEndpointDragStart(wire.tag, "start", e);
              }
            : undefined
        }
      >
        <sphereGeometry args={[endpointRadius, 12, 12]} />
        <meshStandardMaterial
          color={hoveredEndpoint === "start" ? "#FFFFFF" : startAppearance.color}
          metalness={0.5}
          roughness={0.4}
          emissive={startAppearance.emissive}
          emissiveIntensity={hoveredEndpoint === "start" ? 1.5 : startAppearance.intensity}
          transparent={dimmed}
          opacity={dimmed ? 0.15 : 1}
          depthWrite={!dimmed}
        />
      </mesh>}
      {showEndpointHandles && <mesh
        position={end}
        onPointerEnter={() => mode === "add" && setHoveredEndpoint("end")}
        onPointerLeave={() => setHoveredEndpoint((current) => current === "end" ? null : current)}
        onClick={(event: ThreeEvent<MouseEvent>) =>
          measurementActive
            ? handleMeasurementClick(event)
            : onEndpointSelect(wire.tag, "end", event)
        }
        onPointerDown={
          !measurementActive && mode === "move" && onEndpointDragStart
            ? (e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                onEndpointDragStart(wire.tag, "end", e);
              }
            : undefined
        }
      >
        <sphereGeometry args={[endpointRadius, 12, 12]} />
        <meshStandardMaterial
          color={hoveredEndpoint === "end" ? "#FFFFFF" : endAppearance.color}
          metalness={0.5}
          roughness={0.4}
          emissive={endAppearance.emissive}
          emissiveIntensity={hoveredEndpoint === "end" ? 1.5 : endAppearance.intensity}
          transparent={dimmed}
          opacity={dimmed ? 0.15 : 1}
          depthWrite={!dimmed}
        />
      </mesh>}

      {/* Feedpoint glow — the requested physical connection; NEC segment mapping is reported separately. */}
      {hasFeedpoint && feedpointMat && (
        <mesh position={feedpointPosition} material={feedpointMat}>
          <sphereGeometry args={[visualScale.markerRadius, 16, 16]} />
        </mesh>
      )}

      {/* Pick mode: ghost preview marker at hovered segment */}
      {previewPosition && (
        <mesh position={previewPosition}>
          <sphereGeometry args={[visualScale.markerRadius, 16, 16]} />
          <meshPhysicalMaterial
            color="#3B82F6"
            emissive="#3B82F6"
            emissiveIntensity={1.5}
            transparent
            opacity={0.6}
          />
        </mesh>
      )}
    </group>
  );
}
