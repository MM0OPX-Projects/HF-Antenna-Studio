import { clampPanelSize, keyboardResizeDelta, resizePanelValue } from "../panel-sizing";

describe("workbench panel sizing", () => {
  it("clamps pointer resizing to the declared bounds", () => {
    expect(resizePanelValue(300, 50, 1, 240, 460)).toBe(350);
    expect(resizePanelValue(300, -500, 1, 240, 460)).toBe(240);
    expect(resizePanelValue(300, -100, -1, 240, 460)).toBe(400);
  });

  it("rejects non-finite sizes and rounds pixel values", () => {
    expect(clampPanelSize(Number.NaN, 200, 500)).toBe(200);
    expect(clampPanelSize(321.6, 200, 500)).toBe(322);
  });

  it("maps only orientation-appropriate keyboard arrows", () => {
    expect(keyboardResizeDelta("ArrowLeft", "horizontal")).toBe(-16);
    expect(keyboardResizeDelta("ArrowDown", "vertical")).toBe(16);
    expect(keyboardResizeDelta("ArrowDown", "horizontal")).toBeNull();
  });
});
