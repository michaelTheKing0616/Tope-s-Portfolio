import { describe, expect, it } from "vitest";
import { encodeModeShare, decodeModeShare, getPresetMode } from "./index.js";

describe("Architect mode share code", () => {
  it("round-trips DraftModeConfig with checksum", () => {
    const mode = {
      ...getPresetMode("custom"),
      blendFactor: 0.42,
      rawDomesticDominance: true,
      deepCuts: true,
      formationId: "5-3-2",
    };
    const code = encodeModeShare(mode);
    expect(code).toContain(".");
    const back = decodeModeShare(code);
    expect(back.blendFactor).toBe(0.42);
    expect(back.rawDomesticDominance).toBe(true);
    expect(back.deepCuts).toBe(true);
    expect(back.formationId).toBe("5-3-2");
    expect(back.ratingLens).toBe(mode.ratingLens);
  });

  it("rejects tampered checksum", () => {
    const code = encodeModeShare(getPresetMode("all-time-any"));
    const [sum, b64] = code.split(".");
    expect(() => decodeModeShare(`x${sum}.${b64}`)).toThrow(/Invalid mode share/);
  });
});
