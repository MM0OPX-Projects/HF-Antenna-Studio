import { useRef, useState, type ChangeEvent } from "react";
import { Navbar } from "../components/layout/Navbar";
import { useProjectSession, type PendingProjectImport } from "../features/project-management/ProjectSessionProvider";
import type { LocalProjectRecord } from "../features/project-management/local-project-library";

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

function modeLabel(record: LocalProjectRecord): string {
  const labels: Record<LocalProjectRecord["project"]["mode"], string> = {
    simulator: "Template Simulator",
    editor: "Wire Editor",
    "model-comparison": "Model Comparison",
    "parameter-sweep": "Parameter Sweep",
    "antenna-optimiser": "Antenna Optimiser",
  };
  return labels[record.project.mode];
}

export function ProjectManagementPage() {
  const session = useProjectSession();
  const [name, setName] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pendingImport, setPendingImport] = useState<PendingProjectImport | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function run(action: () => void, success?: string): void {
    try {
      action();
      setLocalError(null);
      if (success) setMessage(success);
    } catch (reason) {
      setMessage(null);
      setLocalError(reason instanceof Error ? reason.message : "Project operation failed.");
    }
  }

  async function inspectFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const candidate = session.inspectImport(await file.text(), file.name);
      setPendingImport(candidate);
      setName(candidate.suggestedName);
      setLocalError(null);
      setMessage(null);
    } catch (reason) {
      setPendingImport(null);
      setLocalError(reason instanceof Error ? reason.message : "Could not inspect the project file.");
    }
  }

  return (
    <div className="min-h-dvh bg-background text-text-primary">
      <Navbar />
      <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Local workspace</p>
          <h1 className="text-2xl font-semibold sm:text-3xl">Project management</h1>
          <p className="max-w-3xl text-sm leading-6 text-text-secondary">
            Projects stay in this browser profile. No account or cloud connection is used. Export a <code>.hfas</code> file for backup or transfer to another computer.
          </p>
        </header>

        {(localError || session.error) && <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{localError ?? session.error}</div>}
        {message && <div role="status" className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 p-3 text-sm text-emerald-300">{message}</div>}

        {session.recovery && (
          <section className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4" aria-labelledby="recovery-title">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 id="recovery-title" className="font-semibold text-amber-200">Recovery copy available</h2>
                <p className="mt-1 text-sm text-text-secondary">{session.recovery.projectName} · {formatDate(session.recovery.savedAt)} · {session.recovery.project.mode}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded-md bg-amber-300 px-3 py-2 text-sm font-semibold text-slate-950" onClick={() => run(session.recover)}>Recover</button>
                <button type="button" className="rounded-md border border-border px-3 py-2 text-sm" onClick={() => run(session.discardRecovery, "Recovery copy discarded.")}>Discard</button>
              </div>
            </div>
          </section>
        )}

        <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
            <h2 className="text-lg font-semibold">Current workspace</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-background/70 p-3">
                <div className="text-xs uppercase tracking-wide text-text-secondary">Project</div>
                <div className="mt-1 font-medium">{session.current?.name ?? "Untitled project"}</div>
              </div>
              <div className="rounded-lg bg-background/70 p-3">
                <div className="text-xs uppercase tracking-wide text-text-secondary">Autosave</div>
                <div className="mt-1 font-medium capitalize" data-testid="project-save-status">{session.status}</div>
                <div className="text-xs text-text-secondary">{session.lastSavedAt ? `Last saved ${formatDate(session.lastSavedAt)}` : "Recovery journal is active"}</div>
              </div>
            </div>
            <label className="mt-4 block text-sm font-medium" htmlFor="project-name">Project name</label>
            <input id="project-name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder={session.current?.name ?? "My antenna project"} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => run(() => {
                const record = session.save(session.current ? undefined : name);
                setName(record.name);
              }, "Project saved locally.")} className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-slate-950">Save</button>
              <button type="button" onClick={() => run(() => {
                const record = session.saveAs(name);
                setName(record.name);
              }, "A new local project copy was saved.")} className="rounded-md border border-border px-3 py-2 text-sm hover:border-accent">Save As</button>
              <button type="button" onClick={() => run(() => session.newProject("simulator"))} className="rounded-md border border-border px-3 py-2 text-sm hover:border-accent">New template project</button>
              <button type="button" onClick={() => run(() => session.newProject("editor"))} className="rounded-md border border-border px-3 py-2 text-sm hover:border-accent">New wire project</button>
              <button type="button" onClick={() => run(() => session.newProject("model-comparison"))} className="rounded-md border border-border px-3 py-2 text-sm hover:border-accent">New comparison</button>
              <button type="button" onClick={() => run(() => session.newProject("parameter-sweep"))} className="rounded-md border border-border px-3 py-2 text-sm hover:border-accent">New parameter sweep</button>
              <button type="button" onClick={() => run(() => session.newProject("antenna-optimiser"))} className="rounded-md border border-border px-3 py-2 text-sm hover:border-accent">New optimiser</button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
            <h2 className="text-lg font-semibold">Portable project file</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">Import is reviewed before anything is added. Older schemas migrate on a copy; the source file is never rewritten.</p>
            <button type="button" onClick={() => fileRef.current?.click()} className="mt-4 rounded-md border border-border px-3 py-2 text-sm hover:border-accent">Choose .hfas file</button>
            <input ref={fileRef} data-testid="project-file-input" className="hidden" type="file" accept=".hfas,.antennasim,.json" onChange={(event) => void inspectFile(event)} />
            {pendingImport && (
              <div className="mt-4 rounded-lg border border-accent/30 bg-accent/5 p-3 text-sm">
                <div className="font-medium">Ready to import: {pendingImport.suggestedName}</div>
                <div className="mt-1 text-text-secondary">Source schema {pendingImport.sourceVersion}; current schema {pendingImport.project.version}.</div>
                {pendingImport.migrations.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-text-secondary">{pendingImport.migrations.map((item) => <li key={item}>{item}</li>)}</ul>}
                <div className="mt-3 flex gap-2">
                  <button type="button" className="rounded-md bg-accent px-3 py-2 font-semibold text-slate-950" onClick={() => run(() => {
                    const imported = session.importProject(pendingImport, name || pendingImport.suggestedName);
                    setPendingImport(null);
                    session.open(imported.id);
                  })}>Import and open</button>
                  <button type="button" className="rounded-md border border-border px-3 py-2" onClick={() => setPendingImport(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5" aria-labelledby="recent-projects-title">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="recent-projects-title" className="text-lg font-semibold">Recent projects</h2>
              <p className="mt-1 text-sm text-text-secondary">Most recently opened first · {session.projects.length} stored locally</p>
            </div>
            <button type="button" onClick={session.refresh} className="rounded-md border border-border px-3 py-2 text-sm">Refresh</button>
          </div>
          {session.projects.length === 0 ? <div className="mt-5 rounded-lg border border-dashed border-border p-8 text-center text-sm text-text-secondary">No saved projects yet. Name the current workspace and choose Save.</div> : (
            <div className="mt-4 space-y-3">
              {session.projects.map((record) => (
                <article key={record.id} className="rounded-lg border border-border bg-background/60 p-3 sm:p-4">
                  <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                    <div className="min-w-0">
                      {renameId === record.id ? <div className="flex max-w-md gap-2">
                        <input aria-label={`Rename ${record.name}`} value={renameValue} maxLength={80} onChange={(event) => setRenameValue(event.target.value)} className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
                        <button type="button" className="rounded-md bg-accent px-2 py-1.5 text-sm font-semibold text-slate-950" onClick={() => run(() => { session.rename(record.id, renameValue); setRenameId(null); }, "Project renamed.")}>Apply</button>
                        <button type="button" className="rounded-md border border-border px-2 py-1.5 text-sm" onClick={() => setRenameId(null)}>Cancel</button>
                      </div> : <h3 className="truncate font-semibold">{record.name}</h3>}
                      <p className="mt-1 text-xs text-text-secondary">{modeLabel(record)} · updated {formatDate(record.updatedAt)} · revision {record.revision}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-slate-950" onClick={() => run(() => session.open(record.id))}>Open</button>
                      <button type="button" className="rounded-md border border-border px-3 py-1.5 text-sm" onClick={() => { setRenameId(record.id); setRenameValue(record.name); }}>Rename</button>
                      <button type="button" className="rounded-md border border-border px-3 py-1.5 text-sm" onClick={() => run(() => session.duplicate(record.id), "Project duplicated.")}>Duplicate</button>
                      <button type="button" className="rounded-md border border-border px-3 py-1.5 text-sm" onClick={() => run(() => session.exportProject(record.id))}>Export</button>
                      <button type="button" className="rounded-md border border-red-500/40 px-3 py-1.5 text-sm text-red-300" onClick={() => {
                        if (window.confirm(`Delete "${record.name}" from this browser? Export it first if you may need it later.`)) run(() => session.deleteProject(record.id), "Project deleted from local storage.");
                      }}>Delete</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <p className="text-xs leading-5 text-text-secondary">Local browser storage is private to this Windows user and browser profile, but it is not a backup. Clearing site data removes the library. Export important projects regularly.</p>
      </main>
    </div>
  );
}
