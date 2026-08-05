import { beforeEach, describe, expect, it } from "vitest";
import { useEditorStore, type EditorWire } from "../editorStore";
import { editorModelFingerprint } from "../../features/wire-editor/model-fingerprint";

const base: EditorWire = {
  tag: 1,
  segments: 11,
  segmentsManual: true,
  x1: 0,
  y1: 0,
  z1: 10,
  x2: 2,
  y2: 0,
  z2: 10,
  radius: 0.001,
};

function reset() {
  useEditorStore.setState({
    wires: [{ ...base }],
    excitations: [{ wire_tag: 1, segment: 6, voltage_real: 1, voltage_imag: 0 }],
    loads: [],
    transmissionLines: [],
    junctions: [],
    selectedTags: new Set([1]),
    selectedEndpoints: [],
    nextTag: 2,
    nextJunctionId: 1,
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,
    geometryTransaction: null,
    geometryGroundFlag: null,
    necImport: null,
    blockedNecImport: null,
    lastEditorMessage: null,
  });
}

describe("wire-editor transforms", () => {
  beforeEach(reset);

  it("translates selected geometry and restores it with undo", () => {
    useEditorStore.getState().moveSelected(1, -2, 3);
    expect(useEditorStore.getState().wires[0]).toMatchObject({ x1: 1, y1: -2, z1: 13, x2: 3, y2: -2, z2: 13 });
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().wires[0]).toMatchObject(base);
  });

  it("rotates around the selection centroid with one undo step", () => {
    const result = useEditorStore.getState().rotateSelected("z", 90);
    expect(result.ok).toBe(true);
    const rotated = useEditorStore.getState().wires[0]!;
    expect(rotated.x1).toBeCloseTo(1, 12);
    expect(rotated.y1).toBeCloseTo(-1, 12);
    expect(rotated.x2).toBeCloseTo(1, 12);
    expect(rotated.y2).toBeCloseTo(1, 12);
    expect(useEditorStore.getState().undoStack).toHaveLength(1);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().wires[0]).toMatchObject(base);
  });

  it("creates an explicit reflected copy on all axes", () => {
    for (const axis of ["x", "y", "z"] as const) {
      reset();
      useEditorStore.getState().mirrorSelected(axis);
      expect(useEditorStore.getState().wires).toHaveLength(2);
      expect(useEditorStore.getState().selectedTags).toEqual(new Set([1, 2]));
    }
  });

  it("duplicates attached sources, loads, and fully contained transmission lines", () => {
    useEditorStore.setState({
      excitations: [
        { wire_tag: 1, segment: 3, voltage_real: 1, voltage_imag: 0 },
        { wire_tag: 1, segment: 8, voltage_real: 0.5, voltage_imag: -0.25 },
      ],
      loads: [{ load_type: 4, wire_tag: 1, segment_start: 6, segment_end: 6, param1: 20, param2: -4, param3: 0 }],
      transmissionLines: [{ wire_tag1: 1, segment1: 2, wire_tag2: 1, segment2: 10, impedance: 75, length: 2 }],
    });

    useEditorStore.getState().duplicateSelected();
    const state = useEditorStore.getState();
    expect(state.excitations.filter((source) => source.wire_tag === 2)).toHaveLength(2);
    expect(state.loads).toContainEqual(expect.objectContaining({ wire_tag: 2, segment_start: 6 }));
    expect(state.transmissionLines).toContainEqual(expect.objectContaining({ wire_tag1: 2, wire_tag2: 2 }));
  });

  it("removes dependent references on delete and remaps them on split with undo", () => {
    useEditorStore.setState({
      loads: [{ load_type: 0, wire_tag: 1, segment_start: 5, segment_end: 8, param1: 50, param2: 0, param3: 0 }],
      transmissionLines: [{ wire_tag1: 1, segment1: 2, wire_tag2: 1, segment2: 10, impedance: 75, length: 2 }],
    });
    useEditorStore.getState().splitWire(1);
    let state = useEditorStore.getState();
    expect(state.wires.map((wire) => wire.segments)).toEqual([6, 5]);
    expect(state.wires.every((wire) => wire.segmentsManual)).toBe(true);
    expect(state.loads).toHaveLength(2);
    expect(state.loads.every((load) => load.wire_tag === 2 || load.wire_tag === 3)).toBe(true);
    expect(state.transmissionLines[0]).toMatchObject({ wire_tag1: 2, wire_tag2: 3 });

    useEditorStore.getState().undo();
    state = useEditorStore.getState();
    expect(state.wires).toHaveLength(1);
    expect(state.loads[0]?.wire_tag).toBe(1);
    useEditorStore.getState().deleteWires([1]);
    state = useEditorStore.getState();
    expect(state.loads).toEqual([]);
    expect(state.transmissionLines).toEqual([]);
  });
});

