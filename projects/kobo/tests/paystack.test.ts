import { describe, expect, it } from "vitest";
import { verifyPaystackSignature } from "../src/paystack.js";
import { createHmac } from "node:crypto";

describe("paystack", () => {
  it("verifies valid HMAC signatures", () => {
    const secret = "test_secret";
    const body = '{"event":"charge.success"}';
    const sig = createHmac("sha512", secret).update(body).digest("hex");
    expect(verifyPaystackSignature(body, sig, secret)).toBe(true);
  });

  it("rejects invalid signatures", () => {
    expect(verifyPaystackSignature("{}", "bad", "secret")).toBe(false);
  });

  it("skips verification when secret is empty (dev)", () => {
    expect(verifyPaystackSignature("{}", undefined, "")).toBe(true);
  });
});
