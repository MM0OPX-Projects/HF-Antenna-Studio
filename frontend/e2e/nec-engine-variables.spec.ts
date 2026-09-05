import { expect, test, type Page } from "@playwright/test";
import { dipoleTemplate } from "../src/templates/dipole";
import { getDefaultParams, type GroundConfig } from "../src/templates/types";
import type { SimulateAdvancedRequest } from "../src/engine/types";
import type { ConductorMaterial } from "../src/engine/conductor";

function dipoleRequest(ground: GroundConfig, patternStep = 10, frequencyMhz = 14.1): SimulateAdvancedRequest {
  const params = { ...getDefaultParams(dipoleTemplate), frequency: frequencyMhz };
  const wires = dipoleTemplate.generateGeometry(params);
  const raw = dipoleTemplate.generateExcitation(params, wires);
  return { wires, excitations: Array.isArray(raw) ? raw : [raw], ground, frequency: { start_mhz: frequencyMhz, stop_mhz: frequencyMhz, steps: 1 }, compute_currents: true, compute_pattern: true, pattern_step: patternStep };
}

async function solve(page: Page, request: SimulateAdvancedRequest, conductor?: ConductorMaterial) {
  await page.goto("/");
  return page.evaluate(async ({ solverRequest, material }) => {
    const engineModule = await import(/* @vite-ignore */ "/src/engine/wasm/index.ts");
    if (material) {
      const storeModule = await import(/* @vite-ignore */ "/src/stores/uiStore.ts");
      storeModule.useUIStore.getState().setConductor(material);
    }
    return new engineModule.WasmEngine().simulateAdvanced(solverRequest);
  }, { solverRequest: request, material: conductor });
}

const grounds: Array<[string, GroundConfig]> = [
  ["free space", { type: "free_space" }], ["perfect", { type: "perfect" }],
  ["salt water", { type: "salt_water" }], ["fresh water", { type: "fresh_water" }],
  ["pastoral", { type: "pastoral" }], ["average", { type: "average" }],
  ["rocky", { type: "rocky" }], ["city", { type: "city" }], ["dry sandy", { type: "dry_sandy" }],
  ["custom", { type: "custom", custom_permittivity: 9.5, custom_conductivity: 0.003 }],
];

for (const [name, ground] of grounds) test(`real NEC ground: ${name}`, async ({ page }) => {
  const result = await solve(page, dipoleRequest(ground));
  expect(result.frequency_data).toHaveLength(1);
  expect(Number.isFinite(result.frequency_data[0]!.impedance.real)).toBe(true);
});

for (const step of [1, 2, 5, 10]) test(`real NEC pattern step: ${step} degrees`, async ({ page }) => {
  test.setTimeout(180_000);
  const result = await solve(page, dipoleRequest({ type: "average" }, step));
  const pattern = result.frequency_data[0]!.pattern!;
  expect(pattern.theta_step).toBe(step);
  expect(pattern.phi_step).toBe(step);
  expect(pattern.phi_count).toBe(360 / step);
});

for (const frequencyMhz of [0.1, 0.5, 1.8, 3.5, 7.1, 14.1, 28.5, 54, 144, 432, 2000]) {
  test(`real NEC supported-frequency sample: ${frequencyMhz} MHz`, async ({ page }) => {
    const request = dipoleRequest({ type: "free_space" }, 10, frequencyMhz);
    // Keep the audit geometry electrically equivalent across the complete
    // engine range instead of asking one fixed physical wire to span decades.
    const wavelengthM = 300 / frequencyMhz;
    const params = {
      ...getDefaultParams(dipoleTemplate),
      frequency: frequencyMhz,
      height: wavelengthM / 4,
    };
    request.wires = dipoleTemplate.generateGeometry(params);
    const raw = dipoleTemplate.generateExcitation(params, request.wires);
    request.excitations = Array.isArray(raw) ? raw : [raw];
    const result = await solve(page, request);
    expect(result.frequency_data).toHaveLength(1);
    expect(result.frequency_data[0]!.frequency_mhz).toBeCloseTo(frequencyMhz, 6);
    expect(Number.isFinite(result.frequency_data[0]!.impedance.real)).toBe(true);
    expect(Number.isFinite(result.frequency_data[0]!.impedance.imag)).toBe(true);
  });
}

const conductors: ConductorMaterial[] = [
  { id: "perfect", conductivitySPerM: null }, { id: "copper", conductivitySPerM: 5.8e7 },
  { id: "aluminum", conductivitySPerM: 3.54e7 }, { id: "steel", conductivitySPerM: 1.03e7 },
  { id: "stainless_steel", conductivitySPerM: 1.1e6 }, { id: "custom", conductivitySPerM: 2.5e7 },
];
for (const conductor of conductors) test(`real NEC conductor: ${conductor.id}`, async ({ page }) => {
  const result = await solve(page, dipoleRequest({ type: "average" }), conductor);
  expect(Number.isFinite(result.frequency_data[0]!.impedance.real)).toBe(true);
  expect(result.frequency_data[0]!.currents?.length ?? 0).toBeGreaterThan(0);
});

test("real NEC 101-point impedance sweep without pattern", async ({ page }) => {
  const request = dipoleRequest({ type: "average" });
  request.frequency = { start_mhz: 13.5, stop_mhz: 14.5, steps: 101 };
  request.compute_pattern = false;
  request.compute_currents = false;
  const result = await solve(page, request);
  expect(result.frequency_data).toHaveLength(101);
  expect(result.frequency_data.every((point) => Number.isFinite(point.impedance.real) && Number.isFinite(point.impedance.imag))).toBe(true);
});