describe("atomic NEC model loading", () => {
  beforeEach(reset);

  it("retains imported segment/radius/source/load/TL values without repair", () => {
    const model = {
      wires: [{ ...base, segments: 301, radius: 0.00001 }],
      excitations: [] as [],
      loads: [{ load_type: 4, wire_tag: 1, segment_start: 301, segment_end: 301, param1: 20, param2: -4, param3: 0 }],
      transmissionLines: [{ wire_tag1: 1, segment1: 301, wire_tag2: 1, segment2: 1, impedance: 75, length: 2 }],
      ground: { type: "custom" as const, custom_permittivity: 15, custom_conductivity: 0.004 },
      geometryGroundFlag: -1 as const,
      frequencyRange: { start_mhz: 14, stop_mhz: 14, steps: 1 },
      frequencySegments: [],
    };
    const fingerprint = editorModelFingerprint(model);
    useEditorStore.getState().loadImportedModel({
      ...model,
      necImport: {
        source_name: "test.nec",
        imported_model_fingerprint: fingerprint,
        document: { original_text: "GW ...\n", cards: [], diagnostics: [], structured_editable: true },
      },
    });

    const state = useEditorStore.getState();
    expect(state.wires[0]).toMatchObject({ segments: 301, radius: 0.00001 });
    expect(state.excitations).toEqual([]);
    expect(state.loads[0]).toMatchObject({ segment_start: 301, param2: -4 });
    expect(state.transmissionLines[0]).toMatchObject({ segment1: 301, impedance: 75 });
    expect(state.geometryGroundFlag).toBe(-1);
    expect(state.necImport?.imported_model_fingerprint).toBe(fingerprint);
    expect(state.undoStack).toEqual([]);
  });

  it("moves an existing imported source without resetting its complex voltage", () => {
    useEditorStore.setState({
      excitations: [{ wire_tag: 1, segment: 3, voltage_real: 0.75, voltage_imag: -0.5 }],
    });
    useEditorStore.getState().setExcitation(1, 7);
    expect(useEditorStore.getState().excitations).toEqual([
      { wire_tag: 1, segment: 7, voltage_real: 0.75, voltage_imag: -0.5 },
    ]);
  });

  it("keeps current-model provenance when a later raw-only import is refused", () => {
    const current = {
      source_name: "current.nec",
      imported_model_fingerprint: "current-model",
      document: { original_text: "GW current", cards: [], diagnostics: [], structured_editable: true },
    };
    const blocked = {
      source_name: "blocked.nec",
      imported_model_fingerprint: "blocked:not-converted",
      document: { original_text: "GA unsupported", cards: [], diagnostics: [], structured_editable: false },
    };
    useEditorStore.getState().setNecImport(current);
    useEditorStore.getState().setBlockedNecImport(blocked);
    expect(useEditorStore.getState().necImport?.source_name).toBe("current.nec");
    expect(useEditorStore.getState().blockedNecImport?.source_name).toBe("blocked.nec");
  });
});
