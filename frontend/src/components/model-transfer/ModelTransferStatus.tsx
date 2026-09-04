import { Link } from "react-router-dom";
import { useEditorStore } from "../../stores/editorStore";
import { editorModelFingerprint } from "../../features/wire-editor/model-fingerprint";

export function ModelTransferStatus() {
  const provenance = useEditorStore((state) => state.modelTransfer);
  const wires = useEditorStore((state) => state.wires);
  const excitations = useEditorStore((state) => state.excitations);
  const loads = useEditorStore((state) => state.loads);
  const transmissionLines = useEditorStore((state) => state.transmissionLines);
  const ground = useEditorStore((state) => state.ground);
  const geometryGroundFlag = useEditorStore((state) => state.geometryGroundFlag);
  const frequencyRange = useEditorStore((state) => state.frequencyRange);
  const frequencySegments = useEditorStore((state) => state.frequencySegments);
  if (!provenance) return null;
  const currentFingerprint = editorModelFingerprint({ wires, excitations, loads, transmissionLines, ground, geometryGroundFlag, frequencyRange, frequencySegments });
  const exact = currentFingerprint === provenance.editorModelFingerprint;
  return <section data-testid="model-transfer-status" className={`border-b px-2 py-2 text-[10px] leading-relaxed ${exact ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"}`}>
    <div className="flex items-start justify-between gap-2">
      <div><b className={exact ? "text-emerald-400" : "text-amber-300"}>{exact ? "Exact transferred model" : "Transferred model modified"}</b><p className="text-text-secondary">From {provenance.sourceModuleName} · {provenance.referenceImpedanceOhm} Ω reference</p></div>
      <Link to={`/${provenance.sourceModuleId}`} className="shrink-0 text-accent underline underline-offset-2">Source module</Link>
    </div>
    <p className="mt-1 text-text-secondary">{exact ? "Represented NEC inputs still match the reviewed transfer fingerprint." : "The free-form editor model no longer matches its original transfer. Recalculate and validate it as a new design."}</p>
  </section>;
}
