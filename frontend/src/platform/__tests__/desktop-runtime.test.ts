import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appendDiagnosticLog, getRuntimeInfo, isDesktopRuntime, openLogDirectory } from "../desktop-runtime";

const originalWindow = globalThis.window;

beforeEach(() => {
  vi.stubGlobal("__APP_VERSION__", "1.4.2");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
});

describe("desktop runtime boundary", () => {
  it("keeps normal browser operation independent of Tauri", async () => {
    Object.defineProperty(globalThis, "window", { configurable: true, value: undefined });
    expect(isDesktopRuntime()).toBe(false);
    await expect(getRuntimeInfo()).resolves.toMatchObject({ packaged: false, version: "1.4.2" });
    await expect(appendDiagnosticLog("info", "browser message")).resolves.toBeUndefined();
    await expect(openLogDirectory()).rejects.toThrow("installed Windows application");
  });

  it("uses only the three declared native commands in the package", async () => {
    const invoke = vi.fn(async (command: string) => {
      if (command === "get_runtime_info") {
        return { packaged: true, version: "1.4.2", logDirectory: "C:\\logs", projectStorage: "preserved" };
      }
      return undefined;
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { __TAURI__: { core: { invoke } } },
    });

    expect(isDesktopRuntime()).toBe(true);
    await expect(getRuntimeInfo()).resolves.toMatchObject({ packaged: true, logDirectory: "C:\\logs" });
    await appendDiagnosticLog("warn", "test warning");
    await openLogDirectory();
    expect(invoke.mock.calls.map(([command]) => command)).toEqual([
      "get_runtime_info",
      "append_diagnostic_log",
      "open_log_directory",
    ]);
    expect(invoke).toHaveBeenNthCalledWith(2, "append_diagnostic_log", { level: "warn", message: "test warning" });
  });
});
