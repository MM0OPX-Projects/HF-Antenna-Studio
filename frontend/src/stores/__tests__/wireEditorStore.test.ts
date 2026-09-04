import { beforeEach, describe, expect, it } from "vitest";
import { useEditorStore, type EditorWire } from "../editorStore";
import { editorModelFingerprint } from "../../features/wire-editor/model-fingerprint";
import { createDefaultDipoleModel } from "../../features/verified-dipole/model";
import { createVerifiedDipoleTransfer } from "../../features/verified-dipole/transfer";
import { radialEndpoint } from "../../features/wire-editor/radial-system";

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
    radialSystems: [],
    nextRadialSystemId: 1,
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,
    geometryTransaction: null,
    geometryGroundFlag: null,
    ground: { type: "average" },
    necImport: null,
    blockedNecImport: null,
    modelTransfer: null,
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

  it("drags a polyline leg while keeping both neighbouring junctions bonded", () => {
    useEditorStore.setState({
      wires: [
        { ...base, tag: 1, x1: 0, x2: 1 },
        { ...base, tag: 2, x1: 1, x2: 2 },
        { ...base, tag: 3, x1: 2, x2: 3 },
      ],
      junctions: [
        { id: 1, endpoints: [{ wireTag: 1, endpoint: "end" }, { wireTag: 2, endpoint: "start" }] },
        { id: 2, endpoints: [{ wireTag: 2, endpoint: "end" }, { wireTag: 3, endpoint: "start" }] },
      ],
      nextTag: 4,
      nextJunctionId: 3,
    });
    const store = useEditorStore.getState();
    store.beginGeometryTransaction();
    store.moveWire(2, 0, 1, 0);
    useEditorStore.getState().moveWire(2, 0, 1, 0);
    useEditorStore.getState().commitGeometryTransaction();
    const [left, moved, right] = useEditorStore.getState().wires;
    expect(left).toMatchObject({ x1: 0, y1: 0, x2: 1, y2: 2 });
    expect(moved).toMatchObject({ x1: 1, y1: 2, x2: 2, y2: 2 });
    expect(right).toMatchObject({ x1: 2, y1: 2, x2: 3, y2: 0 });
    expect(useEditorStore.getState().undoStack).toHaveLength(1);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().wires.map((wire) => [wire.y1, wire.y2])).toEqual([[0, 0], [0, 0], [0, 0]]);
  });

  it("drags one endpoint while anchoring the opposite end and preserving its junction", () => {
    useEditorStore.setState({
      wires: [
        { ...base, tag: 1, x1: 0, x2: 1 },
        { ...base, tag: 2, x1: 1, x2: 3 },
      ],
      junctions: [{ id: 1, endpoints: [{ wireTag: 1, endpoint: "end" }, { wireTag: 2, endpoint: "start" }] }],
      nextTag: 3,
      nextJunctionId: 2,
    });
    const store = useEditorStore.getState();
    store.beginGeometryTransaction();
    store.moveEndpoint(2, "start", 0, 2, 0);
    useEditorStore.getState().commitGeometryTransaction();
    const [left, edited] = useEditorStore.getState().wires;
    expect(left).toMatchObject({ x1: 0, y1: 0, x2: 1, y2: 2 });
    expect(edited).toMatchObject({ x1: 1, y1: 2, x2: 3, y2: 0 });
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().wires.map((wire) => [wire.y1, wire.y2])).toEqual([[0, 0], [0, 0]]);
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

describe("reviewed module transfers", () => {
  beforeEach(reset);

  it("atomically installs an exact dipole and makes later geometry edits undoable", () => {
    const transfer = createVerifiedDipoleTransfer(createDefaultDipoleModel(), "2026-09-04T12:00:00.000Z");
    useEditorStore.getState().applyModelTransfer(transfer);
    const installed = useEditorStore.getState();
    expect(installed.wires).toEqual([expect.objectContaining({ segments: 21, segmentsManual: true, x1: -5.075, x2: 5.075 })]);
    expect(installed.modelTransfer).toMatchObject({ sourceModuleId: "verified-dipole", editorModelFingerprint: transfer.provenance.editorModelFingerprint });
    expect(installed.ground).toEqual({ type: "perfect" });
    expect(installed.undoStack).toHaveLength(0);

    installed.selectWire(1);
    useEditorStore.getState().moveSelected(1, 0, 0);
    expect(useEditorStore.getState().wires[0]!.x1).toBe(-4.075);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().wires[0]!.x1).toBe(-5.075);
  });

  it("refuses a transfer whose parity gate has failed", () => {
    const transfer = createVerifiedDipoleTransfer(createDefaultDipoleModel());
    expect(() => useEditorStore.getState().applyModelTransfer({ ...transfer, parity: { ...transfer.parity, semanticMatch: false } })).toThrow("non-equivalent");
    expect(useEditorStore.getState().wires).toEqual([expect.objectContaining(base)]);
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
    expect(useEditorStore.getState().excitations).toEqual([expect.objectContaining(
      { wire_tag: 1, segment: 7, voltage_real: 0.75, voltage_imag: -0.5 },
    )]);
  });

  it("retains the requested proportional feed position when segmentation changes", () => {
    useEditorStore.getState().setExcitationPosition(1, 0.3);
    expect(useEditorStore.getState().excitations[0]).toMatchObject({ segment: 4, position_ratio: 0.3 });
    useEditorStore.getState().updateWire(1, { segments: 21 });
    expect(useEditorStore.getState().excitations[0]).toMatchObject({ segment: 7, position_ratio: 0.3 });
  });

  it("groups a dragged feedpoint into one undoable transaction", () => {
    const store = useEditorStore.getState();
    store.beginGeometryTransaction();
    store.setExcitationPosition(1, 0.2);
    useEditorStore.getState().setExcitationPosition(1, 0.35);
    useEditorStore.getState().commitGeometryTransaction();
    expect(useEditorStore.getState().undoStack).toHaveLength(1);
    expect(useEditorStore.getState().excitations[0]?.position_ratio).toBe(0.35);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().excitations[0]).toMatchObject({ segment: 6 });
  });

  it("moves a feedpoint between polyline legs without losing its complex voltage", () => {
    const store = useEditorStore.getState();
    store.addWire({ x1: 1, y1: 0, z1: 1, x2: 3, y2: 0, z2: 1, radius: 0.0005 });
    useEditorStore.setState({ excitations: [{ wire_tag: 1, segment: 6, voltage_real: 0.75, voltage_imag: -0.5, position_ratio: 0.5 }] });
    const result = useEditorStore.getState().moveExcitationToPosition(1, 2, 0.25);
    expect(result.ok).toBe(true);
    expect(useEditorStore.getState().excitations).toEqual([expect.objectContaining({
      wire_tag: 2,
      position_ratio: 0.25,
      voltage_real: 0.75,
      voltage_imag: -0.5,
    })]);
  });

  it("creates a bonded explicit radial field at the chosen driven-wire endpoint", () => {
    const result = useEditorStore.getState().addRadialSystem(
      { wireTag: 1, endpoint: "start" },
      1,
      { representation: "elevated-explicit", count: 4, lengthM: 5, diameterM: 0.001, rotationDeg: 0, droopAngleDeg: 20, clearanceM: 0.002 },
    );
    expect(result.ok).toBe(true);
    const state = useEditorStore.getState();
    expect(state.wires).toHaveLength(5);
    expect(state.radialSystems[0]).toMatchObject({ drivenWireTag: 1, generatedWireTags: [2, 3, 4, 5], count: 4 });
    expect(state.junctions).toHaveLength(1);
    expect(state.junctions[0]!.endpoints).toHaveLength(5);
    expect(state.excitations.find((source) => source.wire_tag === 1)).toMatchObject({ segment: 1, position_ratio: 0 });
    for (const [index, radial] of state.wires.slice(1).entries()) {
      expect(radial.x1).toBe(base.x1);
      expect(radial.y1).toBe(base.y1);
      expect(radial.z1).toBe(base.z1);
      expect(Math.hypot(radial.x2 - radial.x1, radial.y2 - radial.y1, radial.z2 - radial.z1)).toBeCloseTo(5, 10);
      expect({ x: radial.x2, y: radial.y2, z: radial.z2 }).toEqual(radialEndpoint(
        { x: base.x1, y: base.y1, z: base.z1 },
        { representation: "elevated-explicit", count: 4, lengthM: 5, diameterM: 0.001, rotationDeg: 0, droopAngleDeg: 20, clearanceM: 0.002 },
        index,
      ));
    }
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().wires).toHaveLength(1);
    expect(useEditorStore.getState().radialSystems).toEqual([]);
  });

  it("raises near-surface radials visibly and regenerates the managed group", () => {
    useEditorStore.setState({ wires: [{ ...base, z1: 0, z2: 8 }] });
    const added = useEditorStore.getState().addRadialSystem(
      { wireTag: 1, endpoint: "start" }, 1,
      { representation: "near-surface-explicit", count: 8, lengthM: 4, diameterM: 0.001, rotationDeg: 0, droopAngleDeg: 0, clearanceM: 0.002 },
    );
    expect(added.ok).toBe(true);
    expect(useEditorStore.getState().wires[0]!.z1).toBeCloseTo(0.002);
    expect(useEditorStore.getState().wires.slice(1).every((wire) => wire.z1 === 0.002 && wire.z2 === 0.002)).toBe(true);
    expect(useEditorStore.getState().ground.type).toBe("average");
    expect(useEditorStore.getState().geometryGroundFlag).toBe(-1);
    const system = useEditorStore.getState().radialSystems[0]!;
    const updated = useEditorStore.getState().updateRadialSystem(system.id, { ...system, count: 12, lengthM: 6, rotationDeg: 15 });
    expect(updated.ok).toBe(true);
    expect(useEditorStore.getState().radialSystems[0]).toMatchObject({ count: 12, lengthM: 6, rotationDeg: 15 });
    expect(useEditorStore.getState().wires).toHaveLength(13);
  });

  it("resizes around the centre and rotates by compass bearing", () => {
    useEditorStore.getState().setWireLength(1, 4, "center");
    expect(useEditorStore.getState().wires[0]).toMatchObject({ x1: -1, x2: 3 });
    useEditorStore.getState().setWireDirection(1, 0, 0, "center");
    const wire = useEditorStore.getState().wires[0]!;
    expect(wire.x1).toBeCloseTo(1);
    expect(wire.x2).toBeCloseTo(1);
    expect(wire.y1).toBeCloseTo(-2);
    expect(wire.y2).toBeCloseTo(2);
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
