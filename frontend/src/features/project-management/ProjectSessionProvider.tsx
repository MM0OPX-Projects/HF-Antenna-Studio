import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { downloadProject, isSupportedProjectFilename, parseProjectText, type ProjectFile, type ProjectMigrationResult } from "../../utils/project-file";
import {
  LocalProjectLibrary,
  clearRecovery,
  readRecovery,
  writeRecovery,
  type LocalProjectRecord,
  type RecoveryRecord,
} from "./local-project-library";
import {
  captureProject,
  createNewProject,
  projectModeForRoute,
  restoreProject,
  type ManagedProjectMode,
} from "./project-state";

const AUTOSAVE_INTERVAL_MS = 800;

export type ProjectSaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export interface PendingProjectImport extends ProjectMigrationResult {
  originalText: string;
  suggestedName: string;
}

interface ProjectSessionValue {
  projects: LocalProjectRecord[];
  current: LocalProjectRecord | null;
  recovery: RecoveryRecord | null;
  status: ProjectSaveStatus;
  error: string | null;
  lastSavedAt: string | null;
  refresh: () => void;
  newProject: (mode: ManagedProjectMode) => void;
  save: (nameIfNew?: string) => LocalProjectRecord;
  saveAs: (name: string) => LocalProjectRecord;
  open: (id: string) => void;
  rename: (id: string, name: string) => void;
  duplicate: (id: string, name?: string) => void;
  deleteProject: (id: string) => void;
  exportProject: (id: string) => void;
  inspectImport: (text: string, filename: string) => PendingProjectImport;
  importProject: (candidate: PendingProjectImport, name?: string) => LocalProjectRecord;
  recover: () => void;
  discardRecovery: () => void;
}

const ProjectSessionContext = createContext<ProjectSessionValue | null>(null);

function projectFingerprint(project: ProjectFile): string {
  return JSON.stringify({ mode: project.mode, simulator: project.simulator, editor: project.editor });
}

function filenameStem(filename: string): string {
  return filename.replace(/\.(hfas|antennasim|json)$/i, "").trim() || "Imported project";
}

