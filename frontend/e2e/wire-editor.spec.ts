import { expect, test, type Page } from "@playwright/test";

const DIPOLE = [
  "CM wire editor supported dipole",
  "CE",
  "GW 1 21 -5.32 0 10 5.32 0 10 0.001",
  "GE 0",
  "GN -1",
  "LD 4 1 1 1 0 0 0",
  "EX 0 1 11 0 1 0",
  "FR 0 3 0 0 14.0 0.1",
  "RP 0 37 72 1000 -90 0 5 5",
  "EN",
  "",
].join("\r\n");

const UNSUPPORTED_ARC = "CM unsupported arc\r\nCE\r\nGA 9 21 5 0 180 .001\r\nGE 0\r\nGN -1\r\nFR 0 1 0 0 14.1 0\r\nEN\r\n";

async function dismissChangelog(page: Page) {
  const button = page.getByRole("button", { name: "Got it" });
  if (await button.isVisible().catch(() => false)) await button.click();
}

async function openImport(page: Page) {
  await page.locator("aside select").first().selectOption("tools");
  await page.getByRole("button", { name: "Import / Export" }).click();
}

test("newly drawn editor wires default to 1 mm diameter", async ({ page }) => {
  await page.goto("/editor");
  await dismissChangelog(page);
  await page.locator("aside select").first().selectOption("wires");
  await page.locator("aside").getByTitle("Add new wire").first().click();
  await page.locator("aside").getByRole("row", { name: "Wire 1" }).first().click();
  await expect(page.locator('aside [data-testid="wire-properties-diameter"]:visible')).toContainText("1.000");
  await expect(page.locator('aside [data-testid="wire-properties-diameter"]:visible')).toContainText("mm");
});

