import { describe, expect, it } from "vitest";
import { buildOptimisationExport } from "../exports";

describe("optimisation reproducibility export", () => {
  it("uses cautious best-found language and records that no global optimum was established", () => {
    const json = buildOptimisationExport({ globalOptimumEstablished: false } as never);
    expect(json).toContain("Best solution found");
    expect(json).toContain("no global optimum is established");
    expect(json).not.toContain("Perfect antenna");
  });
});
