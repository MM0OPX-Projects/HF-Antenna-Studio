import { useState } from "react";
import { useEditorStore } from "../../stores/editorStore";
import { NumberInput } from "../ui/NumberInput";

type Axis = "x" | "y" | "z";

export function TransformPanel() {
  const selectedCount = useEditorStore((state) => state.selectedTags.size);
  const moveSelected = useEditorStore((state) => state.moveSelected);
  const rotateSelected = useEditorStore((state) => state.rotateSelected);
  const mirrorSelected = useEditorStore((state) => state.mirrorSelected);
  const duplicateSelected = useEditorStore((state) => state.duplicateSelected);
  const [translation, setTranslation] = useState({ x: 0, y: 0, z: 0 });
  const [axis, setAxis] = useState<Axis>("z");
  const [angle, setAngle] = useState(90);

  const disabled = selectedCount === 0;
  return (
    <section aria-label="Transform selected wires" className="space-y-2" data-testid="wire-transform-panel">
      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">Transform selection</h4>
        <p className="text-[9px] leading-relaxed text-text-secondary/70">SI coordinates; rotations use the selected-wire centroid. Locked junctions remain connected.</p>
      </div>

      <div className="rounded border border-border bg-background/60 p-2 space-y-1.5">
        <p className="text-[10px] font-medium text-text-secondary">Translate</p>
        <div className="grid grid-cols-3 gap-1">
          {(["x", "y", "z"] as const).map((coordinate) => (
            <NumberInput
              key={coordinate}
              label={coordinate.toUpperCase()}
              value={translation[coordinate]}
              decimals={3}
              unit="m"
              onChange={(value) => setTranslation((current) => ({ ...current, [coordinate]: value }))}
            />
          ))}
        </div>
        <button
          type="button"
          disabled={disabled || (translation.x === 0 && translation.y === 0 && translation.z === 0)}
          onClick={() => {
            moveSelected(translation.x, translation.y, translation.z);
            setTranslation({ x: 0, y: 0, z: 0 });
          }}
          className="w-full rounded bg-accent/20 px-2 py-1 text-[10px] text-accent hover:bg-accent/30 disabled:opacity-35"
        >
          Apply translation
        </button>
      </div>

      <div className="rounded border border-border bg-background/60 p-2 space-y-1.5">
        <p className="text-[10px] font-medium text-text-secondary">Rotate</p>
        <div className="flex items-center gap-1">
          <select
            aria-label="Rotation axis"
            value={axis}
            onChange={(event) => setAxis(event.target.value as Axis)}
            className="rounded border border-border bg-background px-1.5 py-1 text-[10px] text-text-primary"
          >
            <option value="x">X axis</option>
            <option value="y">Y axis</option>
            <option value="z">Z axis</option>
          </select>
          <NumberInput label="Angle" value={angle} decimals={1} unit="°" onChange={setAngle} />
        </div>
        <button
          type="button"
          disabled={disabled || angle === 0}
          onClick={() => rotateSelected(axis, angle)}
          className="w-full rounded bg-accent/20 px-2 py-1 text-[10px] text-accent hover:bg-accent/30 disabled:opacity-35"
        >
          Rotate selection
        </button>
      </div>

      <div className="rounded border border-border bg-background/60 p-2 space-y-1.5">
        <p className="text-[10px] font-medium text-text-secondary">Copy / mirror</p>
        <button type="button" disabled={disabled} onClick={duplicateSelected} className="w-full rounded border border-border px-2 py-1 text-[10px] text-text-secondary hover:border-accent/50 disabled:opacity-35">Duplicate (+0.5 m Y)</button>
        <div className="grid grid-cols-3 gap-1">
          {(["x", "y", "z"] as const).map((mirrorAxis) => (
            <button
              key={mirrorAxis}
              type="button"
              disabled={disabled}
              onClick={() => mirrorSelected(mirrorAxis)}
              className="rounded border border-border px-1 py-1 text-[10px] text-text-secondary hover:border-accent/50 disabled:opacity-35"
            >
              Mirror {mirrorAxis.toUpperCase()}
            </button>
          ))}
        </div>
        <p className="text-[9px] text-text-secondary/70">Mirror creates a reflected copy across the selection centroid; it does not replace the original.</p>
      </div>
    </section>
  );
}
