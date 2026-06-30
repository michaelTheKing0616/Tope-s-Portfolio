import { describe, expect, it } from "vitest";
import { fuzzyNameEquals, whoAmIGuessMatches } from "../src/name-match.js";

describe("whoAmIGuessMatches", () => {
  it("accepts full name exact match", () => {
    expect(whoAmIGuessMatches("Kylian Mbappé", "Kylian Mbappe")).toBe(true);
  });

  it("accepts last name only", () => {
    expect(whoAmIGuessMatches("Kylian Mbappé", "Mbappe")).toBe(true);
  });

  it("accepts first name only", () => {
    expect(whoAmIGuessMatches("Kylian Mbappé", "Kylian")).toBe(true);
  });

  it("accepts minor typo on surname", () => {
    expect(whoAmIGuessMatches("Kylian Mbappé", "Mbape")).toBe(true);
    expect(whoAmIGuessMatches("Mohamed Salah", "Salh")).toBe(true);
  });

  it("rejects clearly wrong names", () => {
    expect(whoAmIGuessMatches("Kylian Mbappé", "Gerard")).toBe(false);
    expect(whoAmIGuessMatches("Lionel Messi", "Mbappe")).toBe(false);
    expect(whoAmIGuessMatches("Kylian Mbappé", "Mbppp")).toBe(false);
  });

  it("rejects single-letter or particle-only guesses", () => {
    expect(whoAmIGuessMatches("Virgil van Dijk", "van")).toBe(false);
    expect(whoAmIGuessMatches("Kylian Mbappé", "K")).toBe(false);
  });

  it("accepts distinctive surname from multi-part name", () => {
    expect(whoAmIGuessMatches("Virgil van Dijk", "Dijk")).toBe(true);
    expect(whoAmIGuessMatches("Virgil van Dijk", "Djk")).toBe(true);
  });

  it("accepts mononym players", () => {
    expect(whoAmIGuessMatches("Rodri", "Rodri")).toBe(true);
    expect(whoAmIGuessMatches("Rodri", "Rodry")).toBe(true);
  });
});

describe("fuzzyNameEquals", () => {
  it("ignores accents", () => {
    expect(fuzzyNameEquals("Mbappé", "Mbappe")).toBe(true);
  });
});
