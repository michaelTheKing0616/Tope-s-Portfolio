import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseMarketValueYear } from "./build-fame-index.mjs";

describe("parseMarketValueYear", () => {
  it("parses ISO dates from archive CSV", () => {
    assert.equal(parseMarketValueYear("2017-06-01"), 2017);
    assert.equal(parseMarketValueYear("2004-12-31"), 2004);
  });

  it("parses unix seconds", () => {
    assert.equal(parseMarketValueYear("1496275200"), 2017);
  });

  it("rejects empty / garbage", () => {
    assert.equal(parseMarketValueYear(""), 0);
    assert.equal(parseMarketValueYear("not-a-date"), 0);
  });
});
