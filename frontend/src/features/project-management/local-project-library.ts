import {
  migrateProjectFile,
  type ProjectFile,
  type ProjectMigrationResult,
} from "../../utils/project-file";

export const PROJECT_LIBRARY_STORAGE_KEY = "hfas.project-library.v1";
export const PROJECT_RECOVERY_STORAGE_KEY = "hfas.project-recovery.v1";
export const PROJECT_LIBRARY_SCHEMA_VERSION = 1;
export const MAX_LOCAL_PROJECTS = 100;
export const MAX_PROJECT_NAME_LENGTH = 80;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LocalProjectRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
  revision: number;
  project: ProjectFile;
}

interface ProjectLibraryDocument {
  schemaVersion: typeof PROJECT_LIBRARY_SCHEMA_VERSION;
  projects: LocalProjectRecord[];
}

export interface RecoveryRecord {
  schemaVersion: 1;
  savedAt: string;
  route: string;
  projectId: string | null;
  projectRevision: number | null;
  projectName: string;
  project: ProjectFile;
}

export class ProjectRevisionConflictError extends Error {
  constructor() {
    super("This project changed in another tab. Your recovery copy is still available; reopen the project before saving again.");
    this.name = "ProjectRevisionConflictError";
  }
}

function cloneProject(project: ProjectFile): ProjectFile {
  return JSON.parse(JSON.stringify(project)) as ProjectFile;
}

function cloneRecord(record: LocalProjectRecord): LocalProjectRecord {
  return { ...record, project: cloneProject(record.project) };
}

