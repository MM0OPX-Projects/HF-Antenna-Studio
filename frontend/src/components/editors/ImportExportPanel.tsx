/**
 * ImportExportPanel — handles import/export of .maa, .nec, .json, .csv files.
 *
 * Placed in the editor page's right panel or as a modal.
 * Supports:
 * - Import: .maa, .nec, .json (native)
 * - Export: .maa, .nec, .json, .csv (results)
 *
 * Uses the SimulationEngine abstraction for .nec/.maa conversion.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { getEngine } from "../../engine";
import { parseNecFile } from "../../engine/parsers/nec-file";
import { useEditorStore } from "../../stores/editorStore";
import { useSimulationStore } from "../../stores/simulationStore";
import { downloadTextFile } from "../../utils/csv-export";
import { downloadResultsCSV } from "../../utils/csv-export";
import { downloadViewportScreenshot } from "../../utils/screenshot";
import type { GroundConfig } from "../../templates/types";
import { editorModelFingerprint } from "../../features/wire-editor/model-fingerprint";
import { resolveGeometryGroundFlag } from "../../engine/geometry-ground";

interface ImportExportPanelProps {
  className?: string;
}

/** Map ground type string from backend to our GroundConfig */
function mapGroundType(type: string): GroundConfig {
  const validTypes = [
    "free_space",
    "perfect",
    "salt_water",
    "fresh_water",
    "pastoral",
    "average",
    "rocky",
    "city",
    "dry_sandy",
  ];
  if (validTypes.includes(type)) {
    return { type: type as GroundConfig["type"] };
  }
  return { type: "average" };
}

