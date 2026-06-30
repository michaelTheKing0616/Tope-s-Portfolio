import { describe, it, expect } from "vitest";
import { STATES, listStates, findState, isValidState, statesInZone } from "./states.js";

describe("states dataset", () => {
  it("contains exactly 37 entries (36 states + FCT)", () => {
    expect(STATES).toHaveLength(37);
    expect(listStates()).toContain("Lagos");
    expect(listStates()).toContain("Federal Capital Territory");
  });

  it("looks up states case-insensitively", () => {
    expect(findState("lagos")?.capital).toBe("Ikeja");
    expect(findState("  RIVERS ")?.capital).toBe("Port Harcourt");
    expect(findState("Wakanda")).toBeUndefined();
  });

  it("validates state names", () => {
    expect(isValidState("Kano")).toBe(true);
    expect(isValidState("Atlantis")).toBe(false);
  });

  it("groups by geopolitical zone", () => {
    const sw = statesInZone("South-West").map((s) => s.name);
    expect(sw).toContain("Lagos");
    expect(sw).toContain("Oyo");
    expect(sw).not.toContain("Kano");
  });
});
