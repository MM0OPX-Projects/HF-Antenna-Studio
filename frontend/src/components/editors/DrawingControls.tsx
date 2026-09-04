import { useState } from "react";
import { useEditorStore } from "../../stores/editorStore";

type CameraView = "perspective" | "top" | "front" | "side";

function requestCameraView(view: CameraView) {
  window.dispatchEvent(new CustomEvent("hf-editor-camera-view", { detail: { view } }));
}

export function DrawingControls() {
  const [open, setOpen] = useState(() => window.innerWidth >= 1024);
  const continuousDraw = useEditorStore((state) => state.continuousDraw);
  const endpointSnap = useEditorStore((state) => state.endpointSnap);
  const setContinuousDraw = useEditorStore((state) => state.setContinuousDraw);
  const setEndpointSnap = useEditorStore((state) => state.setEndpointSnap);
  return <div className="absolute right-2 top-32 z-20 space-y-1 rounded-md border border-border bg-surface/90 p-2 text-[10px] shadow-lg backdrop-blur-sm" data-testid="drawing-controls">
    <button type="button" onClick={() => setOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 font-semibold uppercase tracking-wide text-text-secondary" aria-expanded={open}><span>Drawing</span><span aria-hidden="true">{open ? "−" : "+"}</span></button>
    {open && <>
    <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={continuousDraw} onChange={(event) => setContinuousDraw(event.currentTarget.checked)} className="accent-accent" /> Continue wire chain</label>
    <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={endpointSnap} onChange={(event) => setEndpointSnap(event.currentTarget.checked)} className="accent-accent" /> Snap and join endpoints</label>
    <p className="hidden max-w-40 leading-4 text-text-secondary sm:block">Grid spacing and endpoint joining are independent. Press Esc to finish a chain.</p>
    <div className="grid grid-cols-2 gap-1 border-t border-border pt-1" aria-label="Drawing views">
      {(["perspective", "top", "front", "side"] as const).map((view) => <button key={view} type="button" onClick={() => requestCameraView(view)} className="rounded border border-border px-1.5 py-1 capitalize hover:border-accent hover:text-accent">{view}</button>)}
    </div>
    </>}
  </div>;
}
