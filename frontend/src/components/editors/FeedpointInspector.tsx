import { useMemo } from "react";
import { useEditorStore, type EditorWire } from "../../stores/editorStore";
import { feedpointPlacement, wireLengthM } from "../../features/wire-editor/feedpoint";
import { editorUnitDecimals, editorUnitToMetres, metresToEditorUnit, type EditorLengthUnit } from "../../features/wire-editor/units";
import { connectedPolylinePath, polylineDistanceForRatio, polylinePositionAtDistance } from "../../features/wire-editor/polyline";
import { NumberInput } from "../ui/NumberInput";

interface FeedpointInspectorProps {
  wire: EditorWire;
  unit: EditorLengthUnit;
}

export function FeedpointInspector({ wire, unit }: FeedpointInspectorProps) {
  const excitations = useEditorStore((state) => state.excitations);
  const wires = useEditorStore((state) => state.wires);
  const junctions = useEditorStore((state) => state.junctions);
  const radialSystems = useEditorStore((state) => state.radialSystems);
  const setExcitationPosition = useEditorStore((state) => state.setExcitationPosition);
  const moveExcitationToPosition = useEditorStore((state) => state.moveExcitationToPosition);
  const updateExcitation = useEditorStore((state) => state.updateExcitation);
  const removeExcitation = useEditorStore((state) => state.removeExcitation);
  const pickingExcitationForTag = useEditorStore((state) => state.pickingExcitationForTag);
  const setPickingExcitationForTag = useEditorStore((state) => state.setPickingExcitationForTag);
  const beginGeometryTransaction = useEditorStore((state) => state.beginGeometryTransaction);
  const commitGeometryTransaction = useEditorStore((state) => state.commitGeometryTransaction);
  const selectWire = useEditorStore((state) => state.selectWire);
  const source = excitations.find((candidate) => candidate.wire_tag === wire.tag);
  const ownedRadialSystem = radialSystems.find((system) => system.generatedWireTags.includes(wire.tag));
  const drivenRadialSystem = radialSystems.find((system) => system.drivenWireTag === wire.tag);
  const placement = useMemo(() => source ? feedpointPlacement(source, wire) : null, [source, wire]);
  const polyline = useMemo(() => connectedPolylinePath(wires, junctions, wire.tag), [junctions, wire.tag, wires]);
  const isPicking = pickingExcitationForTag === wire.tag;
  const magnitude = source ? Math.hypot(source.voltage_real, source.voltage_imag) : 1;
  const phase = source ? Math.atan2(source.voltage_imag, source.voltage_real) * 180 / Math.PI : 0;

  const setPolarVoltage = (nextMagnitude: number, nextPhase: number) => {
    const radians = nextPhase * Math.PI / 180;
    updateExcitation(wire.tag, {
      voltage_real: nextMagnitude * Math.cos(radians),
      voltage_imag: nextMagnitude * Math.sin(radians),
    });
  };

  if (ownedRadialSystem) {
    return <div className="rounded-md border border-cyan-500/30 bg-cyan-500/5 p-2 text-[10px] leading-4 text-text-secondary" data-testid="managed-radial-feedpoint-note"><b className="text-cyan-400">Managed radial conductor.</b> The source remains on driven Wire {ownedRadialSystem.drivenWireTag} beside the common hub. Explode {ownedRadialSystem.name} before assigning an independent source to this wire.</div>;
  }

  if (!source || !placement) {
    return <div className="space-y-2 rounded-md border border-swr-warning/40 bg-swr-warning/5 p-2" data-testid="feedpoint-inspector-empty">
      <div>
        <h5 className="text-xs font-semibold text-text-primary">Feedpoint</h5>
        <p className="text-[10px] leading-4 text-text-secondary">No source is assigned to wire {wire.tag}.</p>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <button type="button" onClick={() => setExcitationPosition(wire.tag, 0.5)} className="rounded bg-swr-warning/20 px-2 py-1 text-[11px] font-semibold text-swr-warning">Place at 50%</button>
        <button type="button" onClick={() => { setExcitationPosition(wire.tag, 0.5); setPickingExcitationForTag(wire.tag); }} className="rounded bg-accent/15 px-2 py-1 text-[11px] font-semibold text-accent">Place on wire</button>
      </div>
      {polyline.legs.length > 1 && <label className="block text-[10px] text-text-secondary">Choose connected polyline leg
        <select defaultValue="" onChange={(event) => { const tag = Number(event.currentTarget.value); if (!tag) return; setExcitationPosition(tag, 0.5); selectWire(tag); }} className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-text-primary">
          <option value="" disabled>Select a leg…</option>
          {polyline.legs.map((leg, index) => <option key={leg.wireTag} value={leg.wireTag}>Leg {index + 1} — Wire {leg.wireTag} ({metresToEditorUnit(leg.lengthM, unit).toFixed(editorUnitDecimals(unit))} {unit})</option>)}
        </select>
      </label>}
    </div>;
  }

  const requestedPercent = placement.requestedRatio * 100;
  const actualPercent = placement.actualRatio * 100;
  const requestedDistance = metresToEditorUnit(placement.requestedDistanceM, unit);
  const lengthM = wireLengthM(wire);
  const lengthInUnit = metresToEditorUnit(lengthM, unit);
  const placementFractionOfSegment = placement.placementErrorM / Math.max(1e-12, lengthM / wire.segments);
  const polylineDistanceM = polylineDistanceForRatio(polyline, wire.tag, placement.requestedRatio);
  const polylineDistanceInUnit = polylineDistanceM === null ? null : metresToEditorUnit(polylineDistanceM, unit);
  const polylineLengthInUnit = metresToEditorUnit(polyline.totalLengthM, unit);

  const moveAlongPolyline = (distanceInUnit: number) => {
    const target = polylinePositionAtDistance(polyline, editorUnitToMetres(distanceInUnit, unit));
    if (!target) return;
    const result = moveExcitationToPosition(wire.tag, target.wireTag, target.wireRatio);
    if (result.ok && target.wireTag !== wire.tag) selectWire(target.wireTag);
  };

  const moveToLeg = (targetWireTag: number) => {
    const result = moveExcitationToPosition(wire.tag, targetWireTag, 0.5);
    if (result.ok && targetWireTag !== wire.tag) selectWire(targetWireTag);
  };

  return <div className="space-y-2 rounded-md border border-swr-warning/40 bg-swr-warning/5 p-2" data-testid="feedpoint-inspector">
    <div className="flex items-center justify-between gap-2">
      <div>
        <h5 className="text-xs font-semibold text-text-primary">Feedpoint</h5>
        <p className="text-[10px] text-text-secondary">Source on NEC wire {wire.tag}, segment {source.segment} of {wire.segments}</p>
      </div>
      <button type="button" onClick={() => { removeExcitation(wire.tag); setPickingExcitationForTag(null); }} className="rounded px-2 py-1 text-[10px] text-swr-bad hover:bg-swr-bad/10">Remove</button>
    </div>

    <label className="block text-[10px] font-semibold text-text-secondary" htmlFor={`feed-position-${wire.tag}`}>Requested position: {requestedPercent.toFixed(1)}%</label>
    <input
      id={`feed-position-${wire.tag}`}
      data-testid="feed-position-slider"
      type="range"
      min={0}
      max={100}
      step={0.1}
      value={requestedPercent}
      onPointerDown={beginGeometryTransaction}
      onPointerUp={commitGeometryTransaction}
      onChange={(event) => setExcitationPosition(wire.tag, Number(event.currentTarget.value) / 100)}
      className="w-full accent-swr-warning"
    />
    <div className="grid grid-cols-2 gap-2">
      <NumberInput label="Position" value={requestedPercent} onChange={(value) => setExcitationPosition(wire.tag, value / 100)} min={0} max={100} decimals={1} unit="%" />
      <NumberInput label="From start" value={requestedDistance} onChange={(value) => setExcitationPosition(wire.tag, editorUnitToMetres(value, unit) / Math.max(1e-12, editorUnitToMetres(lengthInUnit, unit)))} min={0} max={lengthInUnit} decimals={editorUnitDecimals(unit)} unit={unit} />
    </div>

    <div className="rounded border border-border/70 bg-background/60 p-2 font-mono text-[10px] leading-4 text-text-secondary">
      <div>Requested: {requestedPercent.toFixed(2)}% ({requestedDistance.toFixed(editorUnitDecimals(unit))} {unit})</div>
      <div>Actual NEC segment centre: {actualPercent.toFixed(2)}% ({metresToEditorUnit(placement.actualDistanceM, unit).toFixed(editorUnitDecimals(unit))} {unit})</div>
      <div>EX 0 {wire.tag} {source.segment} 0 {source.voltage_real.toFixed(4)} {source.voltage_imag.toFixed(4)}</div>
    </div>
    {placementFractionOfSegment > 0.35 && <p className="rounded border border-swr-warning/30 bg-swr-warning/10 p-1.5 text-[10px] leading-4 text-swr-warning">The requested point is noticeably displaced from the available segment centre. Increase segmentation if that placement accuracy matters.</p>}
    {(requestedPercent === 0 || requestedPercent === 100) && <p className="text-[10px] leading-4 text-text-secondary">At 0% or 100%, NEC excites the centre of the first or last segment—not the mathematical endpoint. An end-fed antenna also needs a physically meaningful return path or counterpoise.</p>}

    <div className="grid grid-cols-2 gap-2 border-t border-border/70 pt-2">
      <NumberInput label="Magnitude" value={magnitude} onChange={(value) => setPolarVoltage(Math.max(0, value), phase)} min={0} max={1000} decimals={3} unit="V rel." />
      <NumberInput label="Phase" value={phase} onChange={(value) => setPolarVoltage(magnitude, value)} min={-360} max={360} decimals={1} unit="deg" />
    </div>
    {drivenRadialSystem && <p className="rounded border border-cyan-500/25 bg-cyan-500/5 p-1.5 text-[10px] leading-4 text-text-secondary">The radial hub is a branched managed junction. Radial legs are not offered as alternative feed wires; the source stays on driven Wire {wire.tag} unless the radial group is exploded.</p>}
    {polyline.legs.length > 1 && !drivenRadialSystem && <div className="space-y-2 border-t border-border/70 pt-2" data-testid="polyline-feedpoint-controls">
      <div className="flex items-center justify-between gap-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">Connected polyline</p><span className="text-[10px] text-text-secondary">{polyline.legs.length} legs · {polylineLengthInUnit.toFixed(editorUnitDecimals(unit))} {unit}</span></div>
      <label className="block text-[10px] text-text-secondary">Feedpoint leg
        <select value={wire.tag} onChange={(event) => moveToLeg(Number(event.currentTarget.value))} className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-text-primary">
          {polyline.legs.map((leg, index) => <option key={leg.wireTag} value={leg.wireTag}>Leg {index + 1} — Wire {leg.wireTag} ({metresToEditorUnit(leg.lengthM, unit).toFixed(editorUnitDecimals(unit))} {unit})</option>)}
        </select>
      </label>
      {polyline.branched ? <p className="rounded border border-swr-warning/30 bg-swr-warning/10 p-1.5 text-[10px] leading-4 text-swr-warning">This connected group branches. Choose a leg explicitly; a single whole-path distance would be ambiguous.</p> : <>
        <label className="block text-[10px] font-semibold text-text-secondary" htmlFor={`polyline-feed-position-${wire.tag}`}>Along complete {polyline.closed ? "closed " : ""}path: {polylineDistanceInUnit?.toFixed(editorUnitDecimals(unit))} {unit}</label>
        <input id={`polyline-feed-position-${wire.tag}`} data-testid="polyline-feed-position-slider" type="range" min={0} max={polylineLengthInUnit} step={Math.max(polylineLengthInUnit / 1000, 0.0001)} value={polylineDistanceInUnit ?? 0} onPointerDown={beginGeometryTransaction} onPointerUp={commitGeometryTransaction} onChange={(event) => moveAlongPolyline(Number(event.currentTarget.value))} className="w-full accent-swr-warning" />
        <NumberInput label="Distance along complete path" value={polylineDistanceInUnit ?? 0} onChange={moveAlongPolyline} min={0} max={polylineLengthInUnit} decimals={editorUnitDecimals(unit)} unit={unit} />
        {polyline.closed && <p className="text-[10px] leading-4 text-text-secondary">Closed-loop distance uses the start of the lowest-numbered wire as its documented datum.</p>}
      </>}
    </div>}
    <button type="button" onClick={() => setPickingExcitationForTag(isPicking ? null : wire.tag)} className={`w-full rounded px-2 py-1 text-[11px] font-semibold ${isPicking ? "bg-swr-warning/25 text-swr-warning" : "bg-accent/15 text-accent"}`}>{isPicking ? "Cancel feedpoint placement" : "Place or drag feedpoint on wire"}</button>
  </div>;
}
