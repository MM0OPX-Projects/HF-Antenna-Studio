import { describe, expect, it } from "vitest";
import { getEngine } from "./index";
import { WasmEngine } from "./wasm";

describe("release engine selection", () => {
  it("fails safe to the local Wasm solver when no legacy backend is requested", () => {
    expect(getEngine()).toBeInstanceOf(WasmEngine);
  });
});
