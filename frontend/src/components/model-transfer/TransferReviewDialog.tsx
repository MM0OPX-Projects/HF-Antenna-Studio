import { useEffect } from "react";
import type { EditorModelTransfer } from "../../features/model-transfer/types";
import { Button } from "../ui/Button";

export function TransferReviewDialog({ transfer, onCancel, onConfirm }: {
  transfer: EditorModelTransfer;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onCancel]);

  return <div className="fixed inset-0 z-[100] grid place-items-center bg-black/65 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="transfer-review-title" data-testid="model-transfer-review" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-surface-elevated p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400">Exact editable transfer</p>
          <h2 id="transfer-review-title" className="mt-1 text-lg font-semibold text-text-primary">Review before replacing the Wire Editor model</h2>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">The current Wire Editor workspace will be replaced only after you confirm. Save it first if it is needed.</p>
        </div>
        <button type="button" aria-label="Close transfer review" onClick={onCancel} className="rounded px-2 py-1 text-text-secondary hover:bg-surface-hover">×</button>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-border bg-background/50 p-3 text-xs sm:grid-cols-4">
        <div><dt className="text-text-secondary">Source</dt><dd className="mt-1 font-semibold text-text-primary">{transfer.provenance.sourceModuleName}</dd></div>
        <div><dt className="text-text-secondary">Wires / segments</dt><dd className="mt-1 font-mono text-text-primary">{transfer.wires.length} / {transfer.wires.reduce((sum, wire) => sum + wire.segments, 0)}</dd></div>
        <div><dt className="text-text-secondary">Sources</dt><dd className="mt-1 font-mono text-text-primary">{transfer.excitations.length}</dd></div>
        <div><dt className="text-text-secondary">Reference Z₀</dt><dd className="mt-1 font-mono text-text-primary">{transfer.referenceImpedanceOhm} Ω</dd></div>
      </dl>

      <div data-testid="transfer-parity-status" className={`mt-3 rounded-lg border p-3 text-xs ${transfer.parity.semanticMatch ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300" : "border-red-500/40 bg-red-500/10 text-red-300"}`}>
        <b>{transfer.parity.semanticMatch ? "NEC input parity passed." : "NEC input parity failed."}</b> {transfer.parity.summary}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-3">
          <h3 className="text-xs font-semibold text-text-primary">Preserved exactly</h3>
          <ul className="mt-2 space-y-1 text-[11px] text-text-secondary">
            <li>• SI wire geometry and diameter</li><li>• NEC segmentation and centre source</li><li>• Frequency and electromagnetic ground</li><li>• GE geometry/ground behaviour</li><li>• 50/75 Ω result reference</li>
          </ul>
        </div>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <h3 className="text-xs font-semibold text-amber-300">Behaviour after transfer</h3>
          <ul className="mt-2 space-y-1 text-[11px] text-text-secondary">{transfer.provenance.losses.map((loss) => <li key={loss}>• {loss}</li>)}</ul>
        </div>
      </div>

      <p className="mt-3 text-[10px] text-text-secondary">Editor output cards {transfer.parity.regeneratedCards.join(", ")} are regenerated intentionally. The represented electromagnetic inputs are fingerprinted and retained with the project.</p>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button autoFocus variant="secondary" onClick={onCancel}>Keep current editor model</Button>
        <Button data-testid="confirm-model-transfer" onClick={onConfirm} disabled={!transfer.parity.semanticMatch}>Replace and open Wire Editor</Button>
      </div>
    </section>
  </div>;
}
