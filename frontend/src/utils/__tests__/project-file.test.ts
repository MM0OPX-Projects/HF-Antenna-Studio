/**
 * Tests for project file save/load (.hfas plus legacy .antennasim).
 *
 * Why these tests matter:
 * - A broken round-trip means users lose their antenna designs
 * - Schema validation prevents crashes when loading old or malformed files
 * - Version checking prevents silent data corruption from incompatible files
 */

import {
  PROJECT_SCHEMA_VERSION,
  validateProjectFile,
  createSimulatorProject,
  createEditorProject,
  createModelComparisonProject,
  createParameterSweepProject,
  createAntennaOptimiserProject,
  estimateProjectSize,
  migrateProjectFile,
  parseProjectText,
  isSupportedProjectFilename,
  MAX_PROJECT_FILE_CHARACTERS,
} from "../project-file";
import type { ProjectFile } from "../project-file";
import { clonePreset, createDefaultComparisonConditions, createDefaultComparisonSweep } from "../../features/model-comparison/model";
import { createDefaultSweepDefinition } from "../../features/parameter-sweeps/model";
import { createDefaultOptimisationDefinition } from "../../features/antenna-optimiser/model";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSimProject(): ProjectFile {
  return createSimulatorProject(
    "dipole",
    { frequency: 14.1, length: 10.0, height: 10.0 },
    { type: "free_space" },
  );
}

function makeEditorProject(): ProjectFile {
  return createEditorProject(
    [{ tag: 1, segments: 21, x1: -5, y1: 0, z1: 10, x2: 5, y2: 0, z2: 10, radius: 0.001 }],
    [{ wire_tag: 1, segment: 11, voltage_real: 1, voltage_imag: 0 }],
    [],
    [],
    { type: "average" },
    { start_mhz: 14.0, stop_mhz: 14.35, steps: 15 },
    14.1,
  );
}

// ---------------------------------------------------------------------------
// createSimulatorProject
// ---------------------------------------------------------------------------

