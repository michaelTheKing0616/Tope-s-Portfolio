import { describe, expect, it } from "vitest";
import {
  attributeConfidenceMultiplier,
  computeRatingConfidence,
  positionConfidenceMultiplier,
} from "./attribute-confidence.js";

describe("attribute confidence — Engine v4 §1.3", () => {
  it("defenders carry lower baseline confidence than attackers", () => {
    expect(positionConfidenceMultiplier("CB")).toBeLessThan(positionConfidenceMultiplier("ST"));
    expect(computeRatingConfidence(80, "CB")).toBeLessThan(computeRatingConfidence(80, "ST"));
  });

  it("DEF attribute for CB is discounted more than SHO", () => {
    expect(attributeConfidenceMultiplier("CB", "def")).toBeLessThan(
      attributeConfidenceMultiplier("CB", "sho"),
    );
  });

  it("confidence rises with sample size (empirical Bayes n/(n+k))", () => {
    const small = computeRatingConfidence(10, "ST");
    const large = computeRatingConfidence(120, "ST");
    expect(large).toBeGreaterThan(small);
  });
});
