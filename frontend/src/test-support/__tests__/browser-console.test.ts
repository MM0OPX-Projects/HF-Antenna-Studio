import { describe, expect, it } from "vitest";
import { isKnownNonApplicationConsoleWarning } from "../browser-console";

describe("browser console diagnostics", () => {
  it("classifies only the exact Chromium ReadPixels performance warning", () => {
    expect(isKnownNonApplicationConsoleWarning(
      "[.WebGL-0x648c03072000]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels",
    )).toBe(true);
    expect(isKnownNonApplicationConsoleWarning(
      "[.WebGL-0x648c03072000]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels (this message will no longer repeat)",
    )).toBe(true);
    expect(isKnownNonApplicationConsoleWarning(
      "[.WebGL-0x648c03072000]GL Driver Message (OpenGL, Error, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels",
    )).toBe(false);
    expect(isKnownNonApplicationConsoleWarning("Application warning: solver result is stale")).toBe(false);
  });
});