describe("createSimulatorProject", () => {
  it("creates a valid project with correct metadata", () => {
    const project = makeSimProject();
    expect(project.version).toBe(PROJECT_SCHEMA_VERSION);
    expect(project.mode).toBe("simulator");
    expect(project.simulator).toBeDefined();
    expect(project.simulator!.templateId).toBe("dipole");
    expect(project.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601
  });

  it("deep-copies params (no shared references)", () => {
    const params = { frequency: 14.1 };
    const project = createSimulatorProject("dipole", params, { type: "free_space" });
    params.frequency = 7.0; // Mutate original
    expect(project.simulator!.params.frequency).toBe(14.1); // Project unchanged
  });
});

// ---------------------------------------------------------------------------
// createEditorProject
// ---------------------------------------------------------------------------

describe("createEditorProject", () => {
  it("creates a valid editor project", () => {
    const project = makeEditorProject();
    expect(project.mode).toBe("editor");
    expect(project.editor).toBeDefined();
    expect(project.editor!.wires).toHaveLength(1);
    expect(project.editor!.excitations).toHaveLength(1);
    expect(project.editor!.designFrequencyMhz).toBe(14.1);
  });

  it("deep-copies wires (no shared references)", () => {
    const wires = [{ tag: 1, segments: 21, segmentsManual: true, lengthLocked: true, x1: -5, y1: 0, z1: 10, x2: 5, y2: 0, z2: 10, radius: 0.001 }];
    const project = createEditorProject(
      wires, [], [], [], { type: "free_space" },
      { start_mhz: 14.0, stop_mhz: 14.35, steps: 15 }, 14.1,
    );
    wires[0]!.x1 = 999; // Mutate original
    expect(project.editor!.wires[0]!.x1).toBe(-5); // Project unchanged
    expect(project.editor!.wires[0]).toMatchObject({ segmentsManual: true, lengthLocked: true });
  });

  it("deep-copies persistent editor junctions", () => {
    const junctions = [{
      id: 1,
      endpoints: [
        { wireTag: 1, endpoint: "end" as const },
        { wireTag: 2, endpoint: "start" as const },
      ],
    }];
    const project = createEditorProject(
      [
        { tag: 1, segments: 3, x1: 0, y1: 0, z1: 0, x2: 1, y2: 0, z2: 0, radius: 0.001 },
        { tag: 2, segments: 3, x1: 1, y1: 0, z1: 0, x2: 2, y2: 0, z2: 0, radius: 0.001 },
      ],
      [], [], [], { type: "free_space" },
      { start_mhz: 14, stop_mhz: 14.35, steps: 15 }, 14.1, junctions,
    );

    junctions[0]!.endpoints[0]!.wireTag = 99;
    expect(project.editor!.junctions[0]!.endpoints[0]!.wireTag).toBe(1);
  });

  it("records the explicit simulator frequency range and multi-band sweep intent", () => {
    const project = createSimulatorProject(
      "dipole",
      { frequency: 14.1 },
      { type: "free_space" },
      null,
      { start_mhz: 14, stop_mhz: 14.35, steps: 15 },
      [{ start_mhz: 7, stop_mhz: 7.2, steps: 5 }],
    );
    expect(project.simulator?.frequencyRange).toEqual({ start_mhz: 14, stop_mhz: 14.35, steps: 15 });
    expect(project.simulator?.frequencySegments).toEqual([{ start_mhz: 7, stop_mhz: 7.2, steps: 5 }]);
  });

  it("preserves decoded NEC source provenance and multi-block frequency intent", () => {
    const necImport = {
      source_name: "import.nec",
      imported_model_fingerprint: "semantic-model",
      document: {
        original_text: "CM exact\r\nGW 1 3 0 0 1 1 0 1 .001\r\nEN\r\n",
        structured_editable: true,
        cards: [{ line_number: 1, card: "CM", raw: "CM exact", disposition: "regenerated" as const }],
        diagnostics: [],
      },
    };
    const project = createEditorProject(
      [{ tag: 1, segments: 3, x1: 0, y1: 0, z1: 1, x2: 1, y2: 0, z2: 1, radius: 0.001 }],
      [], [], [], { type: "free_space" },
      { start_mhz: 7, stop_mhz: 7.2, steps: 3 }, 14.1, [], null, necImport,
      [{ start_mhz: 7, stop_mhz: 7.2, steps: 3 }, { start_mhz: 14, stop_mhz: 14.2, steps: 2 }],
      -1,
    );
    const roundTrip = validateProjectFile(JSON.parse(JSON.stringify(project)));
    expect(roundTrip.editor?.necImport?.document.original_text).toBe(necImport.document.original_text);
    expect(roundTrip.editor?.frequencySegments).toHaveLength(2);
    expect(roundTrip.editor?.geometryGroundFlag).toBe(-1);

    necImport.document.cards[0]!.raw = "changed";
    expect(project.editor?.necImport?.document.cards[0]?.raw).toBe("CM exact");
  });
});

// ---------------------------------------------------------------------------
// Round-trip: create → serialize → parse → validate
// ---------------------------------------------------------------------------

describe("Round-trip serialization", () => {
  it("simulator project survives JSON round-trip", () => {
    const original = makeSimProject();
    const json = JSON.stringify(original);
    const parsed = validateProjectFile(JSON.parse(json));

    expect(parsed.mode).toBe("simulator");
    expect(parsed.simulator!.templateId).toBe("dipole");
    expect(parsed.simulator!.params.frequency).toBe(14.1);
    expect(parsed.simulator!.ground.type).toBe("free_space");
  });

  it("editor project survives JSON round-trip", () => {
    const original = makeEditorProject();
    const json = JSON.stringify(original);
    const parsed = validateProjectFile(JSON.parse(json));

    expect(parsed.mode).toBe("editor");
    expect(parsed.editor!.wires).toHaveLength(1);
    expect(parsed.editor!.wires[0]!.tag).toBe(1);
    expect(parsed.editor!.excitations[0]!.segment).toBe(11);
    expect(parsed.editor!.frequencyRange.start_mhz).toBe(14.0);
  });
});

// ---------------------------------------------------------------------------
// validateProjectFile — error cases
// ---------------------------------------------------------------------------

describe("validateProjectFile — error cases", () => {
  it("migrates schema v1 editor projects to unlocked junctions", () => {
    const project = makeEditorProject();
    project.version = 1;
    delete (project.editor as { junctions?: unknown }).junctions;

    const migrated = validateProjectFile(project);
    expect(migrated.editor!.junctions).toEqual([]);
  });

  it("preserves radial-system identity in comparison, sweep, and optimiser projects", () => {
    const conditions = createDefaultComparisonConditions();
    conditions.ground = { kind: "sommerfeld-norton", conductivitySPerM: 0.005, relativePermittivity: 13 };
    conditions.radialSystems = { ...conditions.radialSystems, verticalMode: "near-surface", phasedMode: "near-surface-shared" };
    const comparison = createModelComparisonProject(clonePreset("mixed"), conditions, createDefaultComparisonSweep());

    const sweepDefinition = createDefaultSweepDefinition();
    sweepDefinition.family = "vertical";
    sweepDefinition.ground = structuredClone(conditions.ground);
    sweepDefinition.radialSystems = structuredClone(conditions.radialSystems);
    sweepDefinition.axes = [{ parameterId: "radial-count", start: 4, stop: 16, points: 4 }];
    const sweep = createParameterSweepProject(sweepDefinition);

    const optimiserDefinition = createDefaultOptimisationDefinition();
    optimiserDefinition.family = "vertical";
    optimiserDefinition.ground = structuredClone(conditions.ground);
    optimiserDefinition.radialSystems = structuredClone(conditions.radialSystems);
    optimiserDefinition.variables = [{ parameterId: "vertical-length", minimum: 3.2, maximum: 6.4 }];
    const optimiser = createAntennaOptimiserProject(optimiserDefinition);

    expect(validateProjectFile(JSON.parse(JSON.stringify(comparison))).modelComparison?.conditions.radialSystems.phasedMode).toBe("near-surface-shared");
    expect(validateProjectFile(JSON.parse(JSON.stringify(sweep))).parameterSweep?.definition.radialSystems.verticalMode).toBe("near-surface");
    expect(validateProjectFile(JSON.parse(JSON.stringify(optimiser))).antennaOptimiser?.definition.radialSystems.verticalMode).toBe("near-surface");
  });

  it("round-trips structurally valid drafts even when RF preflight must block calculation", () => {
    const conditions = createDefaultComparisonConditions();
    conditions.ground = { kind: "sommerfeld-norton", conductivitySPerM: 0.005, relativePermittivity: 13 };
    conditions.radialSystems = { ...conditions.radialSystems, verticalMode: "near-surface" };
    const draft = createModelComparisonProject(clonePreset("vertical"), conditions, createDefaultComparisonSweep());
    const reopened = validateProjectFile(JSON.parse(JSON.stringify(draft)));
    expect(reopened.modelComparison?.definitions[0]?.parameterValue).toBe(2);
    expect(reopened.modelComparison?.conditions.radialSystems.verticalMode).toBe("near-surface");
  });

  it("rejects workflow files whose nested structures could crash their destination page", () => {
    const comparison = createModelComparisonProject(clonePreset("mixed"), createDefaultComparisonConditions(), createDefaultComparisonSweep());
    (comparison.modelComparison!.definitions[0] as { family: string }).family = "unknown";
    expect(() => validateProjectFile(comparison)).toThrow("model-comparison");

    const sweep = createParameterSweepProject(createDefaultSweepDefinition());
    (sweep.parameterSweep!.definition.axes[0] as { parameterId: string }).parameterId = "unknown";
    expect(() => validateProjectFile(sweep)).toThrow("schema-v2 definition");

    const optimiser = createAntennaOptimiserProject(createDefaultOptimisationDefinition());
    delete (optimiser.antennaOptimiser!.definition.objective as { weights?: unknown }).weights;
    expect(() => validateProjectFile(optimiser)).toThrow("schema-v2 definition");
  });

  it("migrates on a copy and leaves the older input object unchanged", () => {
    const source = makeEditorProject();
    source.version = 1;
    delete (source.editor as { junctions?: unknown }).junctions;
    delete (source.editor as { frequencySegments?: unknown }).frequencySegments;
    const sourceText = JSON.stringify(source);

    const migrated = migrateProjectFile(source);

    expect(migrated.sourceVersion).toBe(1);
    expect(migrated.project.version).toBe(PROJECT_SCHEMA_VERSION);
    expect(migrated.project.editor?.junctions).toEqual([]);
    expect(migrated.migrations).toHaveLength(4);
    expect(migrated.migrations[migrated.migrations.length - 1]).toContain("v4 to v5");
    expect(JSON.stringify(source)).toBe(sourceText);
  });

  it("retains the exact imported source text alongside a migration", () => {
    const source = makeSimProject();
    source.version = 3;
    const text = `${JSON.stringify(source, null, 4)}\r\n`;
    const parsed = parseProjectText(text);

    expect(parsed.originalText).toBe(text);
    expect(parsed.project.version).toBe(PROJECT_SCHEMA_VERSION);
    expect(parsed.migrations).toHaveLength(2);
  });

  it("accepts current and legacy project filenames case-insensitively", () => {
    expect(isSupportedProjectFilename("field.HFAS")).toBe(true);
    expect(isSupportedProjectFilename("old.antennasim")).toBe(true);
    expect(isSupportedProjectFilename("project.json")).toBe(true);
    expect(isSupportedProjectFilename("project.txt")).toBe(false);
  });

  it("rejects oversized source text before JSON parsing", () => {
    expect(() => parseProjectText("x".repeat(MAX_PROJECT_FILE_CHARACTERS + 1))).toThrow("safety limit");
  });

  it("rejects null", () => {
    expect(() => validateProjectFile(null)).toThrow("not an object");
  });

  it("rejects string", () => {
    expect(() => validateProjectFile("hello")).toThrow("not an object");
  });

  it("rejects object without version", () => {
    expect(() => validateProjectFile({ mode: "simulator" })).toThrow("missing 'version'");
  });

  it("rejects future schema version", () => {
    expect(() => validateProjectFile({
      version: PROJECT_SCHEMA_VERSION + 1,
      mode: "simulator",
      simulator: { templateId: "dipole", params: {} },
    })).toThrow("newer than supported");
  });

  it("rejects invalid mode", () => {
    expect(() => validateProjectFile({ version: 1, mode: "invalid" })).toThrow("'mode' must be");
  });

  it("rejects simulator mode without templateId", () => {
    expect(() => validateProjectFile({
      version: 1,
      mode: "simulator",
      simulator: { params: {} },
    })).toThrow("templateId");
  });

  it("rejects editor mode without wires", () => {
    expect(() => validateProjectFile({
      version: 1,
      mode: "editor",
      editor: {},
    })).toThrow("wires");
  });

  it("rejects editor mode with empty wires array", () => {
    expect(() => validateProjectFile({
      version: 1,
      mode: "editor",
      editor: { wires: [] },
    })).toThrow("at least one wire");
  });

  it("rejects junctions that reference missing wires", () => {
    const project = makeEditorProject();
    project.editor!.junctions = [{
      id: 1,
      endpoints: [
        { wireTag: 1, endpoint: "start" },
        { wireTag: 99, endpoint: "end" },
      ],
    }];
    expect(() => validateProjectFile(project)).toThrow("missing wire");
  });
});

// ---------------------------------------------------------------------------
// estimateProjectSize
// ---------------------------------------------------------------------------

describe("estimateProjectSize", () => {
  it("returns a positive number", () => {
    expect(estimateProjectSize(makeSimProject())).toBeGreaterThan(0);
  });

  it("editor project with result is larger than without", () => {
    const small = makeEditorProject();
    small.result = null;
    const large = makeEditorProject();
    large.result = { frequency_data: [{ frequency_mhz: 14.1 } as never] } as never;
    expect(estimateProjectSize(large)).toBeGreaterThan(estimateProjectSize(small));
  });
});
