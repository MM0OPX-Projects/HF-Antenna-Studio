import { useCallback } from "react";
import type { LumpedLoad } from "../../api/nec";
import type { EditorWire } from "../../stores/editorStore";
import { useEditorStore } from "../../stores/editorStore";
import { centerSegment } from "../../engine/segmentation";
import { NumberInput } from "../ui/NumberInput";

const LOAD_TYPES = [
  { value: 0, label: "Series RLC", fields: ["R (Ω)", "L (H)", "C (F)"] },
  { value: 1, label: "Parallel RLC", fields: ["R (Ω)", "L (H)", "C (F)"] },
  { value: 4, label: "Fixed impedance", fields: ["R (Ω)", "X (Ω)", "Unused"] },
  { value: 5, label: "Wire conductivity", fields: ["σ (S/m)", "Unused", "Unused"] },
] as const;

function loadType(type: number) {
  return LOAD_TYPES.find((candidate) => candidate.value === type) ?? LOAD_TYPES[0];
}

export function LoadEditor({ wire }: { wire: EditorWire }) {
  const loads = useEditorStore((state) => state.loads);
  const addLoad = useEditorStore((state) => state.addLoad);
  const updateLoad = useEditorStore((state) => state.updateLoad);
  const removeLoad = useEditorStore((state) => state.removeLoad);
  const entries = loads
    .map((load, index) => ({ load, index }))
    .filter(({ load }) => load.wire_tag === wire.tag || load.wire_tag === 0);

  const update = useCallback(
    (index: number, load: LumpedLoad, values: Partial<LumpedLoad>) => {
      updateLoad(index, { ...load, ...values });
    },
    [updateLoad],
  );

  return (
    <div className="border-t border-border pt-2 space-y-1.5" data-testid="wire-load-editor">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium text-text-secondary">Loads (NEC LD)</p>
          <p className="text-[9px] leading-tight text-text-secondary/70">Only solver-supported series/parallel RLC, fixed Z, and conductivity cards are offered.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            const segment = centerSegment(wire.segments);
            addLoad({
              load_type: 0,
              wire_tag: wire.tag,
              segment_start: segment,
              segment_end: segment,
              param1: 50,
              param2: 0,
              param3: 0,
            });
          }}
          className="shrink-0 rounded bg-accent/20 px-2 py-1 text-[10px] text-accent hover:bg-accent/30"
        >
          + Load
        </button>
      </div>

      {entries.length === 0 && (
        <p className="rounded border border-dashed border-border px-2 py-1.5 text-[10px] text-text-secondary">No load on this wire.</p>
      )}

      {entries.map(({ load, index }, localIndex) => {
        const definition = loadType(load.load_type);
        return (
          <div key={index} className="rounded border border-border bg-background/60 p-2 space-y-1.5">
            <div className="flex items-center gap-1">
              <label className="sr-only" htmlFor={`load-type-${wire.tag}-${index}`}>Load type</label>
              <select
                id={`load-type-${wire.tag}-${index}`}
                aria-label={`Load ${localIndex + 1} type`}
                value={load.load_type}
                onChange={(event) => update(index, load, { load_type: Number(event.target.value) })}
                className="min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-1 text-[10px] text-text-primary"
              >
                {LOAD_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
              <button
                type="button"
                aria-label={`Remove load ${localIndex + 1}`}
                onClick={() => removeLoad(index)}
                className="rounded px-1.5 py-1 text-[10px] text-swr-bad hover:bg-swr-bad/10"
              >
                Remove
              </button>
            </div>
            {load.wire_tag === 0 ? (
              <p className="rounded bg-accent/10 px-1.5 py-1 text-[9px] text-text-secondary">
                Imported global selection: applies to all segments on all wires.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-1">
                <NumberInput label="From" value={load.segment_start} min={1} max={wire.segments} decimals={0} onChange={(value) => update(index, load, { segment_start: Math.round(value) })} />
                <NumberInput label="To" value={load.segment_end} min={1} max={wire.segments} decimals={0} onChange={(value) => update(index, load, { segment_end: Math.round(value) })} />
              </div>
            )}
            <div className="grid grid-cols-1 gap-1">
              <NumberInput label={definition.fields[0]} value={load.param1} decimals={load.load_type === 5 ? 1 : 4} min={load.load_type === 4 ? undefined : 0} onChange={(value) => update(index, load, { param1: value })} />
              {load.load_type !== 5 && <NumberInput label={definition.fields[1]} value={load.param2} decimals={8} min={load.load_type === 4 ? undefined : 0} onChange={(value) => update(index, load, { param2: value })} />}
              {(load.load_type === 0 || load.load_type === 1) && <NumberInput label={definition.fields[2]} value={load.param3} decimals={12} min={0} onChange={(value) => update(index, load, { param3: value })} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
