import {
  useCallback,
  useEffect,
  forwardRef,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type InputHTMLAttributes,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { useEditorStore, snap } from "../../stores/editorStore";
import type { EditorWire, EndpointRef, WireEndpoint } from "../../stores/editorStore";
import { requestedFeedpointPosition } from "../../features/wire-editor/feedpoint";
import { DRAWING_PLANES, endpointFromLengthAngle, expandPoint, projectPoint, type DrawingPlane, type DrawingPoint2, type DrawingPoint3 } from "../../features/wire-editor/drawing-plane";
import { connectedPolylinePath } from "../../features/wire-editor/polyline";
import { editorUnitDecimals, editorUnitToMetres, metresToEditorUnit, type EditorLengthUnit } from "../../features/wire-editor/units";
import { useUIStore } from "../../stores/uiStore";

interface Size { width: number; height: number }

function pointOf(wire: EditorWire, endpoint: WireEndpoint): DrawingPoint3 {
  return endpoint === "start"
    ? { x: wire.x1, y: wire.y1, z: wire.z1 }
    : { x: wire.x2, y: wire.y2, z: wire.z2 };
}

function niceGridStep(pixelsPerMeter: number): number {
  const targetMeters = 64 / Math.max(pixelsPerMeter, 0.001);
  const power = 10 ** Math.floor(Math.log10(targetMeters));
  const normalised = targetMeters / power;
  const factor = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return factor * power;
}

function formatCoordinate(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 100) return value.toFixed(0);
  if (absolute >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function sameRef(a: EndpointRef | null, b: EndpointRef | null): boolean {
  return Boolean(a && b && a.wireTag === b.wireTag && a.endpoint === b.endpoint);
}

interface SnapResult {
  point: DrawingPoint3;
  kind: "free" | "grid" | "origin" | "endpoint";
  endpoint: EndpointRef | null;
}

interface DragState {
  tag: number;
  endpoint: WireEndpoint;
  snapTarget: EndpointRef | null;
  moved: boolean;
}

interface WireDragState {
  tag: number;
  pointerOrigin: DrawingPoint3;
  appliedDelta: DrawingPoint3;
}

interface EditableNumberFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: number;
  decimals: number;
  onValueChange: (value: number) => void;
}

const EditableNumberField = forwardRef<HTMLInputElement, EditableNumberFieldProps>(function EditableNumberField(
  { value, decimals, onValueChange, onFocus, onBlur, ...props },
  forwardedRef,
) {
  const formatted = Number.isFinite(value) ? String(Number(value.toFixed(decimals))) : "";
  const [text, setText] = useState(formatted);
  const [focused, setFocused] = useState(false);

  const restoreOrCommit = () => {
    const parsed = Number(text);
    if (text.trim() === "" || !Number.isFinite(parsed)) setText(formatted);
    else {
      onValueChange(parsed);
      setText(String(parsed));
    }
  };

  return <input
    {...props}
    ref={forwardedRef}
    value={focused ? text : formatted}
    onFocus={(event) => { setText(formatted); setFocused(true); onFocus?.(event); }}
    onChange={(event) => {
      const next = event.currentTarget.value;
      setText(next);
      if (next.trim() === "") return;
      const parsed = Number(next);
      if (Number.isFinite(parsed)) onValueChange(parsed);
    }}
    onBlur={(event) => {
      setFocused(false);
      restoreOrCommit();
      onBlur?.(event);
    }}
  />;
});

type WireLengthAnchor = "start" | "end" | "center";

function trapPrecisionTab(event: ReactKeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") return;
  const fields = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-precision-field]"));
  if (fields.length === 0) return;
  const current = document.activeElement;
  const index = fields.indexOf(current as HTMLElement);
  if ((!event.shiftKey && index === fields.length - 1) || (event.shiftKey && index <= 0)) {
    event.preventDefault();
    fields[event.shiftKey ? fields.length - 1 : 0]?.focus();
  }
}

function wireLength(wire: EditorWire): number {
  return Math.hypot(wire.x2 - wire.x1, wire.y2 - wire.y1, wire.z2 - wire.z1);
}

function resizeWireDraft(wire: EditorWire, lengthM: number, anchor: WireLengthAnchor): EditorWire {
  const currentLength = wireLength(wire);
  if (!Number.isFinite(lengthM) || lengthM <= 0 || currentLength < 1e-12) return wire;
  const direction = {
    x: (wire.x2 - wire.x1) / currentLength,
    y: (wire.y2 - wire.y1) / currentLength,
    z: (wire.z2 - wire.z1) / currentLength,
  };
  if (anchor === "start") return { ...wire, x2: wire.x1 + direction.x * lengthM, y2: wire.y1 + direction.y * lengthM, z2: wire.z1 + direction.z * lengthM };
  if (anchor === "end") return { ...wire, x1: wire.x2 - direction.x * lengthM, y1: wire.y2 - direction.y * lengthM, z1: wire.z2 - direction.z * lengthM };
  const centre = { x: (wire.x1 + wire.x2) / 2, y: (wire.y1 + wire.y2) / 2, z: (wire.z1 + wire.z2) / 2 };
  const half = lengthM / 2;
  return { ...wire, x1: centre.x - direction.x * half, y1: centre.y - direction.y * half, z1: centre.z - direction.z * half, x2: centre.x + direction.x * half, y2: centre.y + direction.y * half, z2: centre.z + direction.z * half };
}

function rotateWireDraftInPlane(wire: EditorWire, plane: DrawingPlane, angleDeg: number, anchor: WireLengthAnchor): EditorWire {
  if (!Number.isFinite(angleDeg)) return wire;
  const start = projectPoint(pointOf(wire, "start"), plane);
  const end = projectPoint(pointOf(wire, "end"), plane);
  const projectedLength = Math.hypot(end.u - start.u, end.v - start.v);
  if (projectedLength < 1e-12) return wire;
  const direction = endpointFromLengthAngle({ u: 0, v: 0 }, projectedLength, angleDeg);
  let nextStart = start;
  let nextEnd = end;
  if (anchor === "start") nextEnd = { u: start.u + direction.u, v: start.v + direction.v };
  else if (anchor === "end") nextStart = { u: end.u - direction.u, v: end.v - direction.v };
  else {
    const centre = { u: (start.u + end.u) / 2, v: (start.v + end.v) / 2 };
    nextStart = { u: centre.u - direction.u / 2, v: centre.v - direction.v / 2 };
    nextEnd = { u: centre.u + direction.u / 2, v: centre.v + direction.v / 2 };
  }
  const fixedStart = pointOf(wire, "start")[DRAWING_PLANES[plane].fixed];
  const fixedEnd = pointOf(wire, "end")[DRAWING_PLANES[plane].fixed];
  const expandedStart = expandPoint(nextStart, plane, fixedStart);
  const expandedEnd = expandPoint(nextEnd, plane, fixedEnd);
  return { ...wire, x1: expandedStart.x, y1: expandedStart.y, z1: expandedStart.z, x2: expandedEnd.x, y2: expandedEnd.y, z2: expandedEnd.z };
}

