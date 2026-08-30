import { describe, expect, it } from "vitest";
import { generatePhasedArray } from "../../phased-arrays/model";
import { generateVerticalModel } from "../../vertical-antennas/model";
import { createDefaultRadialWorkflowSettings, createWorkflowPhasedModel, createWorkflowVerticalModel, radialSettingsForGround, validateRadialWorkflowSettings } from "../workflow";

const realGround = { kind: "sommerfeld-norton", conductivitySPerM: 0.005, relativePermittivity: 13 } as const;

describe("downstream radial workflow contract", () => {
  it("uses 1 mm radial wire for new downstream workflows", () => {
    expect(createDefaultRadialWorkflowSettings().radialDiameterM).toBe(0.001);
  });

  it("creates the verified near-surface single-vertical representation", () => {
    const settings = { ...createDefaultRadialWorkflowSettings(), verticalMode: "near-surface" as const };
    const model = createWorkflowVerticalModel(14_100_000, realGround, settings, 16, 50);
    expect(model).toMatchObject({ configuration: "ground-mounted-explicit-radials", baseHeightM: 0.01, radials: { count: 16, lengthM: expect.closeTo(299_792_458 / 14_100_000 * 0.25), droopAngleRad: 0 }, ground: realGround });
    expect(generateVerticalModel(model).issues.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("creates a shared phased field and preserves explicit topology", () => {
    const settings = { ...createDefaultRadialWorkflowSettings(), phasedMode: "near-surface-shared" as const };
    const model = createWorkflowPhasedModel(14_100_000, realGround, settings);
    const generated = generatePhasedArray(model);
    expect(model.radials).toMatchObject({ representation: "near-surface-explicit-wires", topology: "shared-bonded-network", count: 16 });
    expect(generated.wires.filter((wire) => wire.family === "radial-shared")).toHaveLength(16);
    expect(generated.issues.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("rejects incompatible ground identities and provides explicit compatible presets", () => {
    const settings = { ...createDefaultRadialWorkflowSettings(), verticalMode: "near-surface" as const, phasedMode: "near-surface-shared" as const };
    expect(validateRadialWorkflowSettings(settings, new Set(["vertical", "phased-array"]), { kind: "perfect" })).toHaveLength(2);
    const perfect = radialSettingsForGround(settings, "perfect");
    expect(perfect).toMatchObject({ verticalMode: "elevated-independent", phasedMode: "perfect-ground-image" });
    expect(radialSettingsForGround(perfect, "sommerfeld-norton").phasedMode).toBe("near-surface-shared");
  });
});