export function ProjectSessionProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const library = useMemo(() => new LocalProjectLibrary(window.localStorage), []);
  const [projects, setProjects] = useState<LocalProjectRecord[]>([]);
  const [current, setCurrent] = useState<LocalProjectRecord | null>(null);
  const [recovery, setRecovery] = useState<RecoveryRecord | null>(null);
  const [status, setStatus] = useState<ProjectSaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const currentRef = useRef<LocalProjectRecord | null>(null);
  const modeRef = useRef<ManagedProjectMode>(projectModeForRoute(location.pathname));
  const routeRef = useRef(location.pathname);
  const fingerprintRef = useRef("");
  const restoringRef = useRef(false);

  const refresh = useCallback(() => {
    try {
      setProjects(library.list());
      const recovered = readRecovery(window.localStorage);
      setRecovery(recovered ? {
        schemaVersion: recovered.schemaVersion,
        savedAt: recovered.savedAt,
        route: recovered.route,
        projectId: recovered.projectId,
        projectRevision: recovered.projectRevision,
        projectName: recovered.projectName,
        project: recovered.project,
      } : null);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not read local projects.");
    }
  }, [library]);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  useEffect(() => {
    routeRef.current = location.pathname;
    if (location.pathname === "/editor" || location.pathname === "/") {
      const nextMode = projectModeForRoute(location.pathname);
      modeRef.current = nextMode;
      fingerprintRef.current = projectFingerprint(captureProject(nextMode));
      if (currentRef.current && currentRef.current.project.mode !== nextMode) {
        currentRef.current = null;
        queueMicrotask(() => {
          setCurrent(null);
          setStatus("dirty");
        });
      }
    }
  }, [location.pathname]);

  useEffect(() => {
    fingerprintRef.current = projectFingerprint(captureProject(modeRef.current));
    queueMicrotask(refresh);
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (restoringRef.current) return;
      try {
        const mode = currentRef.current?.project.mode ?? modeRef.current;
        const snapshot = captureProject(mode);
        const fingerprint = projectFingerprint(snapshot);
        if (fingerprint === fingerprintRef.current) return;
        fingerprintRef.current = fingerprint;
        setStatus("dirty");
        const active = currentRef.current;
        writeRecovery(window.localStorage, {
          schemaVersion: 1,
          savedAt: new Date().toISOString(),
          route: routeRef.current,
          projectId: active?.id ?? null,
          projectRevision: active?.revision ?? null,
          projectName: active?.name ?? "Untitled project",
          project: snapshot,
        });
        setRecovery(readRecovery(window.localStorage));

        if (active) {
          setStatus("saving");
          const saved = library.save(active.id, snapshot, active.revision);
          currentRef.current = saved;
          setCurrent(saved);
          clearRecovery(window.localStorage);
          setRecovery(null);
          setLastSavedAt(saved.updatedAt);
          setProjects(library.list());
          setStatus("saved");
        }
        setError(null);
      } catch (reason) {
        setStatus("error");
        setError(reason instanceof Error ? reason.message : "Autosave failed.");
      }
    }, AUTOSAVE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [library]);

  useEffect(() => {
    const preserveLatestChange = () => {
      try {
        const mode = currentRef.current?.project.mode ?? modeRef.current;
        const snapshot = captureProject(mode);
        if (projectFingerprint(snapshot) === fingerprintRef.current) return;
        writeRecovery(window.localStorage, {
          schemaVersion: 1,
          savedAt: new Date().toISOString(),
          route: routeRef.current,
          projectId: currentRef.current?.id ?? null,
          projectRevision: currentRef.current?.revision ?? null,
          projectName: currentRef.current?.name ?? "Untitled project",
          project: snapshot,
        });
      } catch {
        // The regular autosave loop surfaces storage failures. Unload handlers
        // cannot reliably render new UI and must not block browser shutdown.
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") preserveLatestChange();
    };
    window.addEventListener("pagehide", preserveLatestChange);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("pagehide", preserveLatestChange);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const beginRestore = useCallback((project: ProjectFile) => {
    restoringRef.current = true;
    try {
      restoreProject(project);
      modeRef.current = project.mode;
      fingerprintRef.current = projectFingerprint(captureProject(project.mode));
    } finally {
      restoringRef.current = false;
    }
  }, []);

  const newProject = useCallback((mode: ManagedProjectMode) => {
    restoringRef.current = true;
    try {
      const project = createNewProject(mode);
      modeRef.current = mode;
      currentRef.current = null;
      setCurrent(null);
      fingerprintRef.current = projectFingerprint(project);
      const recovered: RecoveryRecord = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        route: mode === "editor" ? "/editor" : "/",
        projectId: null,
        projectRevision: null,
        projectName: "Untitled project",
        project,
      };
      writeRecovery(window.localStorage, recovered);
      setRecovery(recovered);
      setStatus("dirty");
      setError(null);
      navigate(mode === "editor" ? "/editor" : "/");
    } finally {
      restoringRef.current = false;
    }
  }, [navigate]);

  const saveAs = useCallback((name: string): LocalProjectRecord => {
    const snapshot = captureProject(modeRef.current);
    const record = library.create(name, snapshot);
    currentRef.current = record;
    setCurrent(record);
    setProjects(library.list());
    clearRecovery(window.localStorage);
    setRecovery(null);
    setLastSavedAt(record.updatedAt);
    setStatus("saved");
    setError(null);
    fingerprintRef.current = projectFingerprint(snapshot);
    return record;
  }, [library]);

  const save = useCallback((nameIfNew?: string): LocalProjectRecord => {
    const active = currentRef.current;
    if (!active) {
      if (!nameIfNew) throw new Error("Choose a project name before the first save.");
      return saveAs(nameIfNew);
    }
    const snapshot = captureProject(active.project.mode);
    const saved = library.save(active.id, snapshot, active.revision);
    currentRef.current = saved;
    setCurrent(saved);
    setProjects(library.list());
    clearRecovery(window.localStorage);
    setRecovery(null);
    setLastSavedAt(saved.updatedAt);
    setStatus("saved");
    setError(null);
    fingerprintRef.current = projectFingerprint(snapshot);
    return saved;
  }, [library, saveAs]);

  const open = useCallback((id: string) => {
    const record = library.markOpened(id);
    beginRestore(record.project);
    currentRef.current = record;
    setCurrent(record);
    setProjects(library.list());
    clearRecovery(window.localStorage);
    setRecovery(null);
    setLastSavedAt(record.updatedAt);
    setStatus("saved");
    setError(null);
    navigate(record.project.mode === "editor" ? "/editor" : "/");
  }, [beginRestore, library, navigate]);

  const rename = useCallback((id: string, name: string) => {
    const record = library.get(id);
    if (!record) throw new Error("The project no longer exists in local storage.");
    const renamed = library.rename(id, name, record.revision);
    if (currentRef.current?.id === id) {
      currentRef.current = renamed;
      setCurrent(renamed);
    }
    setProjects(library.list());
  }, [library]);

  const duplicate = useCallback((id: string, name?: string) => {
    library.duplicate(id, name);
    setProjects(library.list());
  }, [library]);

  const deleteProject = useCallback((id: string) => {
    const deletingCurrent = currentRef.current?.id === id ? currentRef.current : null;
    const recoverySnapshot = deletingCurrent ? captureProject(deletingCurrent.project.mode) : null;
    library.delete(id);
    if (deletingCurrent && recoverySnapshot) {
      currentRef.current = null;
      setCurrent(null);
      setStatus("dirty");
      const recovered: RecoveryRecord = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        route: routeRef.current,
        projectId: null,
        projectRevision: null,
        projectName: `${deletingCurrent.name} (unsaved recovery)`,
        project: recoverySnapshot,
      };
      writeRecovery(window.localStorage, recovered);
      setRecovery(recovered);
    }
    setProjects(library.list());
  }, [library]);

  const exportProject = useCallback((id: string) => {
    const record = library.get(id);
    if (!record) throw new Error("The project no longer exists in local storage.");
    const safeName = record.name.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "antenna-project";
    downloadProject(record.project, `${safeName}.hfas`);
  }, [library]);

  const inspectImport = useCallback((text: string, filename: string): PendingProjectImport => {
    if (!isSupportedProjectFilename(filename)) {
      throw new Error(`Expected a .hfas, .antennasim, or .json file, got "${filename}".`);
    }
    return {
      ...parseProjectText(text),
      suggestedName: filenameStem(filename),
    };
  }, []);

  const importProject = useCallback((candidate: PendingProjectImport, name?: string) => {
    // Import is Save As: the source text remains untouched and is not replaced
    // until the user explicitly confirms this operation in the UI.
    const record = library.create(name ?? candidate.suggestedName, candidate.project);
    setProjects(library.list());
    return record;
  }, [library]);

  const recover = useCallback(() => {
    const recovered = readRecovery(window.localStorage);
    if (!recovered) throw new Error("No recovery copy is available.");
    beginRestore(recovered.project);
    const candidate = recovered.projectId ? library.get(recovered.projectId) : null;
    const matching = candidate && candidate.revision === recovered.projectRevision ? candidate : null;
    currentRef.current = matching;
    setCurrent(matching);
    setStatus("dirty");
    setError(null);
    navigate(recovered.project.mode === "editor" ? "/editor" : "/");
  }, [beginRestore, library, navigate]);

  const discardRecovery = useCallback(() => {
    clearRecovery(window.localStorage);
    setRecovery(null);
  }, []);

  const value = useMemo<ProjectSessionValue>(() => ({
    projects,
    current,
    recovery,
    status,
    error,
    lastSavedAt,
    refresh,
    newProject,
    save,
    saveAs,
    open,
    rename,
    duplicate,
    deleteProject,
    exportProject,
    inspectImport,
    importProject,
    recover,
    discardRecovery,
  }), [projects, current, recovery, status, error, lastSavedAt, refresh, newProject, save, saveAs, open, rename, duplicate, deleteProject, exportProject, inspectImport, importProject, recover, discardRecovery]);

  return <ProjectSessionContext.Provider value={value}>{children}</ProjectSessionContext.Provider>;
}

// The provider and its context hook intentionally share one feature module.
// eslint-disable-next-line react-refresh/only-export-components
export function useProjectSession(): ProjectSessionValue {
  const value = useContext(ProjectSessionContext);
  if (!value) throw new Error("useProjectSession must be used inside ProjectSessionProvider.");
  return value;
}
