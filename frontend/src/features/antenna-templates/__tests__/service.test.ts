import { describe, expect, it, vi } from "vitest";
import type { SimulationResult } from "../../../api/nec";
import { getTemplateDefinition } from "../definitions";
import { generateTemplateModel, initialTemplateParameters } from "../model";
import { runTemplateModel, type TemplateDeckSolver } from "../service";

function resultFixture(): SimulationResult {
  return {
    simulation_id: "template-test", engine: "fixture-nec2c", computed_in_ms: 5, total_segments: 21, cached: false, warnings: [],
    frequency_data: [{
      frequency_mhz: 14.1, impedance: { real: 65, imag: 12 }, swr_50: 1, gain_max_dbi: 6.4, gain_max_theta: 60, gain_max_phi: 90,
      front_to_back_db: null, beamwidth_e_deg: null, beamwidth_h_deg: null, efficiency_percent: null,
      pattern: { theta_start: 0, theta_step: 5, theta_count: 19, phi_start: 0, phi_step: 5, phi_count: 72, gain_dbi: Array.from({ length: 19 }, () => Array(72).fill(1)) },
      currents: null,
    }],
  };
}

describe("template solver service", () => {
  it("passes the shared adapter's exact deck and validates the result", async () => {
    const definition = getTemplateDefinition("horizontal-dipole");
    const model = generateTemplateModel(definition, initialTemplateParameters(definition), { kind: "perfect" }, false).model;
    let deck = "";
    const solver: TemplateDeckSolver = vi.fn(async (request) => { deck = request.deck; return resultFixture(); });
    const result = await runTemplateModel(model, definition, { solver });
    expect(solver).toHaveBeenCalledOnce();
    expect(result.generatedNec).toBe(deck);
    expect(result.resistanceOhm).toBe(65);
    expect(result.reactanceOhm).toBe(12);
    expect(result.swr50).toBeGreaterThan(1);
    expect(result.takeOffAngleDeg).toBe(30);
  });

  it("rejects missing pattern output", async () => {
    const definition = getTemplateDefinition("square-loop");
    const model = generateTemplateModel(definition, initialTemplateParameters(definition), { kind: "perfect" }, false).model;
    const malformed = resultFixture();
    malformed.frequency_data[0]!.pattern = null;
    await expect(runTemplateModel(model, definition, { solver: async () => malformed })).rejects.toThrow("radiation pattern");
  });
});
