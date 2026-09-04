import { describe, expect, it } from "vitest";
import { createDefaultDipoleModel } from "../model";
import { createVerifiedDipoleTransfer } from "../transfer";
import { transferFingerprint } from "../../model-transfer/parity";

describe("verified dipole wire-editor transfer", () => {
  it("preserves every represented NEC input and exact segmentation", () => {
    const transfer = createVerifiedDipoleTransfer(createDefaultDipoleModel(), "2026-09-04T12:00:00.000Z");
    expect(transfer.fidelity).toBe("exact-editable");
    expect(transfer.parity.semanticMatch).toBe(true);
    expect(transfer.wires).toEqual([expect.objectContaining({ tag: 1, segments: 21, x1: -5.075, x2: 5.075, z1: 10, z2: 10, radius: 0.0005, segmentsManual: true })]);
    expect(transfer.excitations).toEqual([expect.objectContaining({ wire_tag: 1, segment: 11, position_ratio: 0.5 })]);
    expect(transfer.geometryGroundFlag).toBe(-1);
    expect(transfer.referenceImpedanceOhm).toBe(50);
    expect(transferFingerprint(transfer)).toBe(transfer.provenance.editorModelFingerprint);
    expect(transfer.provenance.sourceNecDeck).toContain("EX 0 1 11 0 1 0");
  });

  it("maps free space and real soil without substituting a different ground model", () => {
    const freeSpace = createVerifiedDipoleTransfer({ ...createDefaultDipoleModel(), ground: { kind: "free-space" } });
    expect(freeSpace.ground).toEqual({ type: "free_space" });
    expect(freeSpace.geometryGroundFlag).toBe(0);
    const real = createVerifiedDipoleTransfer({ ...createDefaultDipoleModel(), ground: { kind: "real", conductivitySPerM: 0.0123, relativePermittivity: 17 }, referenceImpedanceOhm: 75 });
    expect(real.ground).toEqual({ type: "custom", custom_conductivity: 0.0123, custom_permittivity: 17 });
    expect(real.geometryGroundFlag).toBe(-1);
    expect(real.referenceImpedanceOhm).toBe(75);
    expect(real.parity.semanticMatch).toBe(true);
  });

  it("rejects invalid source geometry instead of creating a lossy transfer", () => {
    expect(() => createVerifiedDipoleTransfer({ ...createDefaultDipoleModel(), totalLengthM: 0 })).toThrow();
  });
});
