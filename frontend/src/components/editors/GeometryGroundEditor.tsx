import { useId } from "react";
import type { GeometryGroundFlag } from "../../engine/geometry-ground";

interface GeometryGroundEditorProps {
  value: GeometryGroundFlag | null;
  effectiveValue: GeometryGroundFlag;
  onChange: (value: GeometryGroundFlag | null) => void;
}

export function GeometryGroundEditor({
  value,
  effectiveValue,
  onChange,
}: GeometryGroundEditorProps) {
  const selectId = useId();
  return (
    <div className="space-y-1 px-1">
      <label htmlFor={selectId} className="block text-[11px] text-text-secondary">
        Geometry/ground connection (NEC GE)
      </label>
      <select
        id={selectId}
        value={value === null ? "auto" : String(value)}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next === "auto" ? null : Number(next) as GeometryGroundFlag);
        }}
        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
      >
        <option value="auto">Automatic (currently GE {effectiveValue})</option>
        <option value="0">GE 0 — no geometry ground plane</option>
        <option value="-1">GE -1 — ground, no contact interpolation</option>
        <option value="1">GE 1 — ground-contact interpolation</option>
      </select>
      <p className="text-[10px] leading-relaxed text-text-secondary">
        GE controls geometry/current expansion; GN above selects the electromagnetic ground model.
        Use GE 1 only for wires ending on z=0. Imported values remain explicit.
      </p>
    </div>
  );
}