function defaultId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `project-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normaliseProjectName(value: string): string {
  const printable = Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? " " : character;
  }).join("");
  const name = printable.replace(/\s+/g, " ").trim();
  if (!name) throw new Error("Project name cannot be empty.");
  return name.slice(0, MAX_PROJECT_NAME_LENGTH);
}

function validateRecord(raw: unknown): LocalProjectRecord {
  if (!raw || typeof raw !== "object") throw new Error("Local project record is invalid.");
  const record = raw as Record<string, unknown>;
  for (const key of ["id", "name", "createdAt", "updatedAt", "lastOpenedAt"] as const) {
    if (typeof record[key] !== "string") throw new Error(`Local project record is missing ${key}.`);
  }
  if (!Number.isInteger(record.revision) || (record.revision as number) < 1) {
    throw new Error("Local project record has an invalid revision.");
  }
  return {
    id: record.id as string,
    name: normaliseProjectName(record.name as string),
    createdAt: record.createdAt as string,
    updatedAt: record.updatedAt as string,
    lastOpenedAt: record.lastOpenedAt as string,
    revision: record.revision as number,
    project: migrateProjectFile(record.project).project,
  };
}

export class LocalProjectLibrary {
  constructor(
    private readonly storage: StorageLike,
    private readonly now: () => Date = () => new Date(),
    private readonly makeId: () => string = defaultId,
  ) {}

  private readDocument(): ProjectLibraryDocument {
    const text = this.storage.getItem(PROJECT_LIBRARY_STORAGE_KEY);
    if (text === null) return { schemaVersion: PROJECT_LIBRARY_SCHEMA_VERSION, projects: [] };
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error("The local project index is not valid JSON. It was left untouched for manual recovery.");
    }
    if (!raw || typeof raw !== "object") throw new Error("The local project index is invalid and was left untouched.");
    const document = raw as Record<string, unknown>;
    if (document.schemaVersion !== PROJECT_LIBRARY_SCHEMA_VERSION || !Array.isArray(document.projects)) {
      throw new Error("The local project index uses an unsupported schema and was left untouched.");
    }
    const projects = document.projects.map(validateRecord);
    const ids = new Set(projects.map((project) => project.id));
    if (ids.size !== projects.length) throw new Error("The local project index contains duplicate IDs and was left untouched.");
    return { schemaVersion: PROJECT_LIBRARY_SCHEMA_VERSION, projects };
  }

  private writeDocument(document: ProjectLibraryDocument): void {
    try {
      // A single storage entry makes the collection replacement atomic from
      // the point of view of other tabs and protects the previous value if a
      // quota exception occurs before setItem succeeds.
      this.storage.setItem(PROJECT_LIBRARY_STORAGE_KEY, JSON.stringify(document));
    } catch (error) {
      const message = error instanceof Error ? error.message : "browser storage rejected the write";
      throw new Error(`Could not save locally (${message}). Export the project file before closing this page.`);
    }
  }

  list(): LocalProjectRecord[] {
    return this.readDocument().projects
      .map(cloneRecord)
      .sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
  }

  get(id: string): LocalProjectRecord | null {
    const record = this.readDocument().projects.find((project) => project.id === id);
    return record ? cloneRecord(record) : null;
  }

  create(name: string, project: ProjectFile): LocalProjectRecord {
    const document = this.readDocument();
    if (document.projects.length >= MAX_LOCAL_PROJECTS) {
      throw new Error(`The local library is limited to ${MAX_LOCAL_PROJECTS} projects. Export or delete an older project first.`);
    }
    const timestamp = this.now().toISOString();
    const id = this.makeId();
    if (document.projects.some((candidate) => candidate.id === id)) {
      throw new Error("Could not create a unique local project ID. Try saving again.");
    }
    const record: LocalProjectRecord = {
      id,
      name: normaliseProjectName(name),
      createdAt: timestamp,
      updatedAt: timestamp,
      lastOpenedAt: timestamp,
      revision: 1,
      project: migrateProjectFile(project).project,
    };
    document.projects.push(record);
    this.writeDocument(document);
    return cloneRecord(record);
  }

  save(id: string, project: ProjectFile, expectedRevision: number): LocalProjectRecord {
    const document = this.readDocument();
    const index = document.projects.findIndex((candidate) => candidate.id === id);
    if (index < 0) throw new Error("The project no longer exists in local storage.");
    const previous = document.projects[index]!;
    if (previous.revision !== expectedRevision) throw new ProjectRevisionConflictError();
    const timestamp = this.now().toISOString();
    const record: LocalProjectRecord = {
      ...previous,
      project: migrateProjectFile(project).project,
      updatedAt: timestamp,
      lastOpenedAt: timestamp,
      revision: previous.revision + 1,
    };
    document.projects[index] = record;
    this.writeDocument(document);
    return cloneRecord(record);
  }

  markOpened(id: string): LocalProjectRecord {
    const document = this.readDocument();
    const index = document.projects.findIndex((candidate) => candidate.id === id);
    if (index < 0) throw new Error("The project no longer exists in local storage.");
    const record = { ...document.projects[index]!, lastOpenedAt: this.now().toISOString() };
    document.projects[index] = record;
    this.writeDocument(document);
    return cloneRecord(record);
  }

  rename(id: string, name: string, expectedRevision: number): LocalProjectRecord {
    const document = this.readDocument();
    const index = document.projects.findIndex((candidate) => candidate.id === id);
    if (index < 0) throw new Error("The project no longer exists in local storage.");
    const previous = document.projects[index]!;
    if (previous.revision !== expectedRevision) throw new ProjectRevisionConflictError();
    const timestamp = this.now().toISOString();
    const record = {
      ...previous,
      name: normaliseProjectName(name),
      updatedAt: timestamp,
      revision: previous.revision + 1,
    };
    document.projects[index] = record;
    this.writeDocument(document);
    return cloneRecord(record);
  }

  duplicate(id: string, name?: string): LocalProjectRecord {
    const source = this.get(id);
    if (!source) throw new Error("The project no longer exists in local storage.");
    return this.create(name ?? `${source.name} copy`, source.project);
  }

  delete(id: string): void {
    const document = this.readDocument();
    const projects = document.projects.filter((project) => project.id !== id);
    if (projects.length === document.projects.length) throw new Error("The project no longer exists in local storage.");
    this.writeDocument({ ...document, projects });
  }
}

export function writeRecovery(storage: StorageLike, record: RecoveryRecord): void {
  try {
    storage.setItem(PROJECT_RECOVERY_STORAGE_KEY, JSON.stringify({
      ...record,
      schemaVersion: 1,
      project: migrateProjectFile(record.project).project,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "browser storage rejected the write";
    throw new Error(`Could not update the recovery copy (${message}).`);
  }
}

export function readRecovery(storage: StorageLike): (RecoveryRecord & ProjectMigrationResult) | null {
  const text = storage.getItem(PROJECT_RECOVERY_STORAGE_KEY);
  if (text === null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("The recovery record is corrupt. It was left untouched.");
  }
  if (!raw || typeof raw !== "object") throw new Error("The recovery record is invalid. It was left untouched.");
  const record = raw as Record<string, unknown>;
  if (
    record.schemaVersion !== 1 ||
    typeof record.savedAt !== "string" ||
    typeof record.route !== "string" ||
    typeof record.projectName !== "string" ||
    (record.projectId !== null && typeof record.projectId !== "string") ||
    (record.projectRevision !== undefined && record.projectRevision !== null && !Number.isInteger(record.projectRevision))
  ) {
    throw new Error("The recovery record uses an unsupported format. It was left untouched.");
  }
  const migration = migrateProjectFile(record.project);
  return {
    schemaVersion: 1,
    savedAt: record.savedAt,
    route: record.route,
    projectId: record.projectId as string | null,
    projectRevision: (record.projectRevision as number | null | undefined) ?? null,
    projectName: record.projectName,
    ...migration,
  };
}

export function clearRecovery(storage: StorageLike): void {
  storage.removeItem(PROJECT_RECOVERY_STORAGE_KEY);
}
