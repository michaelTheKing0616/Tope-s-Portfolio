import { describe, expect, it } from "vitest";
import { competitionDisplayName, clubDisplayName, seasonContextLabel } from "./display-names.js";

describe("display-names", () => {
  it("maps tm-cit to Italy Cup", () => {
    expect(competitionDisplayName("tm-cit")).toBe("Italy Cup");
  });

  it("never returns raw tm- codes for clubs when a competition name exists", () => {
    const label = clubDisplayName("tm-cit");
    expect(label).not.toMatch(/^tm[-_]/i);
    expect(label.length).toBeGreaterThan(2);
  });

  it("keeps real club brand names", () => {
    expect(clubDisplayName("Udinese Calcio")).toBe("Udinese Calcio");
  });

  it("formats season rows with human competition labels", () => {
    const label = seasonContextLabel({
      seasonLabel: "18/19",
      competitionId: "tm-cit",
    });
    expect(label).toContain("18/19");
    expect(label).toContain("Italy Cup");
    expect(label).not.toContain("tm-cit");
  });
});