test("supported NEC import reaches the real solver, results, and 3D editor without console errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/editor");
  await dismissChangelog(page);
  await openImport(page);
  await page.locator('input[type="file"][accept*=".nec"]').setInputFiles({
    name: "supported-dipole.nec",
    mimeType: "text/plain",
    buffer: Buffer.from(DIPOLE),
  });

  const report = page.getByTestId("nec-import-report");
  await expect(report).toContainText("structured");
  await expect(report).toContainText("represented: 6");
  await expect(report).toContainText("The visible model still matches");
  await page.getByTestId("editor-view-3d").click();
  await expect(page.locator("canvas").first()).toBeVisible();

  await page.locator("aside select").first().selectOption("settings");
  await expect(page.locator("aside").getByLabel("Geometry/ground connection (NEC GE)")).toHaveValue("0");

  await page.locator("aside select").first().selectOption("wires");
  const objectList = page.locator("aside").getByTestId("antenna-object-list");
  await expect(objectList).toBeVisible();
  await objectList.locator("tbody tr").first().click();
  await expect(page.locator("aside").getByTestId("wire-load-editor")).toContainText("Fixed impedance");

  await page.locator("aside select").first().selectOption("tools");
  await expect(page.locator("aside").getByTestId("wire-transform-panel")).toBeVisible();
  await page.locator("aside").getByRole("button", { name: "Rotate selection" }).click();
  await page.getByRole("button", { name: /Undo/ }).first().click();

  await page.getByRole("button", { name: "Run Simulation" }).click();
  await expect(page.locator("aside").getByTestId("wire-editor-simulation-status")).toHaveText("3 frequency points calculated", { timeout: 120_000 });
  await expect(page.getByTestId("pattern-scale-control")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Pattern on" })).toBeVisible();
  const analysis = page.getByTestId("wire-editor-analysis");
  await analysis.scrollIntoViewIfNeeded();
  const azimuthCard = analysis.getByTestId("results-radiation-cuts-azimuth");
  const elevationCard = analysis.getByTestId("results-radiation-cuts-elevation");
  await expect(azimuthCard).toBeVisible();
  await expect(elevationCard).toBeVisible();
  const azimuthBox = await azimuthCard.boundingBox();
  const elevationBox = await elevationCard.boundingBox();
  expect(azimuthBox).not.toBeNull();
  expect(elevationBox).not.toBeNull();
  expect(Math.abs(azimuthBox!.y - elevationBox!.y)).toBeLessThan(8);
  expect(await azimuthCard.getByTestId("azimuth-polar-plot").evaluate((element) => element.getBoundingClientRect().width)).toBeLessThanOrEqual(501);
  const cutElevationBox = await azimuthCard.getByTestId("azimuth-cut-elevation-control").boundingBox();
  const bearingInspectorBox = await azimuthCard.getByTestId("azimuth-bearing-inspector").boundingBox();
  expect(cutElevationBox).not.toBeNull();
  expect(bearingInspectorBox).not.toBeNull();
  expect(Math.abs(cutElevationBox!.y - bearingInspectorBox!.y)).toBeLessThan(8);
  await azimuthCard.scrollIntoViewIfNeeded();
  await expect(azimuthCard.getByTestId("azimuth-polar-plot")).toBeInViewport();
  await expect(azimuthCard.getByTestId("azimuth-bearing-inspector-reading-current")).toBeInViewport();
  await expect(analysis.getByText("Impedance", { exact: false }).first()).toBeVisible();
  await expect(analysis.getByText("SWR", { exact: false }).first()).toBeVisible();

  await analysis.getByRole("tab", { name: "Gain", exact: true }).click();
  const gainSummary = analysis.getByTestId("gain-performance-summary");
  await expect(gainSummary).toBeVisible();
  const gainSummaryBox = await gainSummary.boundingBox();
  const analysisBox = await analysis.boundingBox();
  expect(gainSummaryBox).not.toBeNull();
  expect(analysisBox).not.toBeNull();
  expect(gainSummaryBox!.width).toBeLessThanOrEqual(520);
  expect(gainSummaryBox!.x - analysisBox!.x).toBeLessThan(40);

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("desktop editor can jump to full-width analysis and back", async ({ page }) => {
  await page.goto("/editor");
  await dismissChangelog(page);
  const shell = page.getByTestId("wire-editor-page");
  const twoDimensionalCanvas = page.getByTestId("wire-editor-2d-canvas");
  const twoDimensionalBox = await twoDimensionalCanvas.boundingBox();
  expect(twoDimensionalBox).not.toBeNull();
  await page.mouse.move(twoDimensionalBox!.x + twoDimensionalBox!.width / 2, twoDimensionalBox!.y + twoDimensionalBox!.height / 2);
  const initialPagePosition = await shell.evaluate((element) => element.scrollTop);
  await page.mouse.wheel(0, 500);
  await expect.poll(() => shell.evaluate((element) => element.scrollTop)).toBe(initialPagePosition);

  await page.getByTestId("editor-view-3d").click();
  const threeDimensionalCanvas = page.locator("canvas").first();
  const threeDimensionalBox = await threeDimensionalCanvas.boundingBox();
  expect(threeDimensionalBox).not.toBeNull();
  await page.mouse.move(threeDimensionalBox!.x + threeDimensionalBox!.width / 2, threeDimensionalBox!.y + threeDimensionalBox!.height / 2);
  await page.mouse.wheel(0, 500);
  await expect.poll(() => shell.evaluate((element) => element.scrollTop)).toBe(initialPagePosition);
  await page.getByTestId("editor-view-2d").click();

  await page.getByRole("button", { name: "Show analysis and calculated results" }).click();
  await expect.poll(() => shell.evaluate((element) => element.scrollTop)).toBeGreaterThan(100);
  await expect(page.getByRole("heading", { name: "Analysis and calculated results" })).toBeInViewport();
  await page.getByRole("button", { name: "Back to editor" }).click();
  await expect.poll(() => shell.evaluate((element) => element.scrollTop)).toBeLessThan(100);
  await expect(page.getByTestId("wire-editor-2d")).toBeInViewport();
});

test("fixed 2D editor supports plane changes, right-click cancellation, drawing, and 3D review", async ({ page }) => {
  await page.goto("/editor");
  await dismissChangelog(page);

  await expect(page.getByTestId("wire-editor-2d")).toBeVisible();
  await expect(page.getByTestId("drawing-origin")).toContainText("ORIGIN 0,0");
  await page.getByRole("button", { name: "Side Y/Z" }).click();
  await expect(page.getByTestId("wire-editor-2d-canvas")).toHaveAttribute("aria-label", /Side Y\/Z/);
  await page.getByRole("button", { name: "Front X/Z" }).click();

  await page.getByTitle("Add wire mode (A)").click();
  const canvas = page.getByTestId("wire-editor-2d-canvas");
  await expect(canvas).toHaveCSS("cursor", "crosshair");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const first = { x: box!.x + box!.width * 0.38, y: box!.y + box!.height * 0.58 };
  const second = { x: box!.x + box!.width * 0.62, y: box!.y + box!.height * 0.42 };

  await page.mouse.click(first.x, first.y);
  await expect(page.getByTestId("exact-wire-entry")).toBeVisible();
  await page.mouse.click(second.x, second.y, { button: "right" });
  await expect(page.getByTestId("exact-wire-entry")).toBeHidden();
  await expect(page.getByRole("heading", { name: /Antenna objects \(0 wires\)/i })).toBeVisible();

  await page.mouse.click(first.x, first.y);
  await page.mouse.click(second.x, second.y);
  await page.mouse.click(second.x + 20, second.y + 20, { button: "right" });
  await expect(page.getByRole("heading", { name: /Antenna objects \(1 wire\)/i })).toBeVisible();
  await expect(page.locator('g[data-wire-tag="1"] circle').first()).toHaveAttribute("r", "4");
  await expect(page.getByTestId("wire-body-hit-1")).toHaveCSS("cursor", "crosshair");

  await page.getByTestId("editor-view-3d").click();
  await expect(page.getByTestId("wire-editor-3d")).toBeVisible();
  await expect(page.locator("canvas").first()).toHaveCSS("cursor", "crosshair");
  await page.getByTestId("editor-view-2d").click();
  await expect(page.getByTestId("wire-editor-2d")).toBeVisible();
});

test("exact wire entry locks CAD length and angle with units in every drawing plane", async ({ page }) => {
  await page.goto("/editor");
  await dismissChangelog(page);
  await page.getByTitle("Add wire mode (A)").click();
  const canvas = page.getByTestId("wire-editor-2d-canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  const planes = [
    { name: "Front X/Z", length: 2.5, angle: 30 },
    { name: "Side Y/Z", length: 3.5, angle: 60 },
    { name: "Top X/Y", length: 4.5, angle: -25 },
  ];
  for (let index = 0; index < planes.length; index += 1) {
    const testPlane = planes[index]!;
    await page.getByRole("button", { name: testPlane.name }).click();
    await page.mouse.click(box!.x + box!.width * 0.42, box!.y + box!.height * 0.55);
    await page.mouse.move(box!.x + box!.width * 0.65, box!.y + box!.height * 0.38);
    await page.keyboard.press("l");
    await expect(page.getByTestId("exact-wire-length")).toBeFocused();
    if (index === 0) {
      await page.keyboard.press("Control+A");
      await page.keyboard.press("Backspace");
      await expect(page.getByTestId("exact-wire-length")).toHaveValue("");
      await page.keyboard.type(String(testPlane.length));
      for (let tab = 0; tab < 5; tab += 1) await page.keyboard.press("Tab");
      await expect(page.getByTestId("exact-wire-length")).toBeFocused();
    }
    await page.getByTestId("exact-wire-length").fill(String(testPlane.length));
    await page.getByTestId("exact-wire-angle").fill(String(testPlane.angle));
    const preview = page.getByTestId("exact-wire-preview");
    await expect.poll(async () => Number(await preview.getAttribute("data-length-m"))).toBeCloseTo(testPlane.length, 4);
    await expect.poll(async () => Number(await preview.getAttribute("data-angle-deg"))).toBeCloseTo(testPlane.angle, 4);
    await page.getByTestId("exact-wire-angle").press("Enter");
    await expect(page.getByRole("heading", { name: new RegExp(`Antenna objects \\(${index + 1} wires?\\)`, "i") })).toBeVisible();
  }

  await page.getByRole("button", { name: "Front X/Z" }).click();
  await page.mouse.click(box!.x + box!.width * 0.38, box!.y + box!.height * 0.62);
  await page.mouse.move(box!.x + box!.width * 0.58, box!.y + box!.height * 0.50);
  await page.getByTestId("exact-wire-unit").selectOption("ft");
  await page.getByTestId("exact-wire-length").fill("10");
  await expect.poll(async () => Number(await page.getByTestId("exact-wire-preview").getAttribute("data-length-m"))).toBeCloseTo(3.048, 5);

  const panel = page.getByTestId("exact-wire-entry");
  const before = await panel.boundingBox();
  expect(before).not.toBeNull();
  const dragHandle = panel.getByTitle("Drag to move this precision panel");
  const handleBox = await dragHandle.boundingBox();
  expect(handleBox).not.toBeNull();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2 + 100, handleBox!.y + handleBox!.height / 2 - 100, { steps: 4 });
  await page.mouse.up();
  const after = await panel.boundingBox();
  expect(after).not.toBeNull();
  expect(Math.abs(after!.x - before!.x) + Math.abs(after!.y - before!.y)).toBeGreaterThan(20);
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});

