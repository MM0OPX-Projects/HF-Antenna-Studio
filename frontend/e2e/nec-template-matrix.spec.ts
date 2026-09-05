import { expect, test } from "@playwright/test";
import { templates } from "../src/templates";
import { getDefaultParams } from "../src/templates/types";
import type { SimulateAdvancedRequest } from "../src/engine/types";

for (const template of templates) {
  test(`real NEC default matrix: ${template.id}`, async ({ page }) => {
    test.setTimeout(180_000);
    const params = getDefaultParams(template);
    const wires = template.generateGeometry(params);
    const rawExcitations = template.generateExcitation(params, wires);
    const range = template.defaultFrequencyRange(params);
    const frequencyMhz = params.frequency ?? params.freq ?? (range.start_mhz + range.stop_mhz) / 2;
    const request: SimulateAdvancedRequest = {
      wires,
      excitations: Array.isArray(rawExcitations) ? rawExcitations : [rawExcitations],
      ground: template.defaultGround,
      frequency: { start_mhz: frequencyMhz, stop_mhz: frequencyMhz, steps: 1 },
      loads: template.generateLoads?.(params, wires),
      transmission_lines: template.generateTransmissionLines?.(params, wires),
      compute_currents: true,
      compute_pattern: true,
      pattern_step: 10,
      comment: `NEC audit default: ${template.id}`,
    };

    await page.goto("/");
    const result = await page.evaluate(async (solverRequest) => {
      // Loaded through the running Vite application so this exercises the real
      // browser worker and bundled nec2c/Wasm binary rather than a mock.
      const module = await import(/* @vite-ignore */ "/src/engine/wasm/index.ts");
      const engine = new module.WasmEngine();
      return engine.simulateAdvanced(solverRequest);
    }, request);

    expect(result.engine).toContain("wasm");
    expect(result.frequency_data).toHaveLength(1);
    expect(Number.isFinite(result.frequency_data[0]!.impedance.real)).toBe(true);
    expect(Number.isFinite(result.frequency_data[0]!.impedance.imag)).toBe(true);
    expect(result.frequency_data[0]!.pattern).not.toBeNull();
    expect(result.frequency_data[0]!.currents?.length ?? 0).toBeGreaterThan(0);
  });
}
