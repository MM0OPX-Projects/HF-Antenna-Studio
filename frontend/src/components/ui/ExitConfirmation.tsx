import { useEffect, useState } from "react";
import { useProjectSession } from "../../features/project-management/ProjectSessionProvider";
import { isDesktopRuntime, listenForExitRequest, requestApplicationExit } from "../../platform/desktop-runtime";

export function ExitConfirmation() {
  const session = useProjectSession();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isDesktopRuntime()) return undefined;
    let unsubscribe: (() => void) | undefined;
    void listenForExitRequest(() => setOpen(true)).then((cleanup) => { unsubscribe = cleanup; });
    return () => unsubscribe?.();
  }, []);

  if (!open) return null;

  const exit = () => { void requestApplicationExit(); };
  const saveAndExit = () => {
    try {
      if (session.current && session.status !== "saved" && session.status !== "idle") session.save();
      exit();
    } catch {
      // Keep the confirmation open when saving fails so the user can choose
      // Exit without saving or cancel and recover the project manually.
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="exit-confirmation-title" className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-2xl">
        <h2 id="exit-confirmation-title" className="text-lg font-semibold">Are you sure you want to exit?</h2>
        <p className="mt-2 text-sm leading-6 text-text-secondary">Please save any unsaved actions before closing HF Antenna Studio.</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className="rounded-md border border-border px-3 py-2 text-sm" onClick={() => setOpen(false)}>Cancel</button>
          <button type="button" className="rounded-md border border-red-500/40 px-3 py-2 text-sm text-red-300" onClick={exit}>Exit without saving</button>
          <button type="button" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-slate-950" onClick={saveAndExit}>Save and exit</button>
        </div>
      </section>
    </div>
  );
}
