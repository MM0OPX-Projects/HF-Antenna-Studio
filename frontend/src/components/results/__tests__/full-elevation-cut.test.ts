import { describe, expect, it } from "vitest";
import type { PatternData } from "../../../api/nec";
import { extractFullElevationCut } from "../full-elevation-cut";

describe("full 180-degree elevation cuts", () => {
  const pattern: PatternData = {
    theta_start: 0,
    theta_step: 45,
    theta_count: 3,
    phi_start: 0,
    phi_step: 90,
    phi_count: 4,
    gain_dbi: [
      [100, 110, 120, 130],
      [200, 210, 220, 230],
      [300, 310, 320, 330],
    ],
  };

  it("joins the primary bearing to its real opposite-bearing samples through zenith", () => {
    expect(extractFullElevationCut(pattern, 90)).toEqual([
      { angleDeg: 0, gainDbi: 310 },
      { angleDeg: 45, gainDbi: 210 },
      { angleDeg: 90, gainDbi: 110 },
      { angleDeg: 135, gainDbi: 230 },
      { angleDeg: 180, gainDbi: 330 },
    ]);
  });

  it("selects the nearest circular phi samples", () => {
    expect(extractFullElevationCut(pattern, 88)).toEqual(extractFullElevationCut(pattern, 90));
    expect(extractFullElevationCut(pattern, 358)[0]).toEqual({ angleDeg: 0, gainDbi: 300 });
  });

  it("prefers signed theta for the opposite half-plane and tolerates sparse redundant phi samples", () => {
    const signedPattern: PatternData = {
      theta_start: -90,
      theta_step: 45,
      theta_count: 5,
      phi_start: 0,
      phi_step: 180,
      phi_count: 2,
      gain_dbi: [
        [1, -999.99],
        [2, -999.99],
        [3, 30],
        [4, -999.99],
        [5, -999.99],
      ],
    };

    expect(extractFullElevationCut(signedPattern, 0)).toEqual([
      { angleDeg: 0, gainDbi: 5 },
      { angleDeg: 45, gainDbi: 4 },
      { angleDeg: 90, gainDbi: 3 },
      { angleDeg: 135, gainDbi: 2 },
      { angleDeg: 180, gainDbi: 1 },
    ]);
  });
});