export function WireEditor2D() {
  const svgRef = useRef<SVGSVGElement>(null);
  const panRef = useRef<{ x: number; y: number; center: DrawingPoint2 } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const wireDragRef = useRef<WireDragState | null>(null);
  const feedDragRef = useRef<{ wireTag: number } | null>(null);
  const lengthInputRef = useRef<HTMLInputElement>(null);
  const precisionDragRef = useRef<{ pointerX: number; pointerY: number; originX: number; originY: number } | null>(null);
  const wires = useEditorStore((state) => state.wires);
  const excitations = useEditorStore((state) => state.excitations);
  const selectedTags = useEditorStore((state) => state.selectedTags);
  const radialSystems = useEditorStore((state) => state.radialSystems);
  const mode = useEditorStore((state) => state.mode);
  const snapSize = useEditorStore((state) => state.snapSize);
  const showGrid = useEditorStore((state) => state.showGrid);
  const continuousDraw = useEditorStore((state) => state.continuousDraw);
  const endpointSnap = useEditorStore((state) => state.endpointSnap);
  const setContinuousDraw = useEditorStore((state) => state.setContinuousDraw);
  const setEndpointSnap = useEditorStore((state) => state.setEndpointSnap);
  const addWire = useEditorStore((state) => state.addWire);
  const addConnectedWire = useEditorStore((state) => state.addConnectedWire);
  const selectWire = useEditorStore((state) => state.selectWire);
  const toggleSelection = useEditorStore((state) => state.toggleSelection);
  const deselectAll = useEditorStore((state) => state.deselectAll);
  const selectEndpoint = useEditorStore((state) => state.selectEndpoint);
  const clearEndpointSelection = useEditorStore((state) => state.clearEndpointSelection);
  const moveEndpoint = useEditorStore((state) => state.moveEndpoint);
  const moveWire = useEditorStore((state) => state.moveWire);
  const beginGeometryTransaction = useEditorStore((state) => state.beginGeometryTransaction);
  const commitGeometryTransaction = useEditorStore((state) => state.commitGeometryTransaction);
  const cancelGeometryTransaction = useEditorStore((state) => state.cancelGeometryTransaction);
  const toggleSelectedJunction = useEditorStore((state) => state.toggleSelectedJunction);
  const pickingExcitationForTag = useEditorStore((state) => state.pickingExcitationForTag);
  const setPickingExcitationForTag = useEditorStore((state) => state.setPickingExcitationForTag);
  const setExcitationPosition = useEditorStore((state) => state.setExcitationPosition);
  const moveExcitationToPosition = useEditorStore((state) => state.moveExcitationToPosition);
  const updateWire = useEditorStore((state) => state.updateWire);
  const imperial = useUIStore((state) => state.imperial);
  const metricLengthUnit = useUIStore((state) => state.metricLengthUnit);
  const imperialLengthUnit = useUIStore((state) => state.imperialLengthUnit);

  const [plane, setPlane] = useState<DrawingPlane>("xz");
  const [fixedCoordinate, setFixedCoordinate] = useState(0);
  const [size, setSize] = useState<Size>({ width: 900, height: 600 });
  const [center, setCenter] = useState<DrawingPoint2>({ u: 0, v: 3 });
  const [pixelsPerMeter, setPixelsPerMeter] = useState(32);
  const [cursor, setCursor] = useState<SnapResult | null>(null);
  const [addStart, setAddStart] = useState<SnapResult | null>(null);
  const [exactPoint, setExactPoint] = useState<DrawingPoint2>({ u: 0, v: 0 });
  const [status, setStatus] = useState("Ready");
  const [freeFeedPlacement, setFreeFeedPlacement] = useState(false);
  const [precisionUnitOverride, setPrecisionUnitOverride] = useState<EditorLengthUnit | null>(null);
  const [precisionPanelPosition, setPrecisionPanelPosition] = useState<DrawingPoint2 | null>(null);
  const [wireEdit, setWireEdit] = useState<{ draft: EditorWire; anchor: WireLengthAnchor; position: DrawingPoint2 } | null>(null);
  const precisionUnit: EditorLengthUnit = precisionUnitOverride ?? (imperial ? imperialLengthUnit : metricLengthUnit === "mm" ? "mm" : "m");

  const definition = DRAWING_PLANES[plane];
  const radialWireTags = useMemo(() => new Set(radialSystems.flatMap((system) => system.generatedWireTags)), [radialSystems]);
  const feedPlacementActive = freeFeedPlacement || pickingExcitationForTag !== null;
  const toScreen = useCallback((point: DrawingPoint2) => ({
    x: size.width / 2 + (point.u - center.u) * pixelsPerMeter,
    y: size.height / 2 - (point.v - center.v) * pixelsPerMeter,
  }), [center, pixelsPerMeter, size]);
  const fromScreen = useCallback((x: number, y: number): DrawingPoint2 => ({
    u: center.u + (x - size.width / 2) / pixelsPerMeter,
    v: center.v - (y - size.height / 2) / pixelsPerMeter,
  }), [center, pixelsPerMeter, size]);

  useEffect(() => {
    const element = svgRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({ width: Math.max(entry.contentRect.width, 1), height: Math.max(entry.contentRect.height, 1) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fitAntenna = useCallback((nextPlane: DrawingPlane = plane) => {
    const projected = wires.flatMap((wire) => [projectPoint(pointOf(wire, "start"), nextPlane), projectPoint(pointOf(wire, "end"), nextPlane)]);
    if (projected.length === 0) {
      setCenter({ u: 0, v: nextPlane === "xy" ? 0 : 3 });
      setPixelsPerMeter(32);
      return;
    }
    const uValues = [...projected.map((point) => point.u), 0];
    const vValues = [...projected.map((point) => point.v), 0];
    const minU = Math.min(...uValues), maxU = Math.max(...uValues);
    const minV = Math.min(...vValues), maxV = Math.max(...vValues);
    const rangeU = Math.max(maxU - minU, 2);
    const rangeV = Math.max(maxV - minV, 2);
    setCenter({ u: (minU + maxU) / 2, v: (minV + maxV) / 2 });
    setPixelsPerMeter(Math.max(2, Math.min(160, (size.width - 100) / (rangeU * 1.2), (size.height - 130) / (rangeV * 1.2))));
  }, [plane, size.height, size.width, wires]);

  const changePlane = useCallback((nextPlane: DrawingPlane) => {
    setPlane(nextPlane);
    setAddStart(null);
    setCursor(null);
    setFixedCoordinate(0);
    setStatus(`${DRAWING_PLANES[nextPlane].label} drawing plane selected.`);
    window.setTimeout(() => fitAntenna(nextPlane), 0);
  }, [fitAntenna]);

  useEffect(() => useEditorStore.subscribe((state, previous) => {
    if (state.mode === previous.mode) return;
    setAddStart(null);
    dragRef.current = null;
    setStatus(state.mode === "add" ? "Left-click to place the first endpoint. Right-click cancels." : "Ready");
  }), []);

  const localCoordinates = useCallback((event: { clientX: number; clientY: number }) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }, []);

  const resolveSnap = useCallback((raw: DrawingPoint2, excluded?: EndpointRef): SnapResult => {
    let point2 = snapSize > 0 ? { u: snap(raw.u, snapSize), v: snap(raw.v, snapSize) } : raw;
    let kind: SnapResult["kind"] = snapSize > 0 ? "grid" : "free";
    if (Math.hypot(raw.u * pixelsPerMeter, raw.v * pixelsPerMeter) <= 11) {
      point2 = { u: 0, v: 0 };
      kind = "origin";
    }
    let nearest: { ref: EndpointRef; point: DrawingPoint3; distance: number } | null = null;
    if (endpointSnap) {
      for (const wire of wires) {
        for (const endpoint of ["start", "end"] as const) {
          const ref = { wireTag: wire.tag, endpoint };
          if (excluded && sameRef(ref, excluded)) continue;
          const point3 = pointOf(wire, endpoint);
          const projected = projectPoint(point3, plane);
          const distance = Math.hypot((projected.u - raw.u) * pixelsPerMeter, (projected.v - raw.v) * pixelsPerMeter);
          if (distance <= 12 && (!nearest || distance < nearest.distance)) nearest = { ref, point: point3, distance };
        }
      }
    }
    if (nearest) return { point: nearest.point, kind: "endpoint", endpoint: nearest.ref };
    return { point: expandPoint(point2, plane, fixedCoordinate), kind, endpoint: null };
  }, [endpointSnap, fixedCoordinate, pixelsPerMeter, plane, snapSize, wires]);

  const cancelDrawing = useCallback(() => {
    if (feedDragRef.current) {
      cancelGeometryTransaction();
      feedDragRef.current = null;
    }
    if (freeFeedPlacement || pickingExcitationForTag !== null) {
      setFreeFeedPlacement(false);
      setPickingExcitationForTag(null);
      setStatus("Feedpoint placement cancelled.");
      return;
    }
    if (dragRef.current) {
      cancelGeometryTransaction();
      dragRef.current = null;
      setStatus("Endpoint movement cancelled.");
      return;
    }
    if (wireDragRef.current) {
      cancelGeometryTransaction();
      wireDragRef.current = null;
      setStatus("Wire movement cancelled.");
      return;
    }
    setAddStart(null);
    setCursor(null);
    setStatus("Drawing cancelled. Left-click to start a new wire.");
  }, [cancelGeometryTransaction, freeFeedPlacement, pickingExcitationForTag, setPickingExcitationForTag]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (addStart || dragRef.current || wireDragRef.current || feedPlacementActive)) cancelDrawing();
      if (event.key === "Escape" && wireEdit) {
        setWireEdit(null);
        setStatus("Wire edit cancelled; geometry was not changed.");
      }
      if (event.key.toLowerCase() === "l" && addStart && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLSelectElement) && !(event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        lengthInputRef.current?.focus();
        lengthInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [addStart, cancelDrawing, feedPlacementActive, wireEdit]);

  const completeWire = useCallback((end: SnapResult) => {
    if (!addStart) return;
    const startPoint = addStart.point;
    const endPoint = end.point;
    const length = Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y, endPoint.z - startPoint.z);
    if (length < 1e-8) {
      setStatus("A wire needs two different endpoints.");
      return;
    }
    const geometry = {
      x1: startPoint.x, y1: startPoint.y, z1: startPoint.z,
      x2: endPoint.x, y2: endPoint.y, z2: endPoint.z,
      radius: 0.0005,
    };
    const connections = {
      start: endpointSnap ? addStart.endpoint ?? undefined : undefined,
      end: endpointSnap ? end.endpoint ?? undefined : undefined,
    };
    const tag = connections.start || connections.end ? addConnectedWire(geometry, connections) : addWire(geometry);
    if (tag === null) {
      setStatus("The wire could not be added. Check its dimensions.");
      return;
    }
    setStatus(`Wire ${tag} added (${length.toFixed(3)} m).${continuousDraw ? " Continue from its endpoint or right-click to finish." : ""}`);
    if (continuousDraw) {
      const nextStart = { ...end, endpoint: { wireTag: tag, endpoint: "end" as const }, kind: "endpoint" as const };
      setAddStart(nextStart);
      const projected = projectPoint(end.point, plane);
      setExactPoint(projected);
    } else {
      setAddStart(null);
    }
  }, [addConnectedWire, addStart, addWire, continuousDraw, endpointSnap, plane]);

  const handleBackgroundPointerDown = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    const local = localCoordinates(event);
    if (!local) return;
    if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
      event.preventDefault();
      panRef.current = { x: event.clientX, y: event.clientY, center };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button !== 0) return;
    if (feedPlacementActive) {
      setStatus("Click or drag on a wire to place the feedpoint. Right-click cancels.");
      return;
    }
    if (mode === "select") {
      deselectAll();
      clearEndpointSelection();
      return;
    }
    if (mode !== "add") return;
    const next = resolveSnap(fromScreen(local.x, local.y));
    if (!addStart) {
      setAddStart(next);
      setExactPoint(projectPoint(next.point, plane));
      setStatus(`Start: ${definition.horizontal.toUpperCase()} ${formatCoordinate(projectPoint(next.point, plane).u)} m, ${definition.vertical.toUpperCase()} ${formatCoordinate(projectPoint(next.point, plane).v)} m. Left-click the endpoint; right-click cancels.`);
    } else {
      completeWire(next);
    }
  }, [addStart, center, clearEndpointSelection, completeWire, definition.horizontal, definition.vertical, deselectAll, feedPlacementActive, fromScreen, localCoordinates, mode, plane, resolveSnap]);

  const feedRatioFromPointer = useCallback((event: { clientX: number; clientY: number }, wire: EditorWire): number | null => {
    const local = localCoordinates(event);
    if (!local) return null;
    const point = fromScreen(local.x, local.y);
    const start = projectPoint(pointOf(wire, "start"), plane);
    const end = projectPoint(pointOf(wire, "end"), plane);
    const du = end.u - start.u, dv = end.v - start.v;
    const lengthSquared = du * du + dv * dv;
    if (lengthSquared < 1e-16) return 0.5;
    return Math.min(1, Math.max(0, ((point.u - start.u) * du + (point.v - start.v) * dv) / lengthSquared));
  }, [fromScreen, localCoordinates, plane]);

  const placeFeedOnWire = useCallback((wire: EditorWire, ratio: number): boolean => {
    const editor = useEditorStore.getState();
    const radialOwner = editor.radialSystems.find((system) => system.generatedWireTags.includes(wire.tag));
    if (radialOwner) {
      selectWire(radialOwner.drivenWireTag);
      setStatus(`Wire ${wire.tag} is a managed radial. The source remains on driven Wire ${radialOwner.drivenWireTag}; explode the group to feed it independently.`);
      return false;
    }
    const path = connectedPolylinePath(editor.wires, editor.junctions, wire.tag);
    const pathTags = new Set(path.legs.map((leg) => leg.wireTag));
    const connectedSources = editor.excitations.filter((source) => pathTags.has(source.wire_tag));
    if (connectedSources.length === 1 && connectedSources[0]!.wire_tag !== wire.tag) {
      const result = moveExcitationToPosition(connectedSources[0]!.wire_tag, wire.tag, ratio);
      if (!result.ok) return false;
    } else {
      setExcitationPosition(wire.tag, ratio);
    }
    selectWire(wire.tag);
    return true;
  }, [moveExcitationToPosition, selectWire, setExcitationPosition]);

  const beginFeedPlacement = useCallback((event: ReactPointerEvent<SVGLineElement>, wire: EditorWire) => {
    if (!feedPlacementActive || event.button !== 0) return false;
    if (pickingExcitationForTag !== null && pickingExcitationForTag !== wire.tag && !freeFeedPlacement) return false;
    event.stopPropagation();
    const ratio = feedRatioFromPointer(event, wire);
    if (ratio === null) return true;
    beginGeometryTransaction();
    if (!placeFeedOnWire(wire, ratio)) {
      commitGeometryTransaction();
      setFreeFeedPlacement(false);
      setPickingExcitationForTag(null);
      return true;
    }
    feedDragRef.current = { wireTag: wire.tag };
    event.currentTarget.setPointerCapture(event.pointerId);
    setStatus(`Feedpoint on Wire ${wire.tag}: ${(ratio * 100).toFixed(1)}%. Drag to refine; release to finish.`);
    return true;
  }, [beginGeometryTransaction, commitGeometryTransaction, feedPlacementActive, feedRatioFromPointer, freeFeedPlacement, pickingExcitationForTag, placeFeedOnWire, setPickingExcitationForTag]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (panRef.current) {
      const dx = (event.clientX - panRef.current.x) / pixelsPerMeter;
      const dy = (event.clientY - panRef.current.y) / pixelsPerMeter;
      setCenter({ u: panRef.current.center.u - dx, v: panRef.current.center.v + dy });
      return;
    }
    if (feedDragRef.current) {
      const wire = useEditorStore.getState().wires.find((candidate) => candidate.tag === feedDragRef.current!.wireTag);
      if (!wire) return;
      const ratio = feedRatioFromPointer(event, wire);
      if (ratio === null) return;
      setExcitationPosition(wire.tag, ratio);
      setStatus(`Feedpoint on Wire ${wire.tag}: ${(ratio * 100).toFixed(1)}%.`);
      return;
    }
    const local = localCoordinates(event);
    if (!local) return;
    const raw = fromScreen(local.x, local.y);
    if (wireDragRef.current) {
      const drag = wireDragRef.current;
      const point = expandPoint(raw, plane, fixedCoordinate);
      const desiredDelta = {
        x: point.x - drag.pointerOrigin.x,
        y: point.y - drag.pointerOrigin.y,
        z: point.z - drag.pointerOrigin.z,
      };
      const targetDelta = snapSize > 0 ? {
        x: snap(desiredDelta.x, snapSize),
        y: snap(desiredDelta.y, snapSize),
        z: snap(desiredDelta.z, snapSize),
      } : desiredDelta;
      moveWire(
        drag.tag,
        targetDelta.x - drag.appliedDelta.x,
        targetDelta.y - drag.appliedDelta.y,
        targetDelta.z - drag.appliedDelta.z,
      );
      drag.appliedDelta = targetDelta;
      setStatus(`Moving Wire ${drag.tag}: ΔX ${targetDelta.x.toFixed(3)} m, ΔY ${targetDelta.y.toFixed(3)} m, ΔZ ${targetDelta.z.toFixed(3)} m.`);
      return;
    }
    if (dragRef.current) {
      const source = { wireTag: dragRef.current.tag, endpoint: dragRef.current.endpoint };
      const snapped = resolveSnap(raw, source);
      const wire = useEditorStore.getState().wires.find((candidate) => candidate.tag === source.wireTag);
      if (!wire) return;
      const current = pointOf(wire, source.endpoint);
      moveEndpoint(source.wireTag, source.endpoint, snapped.point.x - current.x, snapped.point.y - current.y, snapped.point.z - current.z);
      dragRef.current.snapTarget = snapped.endpoint;
      dragRef.current.moved = true;
      setCursor(snapped);
      return;
    }
    const snapped = resolveSnap(raw);
    setCursor(snapped);
    if (addStart) setExactPoint(projectPoint(snapped.point, plane));
  }, [addStart, feedRatioFromPointer, fixedCoordinate, fromScreen, localCoordinates, moveEndpoint, moveWire, pixelsPerMeter, plane, resolveSnap, setExcitationPosition, snapSize]);

  const finishPointerGesture = useCallback(() => {
    panRef.current = null;
    if (feedDragRef.current) {
      const wireTag = feedDragRef.current.wireTag;
      feedDragRef.current = null;
      commitGeometryTransaction();
      setFreeFeedPlacement(false);
      setPickingExcitationForTag(null);
      setStatus(`Feedpoint placed on Wire ${wireTag}. Use the inspector for exact percentage or whole-polyline distance.`);
      return;
    }
    if (wireDragRef.current) {
      const wireTag = wireDragRef.current.tag;
      wireDragRef.current = null;
      commitGeometryTransaction();
      setStatus(`Wire ${wireTag} moved. Joined endpoints remained bonded; Undo restores the previous geometry.`);
      return;
    }
    const drag = dragRef.current;
    if (!drag) return;
    commitGeometryTransaction();
    dragRef.current = null;
    if (drag.snapTarget && endpointSnap) {
      clearEndpointSelection();
      selectEndpoint({ wireTag: drag.tag, endpoint: drag.endpoint });
      toggleSelectedJunction();
      setStatus(`Endpoint joined to Wire ${drag.snapTarget.wireTag} ${drag.snapTarget.endpoint}.`);
    } else {
      setStatus(drag.moved ? `Wire ${drag.tag} ${drag.endpoint} moved; its opposite endpoint remained anchored.` : `Wire ${drag.tag} ${drag.endpoint} selected.`);
    }
  }, [clearEndpointSelection, commitGeometryTransaction, endpointSnap, selectEndpoint, setPickingExcitationForTag, toggleSelectedJunction]);

  const handleWirePointerDown = useCallback((event: ReactPointerEvent<SVGLineElement>, wire: EditorWire) => {
    if (beginFeedPlacement(event, wire)) return;
    if (mode === "add" || event.button !== 0) return;
    event.stopPropagation();
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      toggleSelection(wire.tag);
      return;
    }
    const local = localCoordinates(event);
    if (!local) return;
    selectWire(wire.tag);
    clearEndpointSelection();
    beginGeometryTransaction();
    wireDragRef.current = {
      tag: wire.tag,
      pointerOrigin: expandPoint(fromScreen(local.x, local.y), plane, fixedCoordinate),
      appliedDelta: { x: 0, y: 0, z: 0 },
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setStatus(`Moving Wire ${wire.tag}. Its joined endpoints will move connected neighbouring wire ends; release to commit or press Escape to cancel.`);
  }, [beginFeedPlacement, beginGeometryTransaction, clearEndpointSelection, fixedCoordinate, fromScreen, localCoordinates, mode, plane, selectWire, toggleSelection]);

  const handleWireDoubleClick = useCallback((event: ReactMouseEvent<SVGLineElement>, wire: EditorWire) => {
    if (mode !== "select" || feedPlacementActive) return;
    event.preventDefault();
    event.stopPropagation();
    const radialOwner = radialSystems.find((system) => system.generatedWireTags.includes(wire.tag));
    if (radialOwner) {
      selectWire(radialOwner.drivenWireTag);
      setStatus(`Wire ${wire.tag} belongs to ${radialOwner.name}. Edit that managed radial system or explode it first.`);
      return;
    }
    const local = localCoordinates(event);
    selectWire(wire.tag);
    setWireEdit({
      draft: { ...wire },
      anchor: "start",
      position: {
        u: Math.max(8, Math.min(size.width - 372, (local?.x ?? size.width / 2) + 18)),
        v: Math.max(72, Math.min(size.height - 330, (local?.y ?? size.height / 2) - 80)),
      },
    });
    setStatus(`Editing Wire ${wire.tag}. Apply creates one undoable change; Cancel keeps its original geometry.`);
  }, [feedPlacementActive, localCoordinates, mode, radialSystems, selectWire, size.height, size.width]);

  const handleEndpointPointerDown = useCallback((event: ReactPointerEvent<SVGCircleElement>, tag: number, endpoint: WireEndpoint) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const wire = wires.find((candidate) => candidate.tag === tag);
    if (!wire) return;
    const ref = { wireTag: tag, endpoint };
    if (feedPlacementActive) {
      beginGeometryTransaction();
      const ratio = endpoint === "start" ? 0 : 1;
      if (!placeFeedOnWire(wire, ratio)) {
        commitGeometryTransaction();
        setFreeFeedPlacement(false);
        setPickingExcitationForTag(null);
        return;
      }
      commitGeometryTransaction();
      setFreeFeedPlacement(false);
      setPickingExcitationForTag(null);
      setStatus(`Feedpoint requested at the ${endpoint} of Wire ${tag} (${ratio * 100}%). NEC uses the centre of the ${endpoint === "start" ? "first" : "last"} segment.`);
      return;
    }
    if (mode === "add") {
      const value = { point: pointOf(wire, endpoint), kind: "endpoint" as const, endpoint: ref };
      if (addStart) completeWire(value);
      else {
        setAddStart(value);
        setExactPoint(projectPoint(value.point, plane));
        setStatus(`Started at Wire ${tag} ${endpoint}. Left-click the endpoint; right-click cancels.`);
      }
      return;
    }
    if (mode === "move" || mode === "select") {
      selectWire(tag, event.shiftKey || event.ctrlKey || event.metaKey);
      selectEndpoint(ref);
      if (event.shiftKey || event.ctrlKey || event.metaKey) return;
      beginGeometryTransaction();
      dragRef.current = { tag, endpoint, snapTarget: null, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
      setStatus(`Moving Wire ${tag} ${endpoint}; the ${endpoint === "start" ? "end" : "start"} remains anchored. Right-click or Escape cancels.`);
      return;
    }
    selectWire(tag, event.shiftKey || event.ctrlKey || event.metaKey);
    selectEndpoint(ref);
  }, [addStart, beginGeometryTransaction, commitGeometryTransaction, completeWire, feedPlacementActive, mode, placeFeedOnWire, plane, selectEndpoint, selectWire, setPickingExcitationForTag, wires]);

  const handleWheel = useCallback((event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const local = localCoordinates(event);
    if (!local) return;
    const before = fromScreen(local.x, local.y);
    const nextScale = Math.max(2, Math.min(320, pixelsPerMeter * Math.exp(-event.deltaY * 0.0015)));
    const nextCenter = {
      u: before.u - (local.x - size.width / 2) / nextScale,
      v: before.v + (local.y - size.height / 2) / nextScale,
    };
    setPixelsPerMeter(nextScale);
    setCenter(nextCenter);
  }, [fromScreen, localCoordinates, pixelsPerMeter, size.height, size.width]);

  const placeExact = useCallback(() => {
    const snapped = resolveSnap(exactPoint);
    completeWire(snapped.endpoint
      ? snapped
      : { point: expandPoint(exactPoint, plane, fixedCoordinate), kind: "free", endpoint: null });
  }, [completeWire, exactPoint, fixedCoordinate, plane, resolveSnap]);

  const setExactLength = useCallback((displayLength: number) => {
    if (!addStart || !Number.isFinite(displayLength) || displayLength <= 0) return;
    const start = projectPoint(addStart.point, plane);
    const du = exactPoint.u - start.u;
    const dv = exactPoint.v - start.v;
    const angle = Math.hypot(du, dv) > 1e-12 ? Math.atan2(dv, du) * 180 / Math.PI : 0;
    setExactPoint(endpointFromLengthAngle(start, editorUnitToMetres(displayLength, precisionUnit), angle));
  }, [addStart, exactPoint, plane, precisionUnit]);

  const setExactAngle = useCallback((angleDeg: number) => {
    if (!addStart || !Number.isFinite(angleDeg)) return;
    const start = projectPoint(addStart.point, plane);
    const length = Math.hypot(exactPoint.u - start.u, exactPoint.v - start.v);
    setExactPoint(endpointFromLengthAngle(start, length, angleDeg));
  }, [addStart, exactPoint, plane]);

  const gridStep = niceGridStep(pixelsPerMeter);
  const bounds = useMemo(() => ({
    minU: center.u - size.width / (2 * pixelsPerMeter),
    maxU: center.u + size.width / (2 * pixelsPerMeter),
    minV: center.v - size.height / (2 * pixelsPerMeter),
    maxV: center.v + size.height / (2 * pixelsPerMeter),
  }), [center, pixelsPerMeter, size]);
  const verticalGrid = useMemo(() => {
    const values: number[] = [];
    const first = Math.ceil(bounds.minU / gridStep) * gridStep;
    for (let value = first; value <= bounds.maxU && values.length < 250; value += gridStep) values.push(Number(value.toPrecision(12)));
    return values;
  }, [bounds.maxU, bounds.minU, gridStep]);
  const horizontalGrid = useMemo(() => {
    const values: number[] = [];
    const first = Math.ceil(bounds.minV / gridStep) * gridStep;
    for (let value = first; value <= bounds.maxV && values.length < 250; value += gridStep) values.push(Number(value.toPrecision(12)));
    return values;
  }, [bounds.maxV, bounds.minV, gridStep]);

  const ghost = addStart ? { start: projectPoint(addStart.point, plane), end: exactPoint } : null;
  const exactDelta = addStart ? (() => {
    const start = projectPoint(addStart.point, plane);
    const du = exactPoint.u - start.u, dv = exactPoint.v - start.v;
    return { du, dv, length: Math.hypot(du, dv), angle: Math.atan2(dv, du) * 180 / Math.PI };
  })() : null;
  const precisionPanelAutoPosition = useMemo(() => {
    const anchor = toScreen(addStart ? projectPoint(addStart.point, plane) : exactPoint);
    const panelWidth = Math.min(360, Math.max(300, size.width - 16));
    const panelHeight = 245;
    // Keep the panel on the opposite side of the start from the proposed wire,
    // so it cannot intercept the second endpoint click.
    const preferredX = exactDelta && exactDelta.du >= 0 ? anchor.x - panelWidth - 24 : anchor.x + 24;
    const preferredY = exactDelta && exactDelta.dv >= 0 ? anchor.y + 24 : anchor.y - panelHeight - 24;
    return {
      u: Math.max(8, Math.min(size.width - panelWidth - 8, preferredX)),
      v: Math.max(72, Math.min(size.height - panelHeight - 8, preferredY)),
    };
  }, [addStart, exactDelta, exactPoint, plane, size.height, size.width, toScreen]);
  const activePrecisionPanelPosition = precisionPanelPosition ?? precisionPanelAutoPosition;

  return (
    <section className="relative h-full w-full overflow-hidden bg-background" data-testid="wire-editor-2d" aria-label="Fixed two-dimensional wire editor">
      <div className="pointer-events-none absolute left-2 right-2 top-12 z-20 flex flex-wrap items-start justify-between gap-2">
        <div className="pointer-events-auto rounded-md border border-border bg-surface/95 p-1 shadow-lg backdrop-blur-sm">
          <div className="flex flex-wrap gap-1" role="group" aria-label="Drawing plane">
            {(Object.keys(DRAWING_PLANES) as DrawingPlane[]).map((candidate) => (
              <button key={candidate} type="button" onClick={() => changePlane(candidate)} aria-pressed={plane === candidate} className={`rounded px-2 py-1 text-[10px] font-semibold ${plane === candidate ? "bg-accent text-white" : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"}`}>
                {DRAWING_PLANES[candidate].label}
              </button>
            ))}
          </div>
          <div className="mt-1 flex items-center gap-1 border-t border-border pt-1 text-[10px]">
            <label className="flex items-center gap-1 text-text-secondary">
              {definition.fixed.toUpperCase()} fixed
              <input data-testid="drawing-plane-offset" type="number" value={fixedCoordinate} step={snapSize || 0.1} onChange={(event) => setFixedCoordinate(Number(event.currentTarget.value) || 0)} className="w-20 rounded border border-border bg-background px-1.5 py-1 text-right font-mono text-text-primary" /> m
            </label>
            <button type="button" onClick={() => setCenter({ u: 0, v: plane === "xy" ? 0 : 3 })} className="rounded border border-border px-1.5 py-1 text-text-secondary hover:text-accent">Origin</button>
            <button type="button" onClick={() => fitAntenna()} className="rounded border border-border px-1.5 py-1 text-text-secondary hover:text-accent">Fit</button>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-1 text-[10px] text-text-secondary">
            <label className="flex cursor-pointer items-center gap-1"><input type="checkbox" checked={continuousDraw} onChange={(event) => setContinuousDraw(event.currentTarget.checked)} className="accent-accent" /> Continue chain</label>
            <label className="flex cursor-pointer items-center gap-1"><input type="checkbox" checked={endpointSnap} onChange={(event) => setEndpointSnap(event.currentTarget.checked)} className="accent-accent" /> Join endpoints</label>
            <button type="button" data-testid="place-feedpoint-2d" disabled={wires.length === 0} aria-pressed={feedPlacementActive} onClick={() => { const next = !freeFeedPlacement; setFreeFeedPlacement(next); setPickingExcitationForTag(null); setStatus(next ? "Click or drag on any wire to place the feedpoint. Right-click cancels." : "Feedpoint placement cancelled."); }} className={`rounded border px-1.5 py-0.5 font-semibold disabled:opacity-40 ${feedPlacementActive ? "border-orange-400 bg-orange-500/20 text-orange-400" : "border-border text-text-secondary hover:text-orange-400"}`}>● Place feedpoint</button>
          </div>
        </div>
        <div className="rounded-md border border-border bg-surface/90 px-2 py-1.5 text-right text-[10px] shadow backdrop-blur-sm">
          <p className="font-semibold text-text-primary">{definition.label} · {definition.description}</p>
          <p className="font-mono text-text-secondary">{definition.fixed.toUpperCase()} = {fixedCoordinate.toFixed(3)} m · grid {formatCoordinate(gridStep)} m</p>
        </div>
      </div>

      <svg
        ref={svgRef}
        className={`h-full w-full touch-none select-none ${mode === "add" ? "cursor-crosshair" : ""}`}
        data-testid="wire-editor-2d-canvas"
        onPointerDown={handleBackgroundPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerGesture}
        onPointerCancel={finishPointerGesture}
        onWheel={handleWheel}
        onContextMenu={(event) => {
          if (mode === "add" || addStart || dragRef.current || wireDragRef.current || feedPlacementActive) {
            event.preventDefault();
            cancelDrawing();
          }
        }}
        role="application"
        aria-label={`${definition.label} wire drawing canvas. ${definition.fixed.toUpperCase()} is fixed at ${fixedCoordinate} metres.`}
      >
        <rect width="100%" height="100%" className="fill-background" />
        {showGrid && verticalGrid.map((value) => {
          const screen = toScreen({ u: value, v: 0 });
          return <g key={`u-${value}`}><line x1={screen.x} y1={0} x2={screen.x} y2={size.height} className={Math.abs(value) < gridStep / 100 ? "stroke-accent/60" : "stroke-border/60"} strokeWidth={Math.abs(value) < gridStep / 100 ? 1.5 : 1} /><text x={screen.x + 3} y={size.height - 8} className="fill-text-secondary text-[9px]">{formatCoordinate(value)}</text></g>;
        })}
        {showGrid && horizontalGrid.map((value) => {
          const screen = toScreen({ u: 0, v: value });
          return <g key={`v-${value}`}><line x1={0} y1={screen.y} x2={size.width} y2={screen.y} className={Math.abs(value) < gridStep / 100 ? "stroke-accent/60" : "stroke-border/60"} strokeWidth={Math.abs(value) < gridStep / 100 ? 1.5 : 1} /><text x={5} y={screen.y - 4} className="fill-text-secondary text-[9px]">{formatCoordinate(value)}</text></g>;
        })}
        {definition.vertical === "z" && (() => { const y = toScreen({ u: 0, v: 0 }).y; return <g><line x1={0} y1={y} x2={size.width} y2={y} className="stroke-amber-500/80" strokeWidth={2} /><text x={size.width - 8} y={y - 6} textAnchor="end" className="fill-amber-500 text-[10px] font-semibold">GROUND Z=0</text></g>; })()}
        {(() => { const origin = toScreen({ u: 0, v: 0 }); return <g data-testid="drawing-origin"><circle cx={origin.x} cy={origin.y} r={8} fill="none" className="stroke-accent" strokeWidth={1.5} /><line x1={origin.x - 13} y1={origin.y} x2={origin.x + 13} y2={origin.y} className="stroke-accent" /><line x1={origin.x} y1={origin.y - 13} x2={origin.x} y2={origin.y + 13} className="stroke-accent" /><text x={origin.x + 10} y={origin.y - 10} className="fill-accent text-[10px] font-semibold">ORIGIN 0,0</text></g>; })()}

        {wires.map((wire) => {
          const start = toScreen(projectPoint(pointOf(wire, "start"), plane));
          const end = toScreen(projectPoint(pointOf(wire, "end"), plane));
          const selected = selectedTags.has(wire.tag);
          const radial = radialWireTags.has(wire.tag);
          return <g key={wire.tag} data-wire-tag={wire.tag} data-radial-wire={radial || undefined}>
            <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="transparent" strokeWidth={14} data-testid={`wire-body-hit-${wire.tag}`} className={feedPlacementActive || mode === "add" ? "cursor-crosshair" : "cursor-move"} onPointerDown={(event) => handleWirePointerDown(event, wire)} onDoubleClick={(event) => handleWireDoubleClick(event, wire)} />
            <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} data-testid={`wire-visible-${wire.tag}`} className={`pointer-events-none ${selected ? "stroke-accent" : radial ? "stroke-cyan-300" : "stroke-cyan-400"}`} strokeWidth={selected ? 4 : radial ? 3.5 : 3} />
            <text x={(start.x + end.x) / 2 + 5} y={(start.y + end.y) / 2 - 5} className="pointer-events-none fill-text-primary text-[10px] font-semibold">W{wire.tag}</text>
            {(["start", "end"] as const).map((endpoint) => {
              const screen = endpoint === "start" ? start : end;
              const hovered = sameRef(cursor?.endpoint ?? null, { wireTag: wire.tag, endpoint });
              return <circle key={endpoint} cx={screen.x} cy={screen.y} r={hovered ? 5.5 : 4} data-testid={`wire-endpoint-${wire.tag}-${endpoint}`} className={`${hovered ? "fill-white stroke-accent" : "fill-surface stroke-cyan-400"} ${mode === "select" || mode === "move" ? "cursor-move" : "cursor-crosshair"}`} strokeWidth={1.5} onPointerDown={(event) => handleEndpointPointerDown(event, wire.tag, endpoint)} />;
            })}
          </g>;
        })}

        {excitations.map((excitation) => {
          const wire = wires.find((candidate) => candidate.tag === excitation.wire_tag);
          if (!wire) return null;
          const point = requestedFeedpointPosition(excitation, wire);
          const screen = toScreen(projectPoint(point, plane));
          return <g key={`feed-${wire.tag}`} className="pointer-events-none"><circle cx={screen.x} cy={screen.y} r={6} className="fill-orange-500 stroke-white" strokeWidth={1.5} /><text x={screen.x + 8} y={screen.y - 8} className="fill-orange-400 text-[9px] font-semibold">FEED</text></g>;
        })}

        {ghost && (() => {
          const start = toScreen(ghost.start), end = toScreen(ghost.end);
          return <g className="pointer-events-none" data-testid="exact-wire-preview" data-length-m={exactDelta?.length} data-angle-deg={exactDelta?.angle}><line x1={start.x} y1={start.y} x2={end.x} y2={end.y} className="stroke-accent" strokeWidth={2} strokeDasharray="7 5" /><circle cx={end.x} cy={end.y} r={5} className="fill-accent" /></g>;
        })()}
      </svg>

      <div className="pointer-events-none absolute bottom-2 left-2 z-20 max-w-[calc(100%-1rem)] rounded-md border border-border bg-surface/90 px-2 py-1.5 text-[10px] shadow backdrop-blur-sm">
        <p className="font-mono text-text-primary" data-testid="drawing-cursor-readout">
          {cursor ? `${definition.horizontal.toUpperCase()} ${formatCoordinate(projectPoint(cursor.point, plane).u)} m · ${definition.vertical.toUpperCase()} ${formatCoordinate(projectPoint(cursor.point, plane).v)} m · ${definition.fixed.toUpperCase()} ${formatCoordinate(cursor.point[definition.fixed])} m` : "Move the pointer over the drawing plane"}
          {cursor && cursor.kind !== "free" ? ` · SNAP: ${cursor.kind.toUpperCase()}` : ""}
        </p>
        <p className="text-text-secondary">{status} · wheel zoom · middle-drag or Shift+drag pan</p>
      </div>

      {addStart && exactDelta && (
        <div
          className="absolute z-30 w-[min(360px,calc(100%-1rem))] rounded-lg border border-accent/40 bg-surface/95 p-2 shadow-xl backdrop-blur-sm"
          data-testid="exact-wire-entry"
          style={{ left: activePrecisionPanelPosition.u, top: activePrecisionPanelPosition.v }}
          onContextMenu={(event) => {
            event.preventDefault();
            cancelDrawing();
          }}
          onKeyDown={(event) => {
            trapPrecisionTab(event);
            if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
              event.preventDefault();
              placeExact();
            }
          }}
        >
          <div
            className="flex cursor-move touch-none items-center justify-between border-b border-border pb-1"
            title="Drag to move this precision panel"
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              precisionDragRef.current = { pointerX: event.clientX, pointerY: event.clientY, originX: activePrecisionPanelPosition.u, originY: activePrecisionPanelPosition.v };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const drag = precisionDragRef.current;
              if (!drag) return;
              setPrecisionPanelPosition({
                u: Math.max(8, Math.min(size.width - Math.min(360, size.width - 16) - 8, drag.originX + event.clientX - drag.pointerX)),
                v: Math.max(72, Math.min(size.height - 245 - 8, drag.originY + event.clientY - drag.pointerY)),
              });
            }}
            onPointerUp={(event) => {
              precisionDragRef.current = null;
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">Exact next endpoint <span className="normal-case text-text-secondary">· drag panel</span></p>
            <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={cancelDrawing} className="text-[10px] text-text-secondary hover:text-text-primary">Cancel</button>
          </div>
          <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
            <label className="text-[10px] text-text-secondary">Length
              <EditableNumberField ref={lengthInputRef} data-precision-field data-testid="exact-wire-length" type="number" min={0} step={precisionUnit === "mm" ? 1 : precisionUnit === "in" ? 0.1 : 0.01} value={metresToEditorUnit(exactDelta.length, precisionUnit)} decimals={editorUnitDecimals(precisionUnit)} onValueChange={setExactLength} className="mt-1 w-full rounded border border-accent/50 bg-background px-2 py-1 text-right font-mono text-text-primary" />
            </label>
            <label className="text-[10px] text-text-secondary">Angle
              <EditableNumberField data-precision-field data-testid="exact-wire-angle" type="number" step={0.1} value={exactDelta.angle} decimals={1} onValueChange={setExactAngle} className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-right font-mono text-text-primary" />
            </label>
            <label className="text-[10px] text-text-secondary">Unit
              <select data-precision-field value={precisionUnit} onChange={(event) => setPrecisionUnitOverride(event.currentTarget.value as EditorLengthUnit)} className="mt-1 block rounded border border-border bg-background px-1.5 py-1 font-mono text-text-primary" data-testid="exact-wire-unit">
                <option value="m">m</option><option value="mm">mm</option><option value="ft">ft</option><option value="in">in</option>
              </select>
            </label>
          </div>
          <p className="mt-1 text-[9px] text-text-secondary">Move the pointer to choose direction, then press <kbd className="font-mono text-text-primary">L</kbd>, type the exact length and press Enter.</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {([definition.horizontal, definition.vertical] as const).map((axis, index) => <label key={axis} className="text-[10px] text-text-secondary">{axis.toUpperCase()} endpoint ({precisionUnit})<EditableNumberField data-precision-field data-testid={`exact-wire-coordinate-${axis}`} type="number" step={metresToEditorUnit(snapSize || 0.001, precisionUnit)} value={metresToEditorUnit(index === 0 ? exactPoint.u : exactPoint.v, precisionUnit)} decimals={editorUnitDecimals(precisionUnit)} onValueChange={(next) => { const value = editorUnitToMetres(next, precisionUnit); setExactPoint((current) => index === 0 ? { ...current, u: value } : { ...current, v: value }); }} className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-right font-mono text-text-primary" /></label>)}
          </div>
          <p className="mt-2 font-mono text-[10px] text-text-secondary">Δ{definition.horizontal.toUpperCase()} {metresToEditorUnit(exactDelta.du, precisionUnit).toFixed(editorUnitDecimals(precisionUnit))} {precisionUnit} · Δ{definition.vertical.toUpperCase()} {metresToEditorUnit(exactDelta.dv, precisionUnit).toFixed(editorUnitDecimals(precisionUnit))} {precisionUnit} · angle {exactDelta.angle.toFixed(1)}°</p>
          <button type="button" onClick={placeExact} disabled={exactDelta.length < 1e-8} className="mt-2 w-full rounded bg-accent px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Place wire · Enter</button>
        </div>
      )}

      {wireEdit && (() => {
        const draft = wireEdit.draft;
        const projectedStart = projectPoint(pointOf(draft, "start"), plane);
        const projectedEnd = projectPoint(pointOf(draft, "end"), plane);
        const projectedAngle = Math.atan2(projectedEnd.v - projectedStart.v, projectedEnd.u - projectedStart.u) * 180 / Math.PI;
        const coordinateFields = ["x1", "y1", "z1", "x2", "y2", "z2"] as const;
        const applyDraft = () => {
          updateWire(draft.tag, { x1: draft.x1, y1: draft.y1, z1: draft.z1, x2: draft.x2, y2: draft.y2, z2: draft.z2 });
          setWireEdit(null);
          setStatus(`Wire ${draft.tag} updated. Undo restores its previous geometry.`);
        };
        return <div
          className="absolute z-40 w-[min(380px,calc(100%-1rem))] rounded-lg border border-cyan-400/50 bg-surface/95 p-2 shadow-xl backdrop-blur-sm"
          data-testid="existing-wire-precision-editor"
          style={{ left: wireEdit.position.u, top: wireEdit.position.v }}
          onContextMenu={(event) => { event.preventDefault(); setWireEdit(null); setStatus("Wire edit cancelled; geometry was not changed."); }}
          onKeyDown={(event) => {
            trapPrecisionTab(event);
            if (event.key === "Enter" && event.target instanceof HTMLInputElement) { event.preventDefault(); applyDraft(); }
          }}
        >
          <div className="flex items-center justify-between border-b border-border pb-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-300">Edit Wire {draft.tag}</p>
            <button type="button" onClick={() => { setWireEdit(null); setStatus("Wire edit cancelled; geometry was not changed."); }} className="text-[10px] text-text-secondary hover:text-text-primary">Cancel</button>
          </div>
          <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
            <label className="text-[10px] text-text-secondary">Length
              <EditableNumberField data-precision-field data-testid="existing-wire-length" type="number" min={0} value={metresToEditorUnit(wireLength(draft), precisionUnit)} decimals={editorUnitDecimals(precisionUnit)} onValueChange={(next) => { const lengthM = editorUnitToMetres(next, precisionUnit); setWireEdit((current) => current ? { ...current, draft: resizeWireDraft(current.draft, lengthM, current.anchor) } : current); }} className="mt-1 w-full rounded border border-cyan-400/40 bg-background px-2 py-1 text-right font-mono text-text-primary" />
            </label>
            <label className="text-[10px] text-text-secondary">{definition.label} angle
              <EditableNumberField data-precision-field data-testid="existing-wire-angle" type="number" step={0.1} value={projectedAngle} decimals={1} onValueChange={(angle) => setWireEdit((current) => current ? { ...current, draft: rotateWireDraftInPlane(current.draft, plane, angle, current.anchor) } : current)} className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-right font-mono text-text-primary" />
            </label>
            <label className="text-[10px] text-text-secondary">Unit
              <select data-precision-field value={precisionUnit} onChange={(event) => setPrecisionUnitOverride(event.currentTarget.value as EditorLengthUnit)} className="mt-1 block rounded border border-border bg-background px-1.5 py-1 font-mono text-text-primary"><option value="m">m</option><option value="mm">mm</option><option value="ft">ft</option><option value="in">in</option></select>
            </label>
          </div>
          <label className="mt-2 block text-[10px] text-text-secondary">Length anchor
            <select data-precision-field data-testid="existing-wire-anchor" value={wireEdit.anchor} onChange={(event) => { const anchor = event.currentTarget.value as WireLengthAnchor; setWireEdit((current) => current ? { ...current, anchor } : current); }} className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-text-primary"><option value="start">Keep start fixed</option><option value="end">Keep end fixed</option><option value="center">Keep centre fixed</option></select>
          </label>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {coordinateFields.map((field) => <label key={field} className="text-[9px] text-text-secondary">{field.toUpperCase()} ({precisionUnit})<EditableNumberField data-precision-field data-testid={`existing-wire-${field}`} type="number" value={metresToEditorUnit(draft[field], precisionUnit)} decimals={editorUnitDecimals(precisionUnit)} onValueChange={(next) => { const value = editorUnitToMetres(next, precisionUnit); setWireEdit((current) => current ? { ...current, draft: { ...current.draft, [field]: value } } : current); }} className="mt-0.5 w-full rounded border border-border bg-background px-1.5 py-1 text-right font-mono text-text-primary" /></label>)}
          </div>
          <p className="mt-2 text-[9px] leading-4 text-text-secondary">Angle is measured in the active {definition.label} plane. Direct X/Y/Z values remain available for arbitrary 3D wires.</p>
          <div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => { setWireEdit(null); setStatus("Wire edit cancelled; geometry was not changed."); }} className="rounded border border-border px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary">Cancel</button><button type="button" onClick={applyDraft} className="rounded bg-accent px-2 py-1.5 text-xs font-semibold text-white">Apply · Enter</button></div>
        </div>;
      })()}
    </section>
  );
}