export function ImportExportPanel({ className = "" }: ImportExportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editor store actions
  const clearAll = useEditorStore((s) => s.clearAll);
  const setWires = useEditorStore((s) => s.setWires);
  const addLoad = useEditorStore((s) => s.addLoad);
  const addTransmissionLine = useEditorStore((s) => s.addTransmissionLine);
  const setGround = useEditorStore((s) => s.setGround);
  const wires = useEditorStore((s) => s.wires);
  const excitations = useEditorStore((s) => s.excitations);
  const loads = useEditorStore((s) => s.loads);
  const transmissionLines = useEditorStore((s) => s.transmissionLines);
  const ground = useEditorStore((s) => s.ground);
  const geometryGroundFlag = useEditorStore((s) => s.geometryGroundFlag);
  const setGeometryGroundFlag = useEditorStore((s) => s.setGeometryGroundFlag);
  const frequencyRange = useEditorStore((s) => s.frequencyRange);
  const frequencySegments = useEditorStore((s) => s.frequencySegments);
  const setFrequencyRange = useEditorStore((s) => s.setFrequencyRange);
  const setFrequencySegments = useEditorStore((s) => s.setFrequencySegments);
  const loadImportedModel = useEditorStore((s) => s.loadImportedModel);
  const necImport = useEditorStore((s) => s.necImport);
  const blockedNecImport = useEditorStore((s) => s.blockedNecImport);
  const setNecImport = useEditorStore((s) => s.setNecImport);
  const setBlockedNecImport = useEditorStore((s) => s.setBlockedNecImport);

  const [message, setMessage] = useState<{ kind: "success" | "warning" | "error"; text: string } | null>(null);

  // Simulation store
  const result = useSimulationStore((s) => s.result);

  const currentFingerprint = useMemo(
    () => editorModelFingerprint({
      wires,
      excitations,
      loads,
      transmissionLines,
      ground,
      geometryGroundFlag,
      frequencyRange,
      frequencySegments,
    }),
    [wires, excitations, loads, transmissionLines, ground, geometryGroundFlag, frequencyRange, frequencySegments],
  );
  const effectiveGeometryGroundFlag = useMemo(
    () => resolveGeometryGroundFlag(wires, ground, geometryGroundFlag),
    [wires, ground, geometryGroundFlag],
  );
  const displayedNecImport = blockedNecImport ?? necImport;
  const importedModelIsCurrent = blockedNecImport === null && necImport?.imported_model_fingerprint === currentFingerprint;

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setMessage(null);
      try {
        const content = await file.text();
        const ext = file.name.split(".").pop()?.toLowerCase();

        if (ext === "json") {
          const data = JSON.parse(content);
          if (!Array.isArray(data.wires) || data.wires.length === 0) {
            throw new Error("JSON model does not contain a non-empty wires array.");
          }
          clearAll();
          setWires(data.wires, Array.isArray(data.excitations) ? data.excitations : []);
          for (const load of data.loads ?? []) addLoad(load);
          for (const line of data.transmission_lines ?? []) addTransmissionLine(line);
          if (data.ground) setGround(data.ground);
          if (data.geometry_ground_flag === -1 || data.geometry_ground_flag === 0 || data.geometry_ground_flag === 1) {
            setGeometryGroundFlag(data.geometry_ground_flag);
          }
          if (data.frequency) setFrequencyRange(data.frequency);
          setNecImport(null);
          setMessage({ kind: "success", text: `Imported ${data.wires.length} wires from JSON.` });
        } else if (ext === "nec") {
          const response = parseNecFile(content);
          const document = response.nec_document!;
          if (!document.structured_editable) {
            setBlockedNecImport({
              source_name: file.name,
              document,
              imported_model_fingerprint: "blocked:not-converted",
            });
            const blockers = document.diagnostics.filter((item) => item.severity === "error").length;
            setMessage({
              kind: "error",
              text: `Structured editing blocked: ${blockers} unsupported or malformed card${blockers === 1 ? "" : "s"}. The current model was not replaced; the original NEC text is retained for download.`,
            });
          } else {
            const importedSegments = response.frequency_segments ?? [];
            const primaryRange = importedSegments[0] ?? {
              start_mhz: response.frequency_start_mhz,
              stop_mhz: response.frequency_stop_mhz,
              steps: response.frequency_steps,
            };
            const editorSegments = importedSegments.length > 1 ? importedSegments : [];
            const model = {
              wires: response.wires,
              excitations: response.excitations,
              loads: response.loads ?? [],
              transmissionLines: response.transmission_lines ?? [],
              ground: response.ground ?? mapGroundType(response.ground_type),
              geometryGroundFlag: response.geometry_ground_flag!,
              frequencyRange: primaryRange,
              frequencySegments: editorSegments,
            };
            const importedModelFingerprint = editorModelFingerprint(model);
            loadImportedModel({
              ...model,
              necImport: {
                source_name: file.name,
                document,
                imported_model_fingerprint: importedModelFingerprint,
              },
            });
            const warnings = document.diagnostics.filter((item) => item.severity === "warning").length;
            setMessage({
              kind: warnings > 0 ? "warning" : "success",
              text: `Imported ${response.wires.length} wires, ${response.excitations.length} sources, ${response.loads?.length ?? 0} loads, and ${response.transmission_lines?.length ?? 0} transmission lines without clamping${warnings ? `; review ${warnings} conversion warning${warnings === 1 ? "" : "s"}` : ""}.`,
            });
          }
        } else if (ext === "maa") {
          const engine = getEngine();
          const resp = await engine.importFile(content, "maa");
          clearAll();
          setWires(resp.wires, resp.excitations);
          for (const load of resp.loads ?? []) addLoad(load);
          for (const line of resp.transmission_lines ?? []) addTransmissionLine(line);
          setGround(resp.ground ?? mapGroundType(resp.ground_type));
          setFrequencyRange({
            start_mhz: resp.frequency_start_mhz,
            stop_mhz: resp.frequency_stop_mhz,
            steps: resp.frequency_steps,
          });
          setFrequencySegments([]);
          setNecImport(null);
          setMessage({ kind: "success", text: `Imported ${resp.wires.length} wires from MMANA format.` });
        } else {
          throw new Error("Choose a .nec, .maa, or .json file.");
        }
      } catch (error) {
        setMessage({ kind: "error", text: error instanceof Error ? error.message : "Import failed." });
      } finally {
        e.target.value = "";
      }
    },
    [clearAll, setWires, addLoad, addTransmissionLine, setGround, setGeometryGroundFlag, setFrequencyRange, setFrequencySegments, setNecImport, setBlockedNecImport, loadImportedModel]
  );

  const handleExportJSON = useCallback(() => {
    const data = {
      version: 1,
      title: "AntennaSim Project",
      wires: wires.map((w) => ({
        tag: w.tag,
        segments: w.segments,
        x1: w.x1, y1: w.y1, z1: w.z1,
        x2: w.x2, y2: w.y2, z2: w.z2,
        radius: w.radius,
      })),
      excitations,
      loads,
      transmission_lines: transmissionLines,
      ground,
      geometry_ground_flag: effectiveGeometryGroundFlag,
      frequency: frequencyRange,
      frequency_segments: frequencySegments,
      nec_import: necImport,
    };
    const json = JSON.stringify(data, null, 2);
    downloadTextFile(json, "antenna.json", "application/json");
  }, [wires, excitations, loads, transmissionLines, ground, effectiveGeometryGroundFlag, frequencyRange, frequencySegments, necImport]);

  const handleExportOriginalNEC = useCallback(() => {
    if (!displayedNecImport) return;
    const filename = displayedNecImport.source_name.toLowerCase().endsWith(".nec")
      ? displayedNecImport.source_name
      : `${displayedNecImport.source_name}.nec`;
    downloadTextFile(displayedNecImport.document.original_text, filename, "text/plain");
  }, [displayedNecImport]);

  const handleExportNEC = useCallback(async () => {
    try {
      const engine = getEngine();
      const content = await engine.exportFile(
        {
          title: "AntennaSim export",
          wires: wires.map((w) => ({
            tag: w.tag,
            segments: w.segments,
            x1: w.x1, y1: w.y1, z1: w.z1,
            x2: w.x2, y2: w.y2, z2: w.z2,
            radius: w.radius,
          })),
          excitations,
          loads,
          transmission_lines: transmissionLines,
          ground,
          geometry_ground_flag: effectiveGeometryGroundFlag,
          frequency_start_mhz: frequencyRange.start_mhz,
          frequency_stop_mhz: frequencyRange.stop_mhz,
          frequency_steps: frequencyRange.steps,
          frequencySegments: frequencySegments.length > 0 ? frequencySegments : undefined,
        },
        "nec",
      );
      downloadTextFile(content, "antenna-generated.nec", "text/plain");
      setMessage({
        kind: displayedNecImport ? "warning" : "success",
        text: displayedNecImport
          ? "Generated NEC exported from supported editor state. Use Original NEC to retain source text, ordering, symbols, and output-control cards exactly."
          : "Generated NEC exported.",
      });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "NEC export failed." });
    }
  }, [wires, excitations, loads, transmissionLines, ground, effectiveGeometryGroundFlag, frequencyRange, frequencySegments, displayedNecImport]);

  const handleExportMAA = useCallback(async () => {
    try {
      const engine = getEngine();
      const content = await engine.exportFile(
        {
          title: "AntennaSim export",
          wires: wires.map((w) => ({
            tag: w.tag,
            segments: w.segments,
            x1: w.x1, y1: w.y1, z1: w.z1,
            x2: w.x2, y2: w.y2, z2: w.z2,
            radius: w.radius,
          })),
          excitations,
          loads,
          ground,
          frequency_start_mhz: frequencyRange.start_mhz,
          frequency_stop_mhz: frequencyRange.stop_mhz,
          frequency_steps: frequencyRange.steps,
        },
        "maa",
      );
      downloadTextFile(content, "antenna.maa", "text/plain");
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "MMANA export failed." });
    }
  }, [wires, excitations, loads, ground, frequencyRange]);

  const handleExportCSV = useCallback(() => {
    if (result) {
      downloadResultsCSV(result.frequency_data);
    }
  }, [result]);

  const handleScreenshot = useCallback(() => {
    downloadViewportScreenshot();
  }, []);

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".maa,.nec,.json,.MAA,.NEC,.JSON"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Import */}
      <button
        onClick={handleImport}
        className="w-full px-2 py-1.5 text-[11px] rounded border border-border text-text-secondary hover:text-text-primary hover:border-accent/50 transition-colors text-left"
      >
        Import .maa / .nec / .json
      </button>

      {message && (
        <p
          role="status"
          className={`rounded border px-2 py-1.5 text-[10px] leading-relaxed ${
            message.kind === "error"
              ? "border-swr-bad/40 bg-swr-bad/10 text-swr-bad"
              : message.kind === "warning"
                ? "border-swr-warning/40 bg-swr-warning/10 text-swr-warning"
                : "border-accent/30 bg-accent/10 text-text-secondary"
          }`}
        >
          {message.text}
        </p>
      )}

      {displayedNecImport && (
        <div data-testid="nec-import-report" className="rounded border border-border bg-background/60 p-2 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[10px] font-semibold text-text-primary" title={displayedNecImport.source_name}>
              {displayedNecImport.source_name}
            </span>
            <span className={`shrink-0 text-[9px] font-semibold uppercase ${
              displayedNecImport.document.structured_editable ? "text-accent" : "text-swr-bad"
            }`}>
              {displayedNecImport.document.structured_editable ? "structured" : "raw only"}
            </span>
          </div>
          <p className="text-[10px] leading-relaxed text-text-secondary">
            {importedModelIsCurrent
              ? "The visible model still matches the imported structured data. The original decoded source text remains available with its line endings."
              : displayedNecImport.document.structured_editable
                ? "The visible model has changed. Generated NEC reflects the edited model; Original NEC remains the unmodified import."
                : "Unsupported cards blocked structured conversion. The previous editor model was left untouched."}
          </p>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] font-mono text-text-secondary">
            {(["represented", "regenerated", "preserved_only", "blocking"] as const).map((disposition) => (
              <span key={disposition}>
                {disposition.replace("_", " ")}: {displayedNecImport.document.cards.filter((card) => card.disposition === disposition).length}
              </span>
            ))}
          </div>
          {displayedNecImport.document.diagnostics.length > 0 && (
            <details>
              <summary className="cursor-pointer text-[10px] text-text-secondary">
                Conversion report ({displayedNecImport.document.diagnostics.length})
              </summary>
              <ul className="mt-1 max-h-28 space-y-1 overflow-auto text-[9px] leading-relaxed text-text-secondary">
                {displayedNecImport.document.diagnostics.map((item, index) => (
                  <li key={`${item.code}-${item.line_number ?? index}`} className={item.severity === "error" ? "text-swr-bad" : ""}>
                    {item.line_number ? `Line ${item.line_number}: ` : ""}{item.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <button
            onClick={handleExportOriginalNEC}
            className="w-full rounded border border-border px-2 py-1 text-[10px] text-text-secondary hover:border-accent/50 hover:text-text-primary"
          >
            Original NEC (source text)
          </button>
        </div>
      )}

      {/* Export buttons */}
      <div className="grid grid-cols-2 gap-1">
        <button
          onClick={handleExportJSON}
          disabled={wires.length === 0}
          className="px-2 py-1 text-[11px] rounded border border-border text-text-secondary hover:text-text-primary hover:border-accent/50 transition-colors disabled:opacity-40"
        >
          .json
        </button>
        <button
          onClick={handleExportNEC}
          disabled={wires.length === 0}
          className="px-2 py-1 text-[11px] rounded border border-border text-text-secondary hover:text-text-primary hover:border-accent/50 transition-colors disabled:opacity-40"
        >
          Generated NEC
        </button>
        <button
          onClick={handleExportMAA}
          disabled={wires.length === 0}
          className="px-2 py-1 text-[11px] rounded border border-border text-text-secondary hover:text-text-primary hover:border-accent/50 transition-colors disabled:opacity-40"
        >
          .maa
        </button>
        <button
          onClick={handleExportCSV}
          disabled={!result}
          className="px-2 py-1 text-[11px] rounded border border-border text-text-secondary hover:text-text-primary hover:border-accent/50 transition-colors disabled:opacity-40"
        >
          .csv
        </button>
      </div>

      {/* Screenshot */}
      <button
        onClick={handleScreenshot}
        className="w-full px-2 py-1 text-[11px] rounded border border-border text-text-secondary hover:text-text-primary hover:border-accent/50 transition-colors"
      >
        Screenshot (.png)
      </button>
    </div>
  );
}
