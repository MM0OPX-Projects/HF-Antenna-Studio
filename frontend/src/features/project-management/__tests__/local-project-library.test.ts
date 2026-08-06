import { createSimulatorProject } from "../../../utils/project-file";
import {
  LocalProjectLibrary,
  PROJECT_LIBRARY_STORAGE_KEY,
  PROJECT_RECOVERY_STORAGE_KEY,
  ProjectRevisionConflictError,
  clearRecovery,
  readRecovery,
  writeRecovery,
  type StorageLike,
} from "../local-project-library";

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();
  failWrites = false;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new DOMException("quota exceeded", "QuotaExceededError");
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function model(frequency = 14.1) {
  return createSimulatorProject(
    "dipole",
    { frequency, length: 10.1 },
    { type: "average" },
    null,
    { start_mhz: 14, stop_mhz: 14.35, steps: 15 },
    [],
  );
}

describe("LocalProjectLibrary", () => {
  it("creates, lists, and retrieves detached project records", () => {
    const storage = new MemoryStorage();
    const library = new LocalProjectLibrary(storage, () => new Date("2026-08-06T10:00:00Z"), () => "p1");
    const created = library.create("  20m   dipole  ", model());

    expect(created).toMatchObject({ id: "p1", name: "20m dipole", revision: 1 });
    created.project.simulator!.params.frequency = 7;
    expect(library.get("p1")!.project.simulator!.params.frequency).toBe(14.1);
    expect(library.list()).toHaveLength(1);
  });

  it("uses optimistic revisions so a stale tab cannot overwrite a newer save", () => {
    const storage = new MemoryStorage();
    let tick = 0;
    const library = new LocalProjectLibrary(storage, () => new Date(1_700_000_000_000 + tick++ * 1000), () => "p1");
    const created = library.create("Dipole", model());
    const saved = library.save(created.id, model(14.2), created.revision);

    expect(saved.revision).toBe(2);
    expect(saved.project.simulator!.params.frequency).toBe(14.2);
    expect(() => library.save(created.id, model(14.3), created.revision)).toThrow(ProjectRevisionConflictError);
  });

  it("renames, duplicates, and deletes without sharing project objects", () => {
    const storage = new MemoryStorage();
    let id = 0;
    const library = new LocalProjectLibrary(storage, () => new Date("2026-08-06T10:00:00Z"), () => `p${++id}`);
    const original = library.create("Dipole", model());
    const renamed = library.rename(original.id, "Field dipole", original.revision);
    const copy = library.duplicate(original.id);

    expect(renamed).toMatchObject({ name: "Field dipole", revision: 2 });
    expect(copy).toMatchObject({ id: "p2", name: "Field dipole copy", revision: 1 });
    library.delete(original.id);
    expect(library.list().map((record) => record.id)).toEqual(["p2"]);
  });

  it("leaves the previous atomic document intact when storage rejects a write", () => {
    const storage = new MemoryStorage();
    const library = new LocalProjectLibrary(storage, undefined, () => "p1");
    library.create("Dipole", model());
    const before = storage.getItem(PROJECT_LIBRARY_STORAGE_KEY);
    storage.failWrites = true;

    expect(() => library.rename("p1", "Changed", 1)).toThrow("Export the project file");
    expect(storage.getItem(PROJECT_LIBRARY_STORAGE_KEY)).toBe(before);
  });

  it("does not replace a corrupt local index", () => {
    const storage = new MemoryStorage();
    storage.setItem(PROJECT_LIBRARY_STORAGE_KEY, "{broken");
    const library = new LocalProjectLibrary(storage);

    expect(() => library.list()).toThrow("left untouched");
    expect(storage.getItem(PROJECT_LIBRARY_STORAGE_KEY)).toBe("{broken");
  });

  it("rejects an ID collision without replacing the existing project", () => {
    const storage = new MemoryStorage();
    const library = new LocalProjectLibrary(storage, undefined, () => "same-id");
    library.create("First", model());
    expect(() => library.create("Second", model())).toThrow("unique local project ID");
    expect(library.list().map((record) => record.name)).toEqual(["First"]);
  });
});

describe("recovery journal", () => {
  it("round-trips and clears a detached recovery model", () => {
    const storage = new MemoryStorage();
    writeRecovery(storage, {
      schemaVersion: 1,
      savedAt: "2026-08-06T10:00:00Z",
      route: "/",
      projectId: null,
      projectRevision: null,
      projectName: "Untitled project",
      project: model(),
    });
    const recovered = readRecovery(storage)!;

    expect(recovered.project.simulator!.frequencyRange).toEqual({ start_mhz: 14, stop_mhz: 14.35, steps: 15 });
    recovered.project.simulator!.params.frequency = 1.8;
    expect(JSON.parse(storage.getItem(PROJECT_RECOVERY_STORAGE_KEY)!).project.simulator.params.frequency).toBe(14.1);
    clearRecovery(storage);
    expect(readRecovery(storage)).toBeNull();
  });

  it("retains an invalid recovery record for manual inspection", () => {
    const storage = new MemoryStorage();
    storage.setItem(PROJECT_RECOVERY_STORAGE_KEY, "not-json");
    expect(() => readRecovery(storage)).toThrow("left untouched");
    expect(storage.getItem(PROJECT_RECOVERY_STORAGE_KEY)).toBe("not-json");
  });
});