test("double-clicking a selected wire opens an undoable precision editor", async ({ page }) => {
  await page.goto("/editor");
  await dismissChangelog(page);
  await page.getByTitle("Add wire mode (A)").click();
  const canvas = page.getByTestId("wire-editor-2d-canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width * 0.35, box!.y + box!.height * 0.55);
  await page.mouse.move(box!.x + box!.width * 0.65, box!.y + box!.height * 0.55);
  await page.keyboard.press("l");
  await page.getByTestId("exact-wire-length").fill("5");
  await page.getByTestId("exact-wire-angle").fill("0");
  await page.getByTestId("exact-wire-angle").press("Enter");
  await page.getByTitle("Select mode (V)").click();

  const wireBody = page.getByTestId("wire-body-hit-1");
  const doubleClickWire = async () => {
    const wireBox = await wireBody.boundingBox();
    expect(wireBox).not.toBeNull();
    await page.mouse.dblclick(wireBox!.x + wireBox!.width / 2, wireBox!.y + wireBox!.height / 2);
  };
  await doubleClickWire();
  const editor = page.getByTestId("existing-wire-precision-editor");
  await expect(editor).toBeVisible();
  await expect(editor.getByTestId("existing-wire-length")).toHaveValue("5");
  await editor.getByTestId("existing-wire-length").press("Control+A");
  await editor.getByTestId("existing-wire-length").press("Delete");
  await expect(editor.getByTestId("existing-wire-length")).toHaveValue("");
  await editor.getByTestId("existing-wire-length").fill("8");
  await editor.getByTestId("existing-wire-angle").press("Control+A");
  await editor.getByTestId("existing-wire-angle").press("Backspace");
  await expect(editor.getByTestId("existing-wire-angle")).toHaveValue("");
  await editor.getByTestId("existing-wire-angle").fill("45");
  await editor.getByRole("button", { name: /Apply/ }).click();
  await expect(editor).toBeHidden();

  await doubleClickWire();
  await expect(editor.getByTestId("existing-wire-length")).toHaveValue("8");
  await expect(editor.getByTestId("existing-wire-angle")).toHaveValue("45");
  await editor.getByRole("button", { name: "Cancel", exact: true }).first().click();
  await page.getByRole("button", { name: "Undo last Wire Editor action" }).click();
  await doubleClickWire();
  await expect(editor.getByTestId("existing-wire-length")).toHaveValue("5");
  await expect(editor.getByTestId("existing-wire-angle")).toHaveValue("0");
  await page.keyboard.press("Escape");
  await expect(editor).toBeHidden();
});

test("2D body dragging moves a polyline leg, deforms bonded neighbours, and is undoable", async ({ page }) => {
  await page.goto("/editor");
  await dismissChangelog(page);
  await page.getByTitle("Add wire mode (A)").click();
  const canvas = page.getByTestId("wire-editor-2d-canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const points = [
    { x: box!.x + box!.width * 0.28, y: box!.y + box!.height * 0.58 },
    { x: box!.x + box!.width * 0.42, y: box!.y + box!.height * 0.48 },
    { x: box!.x + box!.width * 0.58, y: box!.y + box!.height * 0.48 },
    { x: box!.x + box!.width * 0.72, y: box!.y + box!.height * 0.58 },
  ];
  for (const point of points) await page.mouse.click(point.x, point.y);
  await page.mouse.click(points[3]!.x + 12, points[3]!.y + 12, { button: "right" });
  await page.getByTitle("Select mode (V)").click();

  const body = (tag: number) => page.getByTestId(`wire-body-hit-${tag}`);
  const coordinate = async (tag: number, name: "x1" | "y1" | "x2" | "y2") => Number(await body(tag).getAttribute(name));
  const original = { x1: await coordinate(2, "x1"), y1: await coordinate(2, "y1"), x2: await coordinate(2, "x2"), y2: await coordinate(2, "y2") };
  const middle = await body(2).boundingBox();
  expect(middle).not.toBeNull();
  await page.mouse.move(middle!.x + middle!.width / 2, middle!.y + middle!.height / 2);
  await page.mouse.down();
  await page.mouse.move(middle!.x + middle!.width / 2 + 44, middle!.y + middle!.height / 2 - 36, { steps: 5 });
  await page.mouse.up();

  expect(await coordinate(2, "x1")).not.toBeCloseTo(original.x1, 3);
  expect(await coordinate(2, "y1")).not.toBeCloseTo(original.y1, 3);
  expect(await coordinate(1, "x2")).toBeCloseTo(await coordinate(2, "x1"), 3);
  expect(await coordinate(1, "y2")).toBeCloseTo(await coordinate(2, "y1"), 3);
  expect(await coordinate(3, "x1")).toBeCloseTo(await coordinate(2, "x2"), 3);
  expect(await coordinate(3, "y1")).toBeCloseTo(await coordinate(2, "y2"), 3);

  const prominentUndo = page.getByRole("button", { name: "Undo last Wire Editor action" });
  await expect(prominentUndo).toBeEnabled();
  await prominentUndo.click();
  expect(await coordinate(2, "x1")).toBeCloseTo(original.x1, 3);
  expect(await coordinate(2, "y1")).toBeCloseTo(original.y1, 3);

  const restored = await body(2).boundingBox();
  await page.mouse.move(restored!.x + restored!.width / 2, restored!.y + restored!.height / 2);
  await page.mouse.down();
  await page.mouse.move(restored!.x + restored!.width / 2 + 30, restored!.y + restored!.height / 2 + 30, { steps: 3 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(await coordinate(2, "x1")).toBeCloseTo(original.x1, 3);
  expect(await coordinate(2, "y1")).toBeCloseTo(original.y1, 3);
});

test("2D endpoint dragging anchors the opposite end and supports Undo and Escape", async ({ page }) => {
  await page.goto("/editor");
  await dismissChangelog(page);
  await page.getByTitle("Add wire mode (A)").click();
  const canvas = page.getByTestId("wire-editor-2d-canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const start = { x: box!.x + box!.width * 0.38, y: box!.y + box!.height * 0.55 };
  const end = { x: box!.x + box!.width * 0.62, y: box!.y + box!.height * 0.45 };
  await page.mouse.click(start.x, start.y);
  await page.mouse.click(end.x, end.y);
  await page.mouse.click(end.x + 15, end.y + 15, { button: "right" });
  await page.getByTitle("Select mode (V)").click();

  const startHandle = page.getByTestId("wire-endpoint-1-start");
  const endHandle = page.getByTestId("wire-endpoint-1-end");
  const coordinate = async (handle: typeof startHandle, name: "cx" | "cy") => Number(await handle.getAttribute(name));
  const originalStart = { x: await coordinate(startHandle, "cx"), y: await coordinate(startHandle, "cy") };
  const originalEnd = { x: await coordinate(endHandle, "cx"), y: await coordinate(endHandle, "cy") };
  const startBox = await startHandle.boundingBox();
  await page.mouse.move(startBox!.x + startBox!.width / 2, startBox!.y + startBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(startBox!.x + startBox!.width / 2 - 45, startBox!.y + startBox!.height / 2 - 32, { steps: 5 });
  await page.mouse.up();
  expect(await coordinate(startHandle, "cx")).not.toBeCloseTo(originalStart.x, 3);
  expect(await coordinate(startHandle, "cy")).not.toBeCloseTo(originalStart.y, 3);
  expect(await coordinate(endHandle, "cx")).toBeCloseTo(originalEnd.x, 3);
  expect(await coordinate(endHandle, "cy")).toBeCloseTo(originalEnd.y, 3);

  await page.getByRole("button", { name: "Undo last Wire Editor action" }).click();
  expect(await coordinate(startHandle, "cx")).toBeCloseTo(originalStart.x, 3);
  expect(await coordinate(startHandle, "cy")).toBeCloseTo(originalStart.y, 3);

  const restoredStartBox = await startHandle.boundingBox();
  await page.mouse.move(restoredStartBox!.x + restoredStartBox!.width / 2, restoredStartBox!.y + restoredStartBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(restoredStartBox!.x + restoredStartBox!.width / 2 + 35, restoredStartBox!.y + restoredStartBox!.height / 2 + 25, { steps: 3 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(await coordinate(startHandle, "cx")).toBeCloseTo(originalStart.x, 3);
  expect(await coordinate(startHandle, "cy")).toBeCloseTo(originalStart.y, 3);
});

test("wire clicks support Ctrl multi-selection and Delete or Backspace removal", async ({ page }) => {
  await page.goto("/editor");
  await dismissChangelog(page);
  await page.getByTitle("Add wire mode (A)").click();
  const canvas = page.getByTestId("wire-editor-2d-canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const points = [
    { x: box!.x + box!.width * 0.25, y: box!.y + box!.height * 0.65 },
    { x: box!.x + box!.width * 0.42, y: box!.y + box!.height * 0.48 },
    { x: box!.x + box!.width * 0.60, y: box!.y + box!.height * 0.48 },
    { x: box!.x + box!.width * 0.75, y: box!.y + box!.height * 0.32 },
  ];
  for (const point of points) await page.mouse.click(point.x, point.y);
  await page.mouse.click(points[3]!.x + 12, points[3]!.y + 12, { button: "right" });
  await expect(page.getByRole("heading", { name: /Antenna objects \(3 wires\)/i })).toBeVisible();
  await page.getByTitle("Select mode (V)").click();

  const wireLine = (tag: number) => canvas.locator(`[data-wire-tag="${tag}"] > line`).first();
  const wireRow = (tag: number) => page.locator("aside").getByRole("row", { name: `Wire ${tag}` }).first();
  await wireLine(1).click({ force: true });
  await expect(wireRow(1)).toHaveAttribute("aria-selected", "true");
  await wireLine(2).click({ force: true, modifiers: ["Control"] });
  await expect(wireRow(1)).toHaveAttribute("aria-selected", "true");
  await expect(wireRow(2)).toHaveAttribute("aria-selected", "true");

  // Ctrl-click is a true toggle, so it can remove and then restore a member.
  await wireLine(1).click({ force: true, modifiers: ["Control"] });
  await expect(wireRow(1)).toHaveAttribute("aria-selected", "false");
  await wireLine(1).click({ force: true, modifiers: ["Control"] });
  await page.keyboard.press("Delete");
  await expect(page.getByRole("heading", { name: /Antenna objects \(1 wire\)/i })).toBeVisible();

  await page.keyboard.press("Control+z");
  await expect(page.getByRole("heading", { name: /Antenna objects \(3 wires\)/i })).toBeVisible();
  await wireLine(2).click({ force: true });
  await wireLine(3).click({ force: true, modifiers: ["Control"] });
  await page.keyboard.press("Backspace");
  await expect(page.getByRole("heading", { name: /Antenna objects \(1 wire\)/i })).toBeVisible();
});

test("2D feedpoint tool targets a polyline leg and moves one source along the complete path", async ({ page }) => {
  await page.goto("/editor");
  await dismissChangelog(page);
  await page.getByTitle("Add wire mode (A)").click();
  const canvas = page.getByTestId("wire-editor-2d-canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const points = [
    { x: box!.x + box!.width * 0.25, y: box!.y + box!.height * 0.62 },
    { x: box!.x + box!.width * 0.42, y: box!.y + box!.height * 0.45 },
    { x: box!.x + box!.width * 0.60, y: box!.y + box!.height * 0.45 },
    { x: box!.x + box!.width * 0.75, y: box!.y + box!.height * 0.30 },
  ];
  for (const point of points) await page.mouse.click(point.x, point.y);
  await page.mouse.click(points[3]!.x + 12, points[3]!.y + 12, { button: "right" });
  await expect(page.getByRole("heading", { name: /Antenna objects \(3 wires\)/i })).toBeVisible();

  await page.getByTestId("place-feedpoint-2d").click();
  const middle = { x: (points[1]!.x + points[2]!.x) / 2, y: (points[1]!.y + points[2]!.y) / 2 };
  await page.mouse.move(middle.x - 15, middle.y);
  await page.mouse.down();
  await page.mouse.move(middle.x + 15, middle.y, { steps: 4 });
  await page.mouse.up();

  const inspector = page.locator('aside [data-testid="feedpoint-inspector"]:visible');
  await expect(inspector).toContainText("Source on NEC wire 2");
  const polylineControls = page.locator('aside [data-testid="polyline-feedpoint-controls"]:visible');
  await expect(polylineControls).toContainText("3 legs");
  await polylineControls.locator("select").selectOption("3");
  await expect(page.locator('aside [data-testid="antenna-source-tree"]:visible')).toContainText("wire 3");
  await expect(page.locator('aside [data-testid="antenna-source-tree"]:visible').getByText(/Source /)).toHaveCount(1);

  const pathSlider = page.locator('aside [data-testid="polyline-feed-position-slider"]:visible');
  await pathSlider.focus();
  await pathSlider.press("Home");
  await expect(page.locator('aside [data-testid="antenna-source-tree"]:visible')).toContainText("wire 1");

  // Endpoint markers must accept the feedpoint tool. The request remains 0%,
  // while NEC safely excites the centre of the first segment.
  await page.getByTestId("place-feedpoint-2d").click();
  await page.mouse.click(points[0]!.x, points[0]!.y);
  await expect(page.locator('aside [data-testid="antenna-source-tree"]:visible')).toContainText("0.0% requested");
  await expect(inspector.locator('[data-testid="feed-position-slider"]')).toBeVisible();
  await expect(inspector).toContainText("From start");
  await expect(inspector).toContainText(/first or last segment/i);
});

test("wire and feedpoint inspector exposes proportional placement and drawing controls", async ({ page }) => {
  await page.goto("/editor");
  await dismissChangelog(page);
  await openImport(page);
  await page.locator('input[type="file"][accept*=".nec"]').setInputFiles({
    name: "feedpoint-inspector.nec",
    mimeType: "text/plain",
    buffer: Buffer.from(DIPOLE),
  });
  await page.locator("aside select").first().selectOption("wires");
  await page.locator("aside").getByRole("row", { name: "Wire 1" }).first().click();

  await expect(page.locator("aside").getByText("Wire and Feedpoint Inspector", { exact: true })).toBeVisible();
  await page.locator('aside [data-testid="wire-inspector-units"]:visible').selectOption("ft");
  await expect(page.locator('aside [data-testid="feedpoint-inspector"]:visible')).toContainText("Actual NEC segment centre");
  await expect(page.locator('aside [data-testid="feedpoint-inspector"]:visible')).toContainText("NEC wire 1, segment 11 of 21");

  const slider = page.locator('aside [data-testid="feed-position-slider"]:visible');
  await slider.fill("30");
  await expect(page.locator('aside [data-testid="antenna-source-tree"]:visible')).toContainText("30.0% requested");
  await expect(page.locator('aside [data-testid="antenna-source-tree"]:visible')).toContainText("wire 1, segment 7");

  const drawingControls = page.getByTestId("drawing-controls");
  await page.getByTestId("editor-view-3d").click();
  await expect(drawingControls.getByText("Continue wire chain")).toBeVisible();
  await expect(drawingControls.getByText("Snap and join endpoints")).toBeVisible();
  await expect(drawingControls.getByRole("button", { name: "Top" })).toBeVisible();
  await expect(drawingControls.getByRole("button", { name: "Front" })).toBeVisible();
  await expect(drawingControls.getByRole("button", { name: "Side" })).toBeVisible();
});

test("wire editor adds and regenerates a bonded radial system at an exact endpoint", async ({ page }) => {
  await page.goto("/editor");
  await dismissChangelog(page);
  await openImport(page);
  await page.locator('input[type="file"][accept*=".nec"]').setInputFiles({
    name: "radial-host.nec",
    mimeType: "text/plain",
    buffer: Buffer.from(DIPOLE),
  });
  await page.locator("aside select").first().selectOption("wires");
  await page.locator("aside").getByRole("row", { name: "Wire 1" }).first().click();
  const radialPanel = page.locator('aside [data-testid="radial-system-panel"]:visible');
  await expect(radialPanel).toContainText("Add at Point 1");
  await radialPanel.getByTestId("add-radials-start").click();
  await expect(page.getByRole("heading", { name: /Antenna objects \(5 wires\)/i })).toBeVisible();
  await expect(radialPanel.getByTestId("radial-system-1")).toContainText("4 NEC wires");
  await expect(page.locator('aside [data-testid="antenna-source-tree"]:visible')).toContainText("0.0% requested");

  await radialPanel.getByTestId("radial-count-slider").fill("6");
  await radialPanel.getByTestId("apply-radial-system").click();
  await expect(page.getByRole("heading", { name: /Antenna objects \(7 wires\)/i })).toBeVisible();
  await expect(radialPanel.getByTestId("radial-system-1")).toContainText("6 NEC wires");
  await expect(page.locator('aside [data-testid="radial-system-tree"]:visible')).toContainText("6 × 5.00 m");
  await expect(page.locator('[data-radial-wire="true"]')).toHaveCount(6);

  await page.getByTestId("editor-view-3d").click();
  await expect(page.getByTestId("wire-editor-3d").locator("canvas")).toBeVisible();
  const radialLegend = page.getByTestId("editor-radial-legend");
  const feedpointLegend = page.getByTestId("editor-feedpoint-legend");
  await expect(feedpointLegend).toContainText("Feedpoint source");
  await expect(feedpointLegend).toContainText("0.0% requested");
  await expect(feedpointLegend).toContainText("NEC segment 1");
  await expect(radialLegend).toContainText("Explicit NEC radial wires");
  await expect(radialLegend.getByTestId("editor-radial-legend-1")).toContainText("6 × 5.000 m");
  await expect(radialLegend.getByTestId("editor-radial-legend-1")).toContainText("25.0° droop");
  await expect(radialLegend.getByTestId("editor-radial-legend-1")).toContainText("0.0° rotation");

  await page.getByRole("button", { name: "Run Simulation" }).click();
  await expect(page.locator("aside").getByTestId("wire-editor-simulation-status")).toHaveText("3 frequency points calculated", { timeout: 120_000 });
  const patternToggle = page.getByRole("button", { name: "Pattern on" });
  await expect(patternToggle).toHaveAttribute("aria-pressed", "true");
  await patternToggle.click();
  await expect(page.getByRole("button", { name: "Pattern off" })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Pattern off" }).click();
  await expect(page.getByTestId("wire-editor-analysis").getByTestId("results-radiation-cuts-elevation")).toBeVisible();
});

test("unsupported NEC cards block editing and retain the original decoded source download", async ({ page }) => {
  await page.goto("/editor");
  await dismissChangelog(page);
  await openImport(page);
  const input = page.locator('input[type="file"][accept*=".nec"]');
  await input.setInputFiles({ name: "unsupported-arc.nec", mimeType: "text/plain", buffer: Buffer.from(UNSUPPORTED_ARC) });

  const report = page.getByTestId("nec-import-report");
  await expect(report).toContainText("raw only");
  await expect(report).toContainText("blocking: 1");
  await expect(report).toContainText("previous editor model was left untouched");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Original NEC (source text)" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("unsupported-arc.nec");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString()).toBe(UNSUPPORTED_ARC);
});
