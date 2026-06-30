import { describe, expect, it } from "vitest";
import { Metrics, intensity } from "./metrics";
import type { TechEvent } from "./stream";

const ev = (kind: TechEvent["kind"], value = 1, city = "Lagos"): TechEvent => ({
  t: 0,
  city,
  kind,
  value,
});

describe("Metrics", () => {
  it("counts events by kind and city", () => {
    const m = new Metrics();
    m.update([ev("signup"), ev("signup"), ev("commit", 1, "Accra")], 1000);
    const s = m.snapshot();
    expect(s.totalEvents).toBe(3);
    expect(s.byKind.signup).toBe(2);
    expect(s.byKind.commit).toBe(1);
    expect(s.byCity.Lagos).toBe(2);
    expect(s.byCity.Accra).toBe(1);
  });

  it("accumulates payment volume only from payment events", () => {
    const m = new Metrics();
    m.update([ev("payment", 5000), ev("payment", 2500), ev("signup")], 1000);
    expect(m.snapshot().paymentVolume).toBe(7500);
  });

  it("smooths throughput rather than jumping to the instant rate", () => {
    const m = new Metrics(120, 0.2);
    m.update(new Array(100).fill(ev("commit")), 1000); // instant 100/s
    // EMA seeds to the first instant rate, then a quiet slice pulls it down.
    expect(m.snapshot().throughput).toBeCloseTo(100, 5);
    m.update([], 1000); // instant 0/s
    const t = m.snapshot().throughput;
    expect(t).toBeLessThan(100);
    expect(t).toBeGreaterThan(0); // not a hard jump to zero
  });

  it("bounds the history to its configured size", () => {
    const m = new Metrics(5);
    for (let i = 0; i < 20; i++) m.update([ev("commit")], 100);
    expect(m.snapshot().history.length).toBe(5);
  });

  it("ranks kinds by count", () => {
    const m = new Metrics();
    m.update([ev("commit"), ev("commit"), ev("commit"), ev("signup")], 1000);
    expect(m.topKinds()[0]).toEqual({ kind: "commit", count: 3 });
  });
});

describe("intensity", () => {
  it("clamps to [0,1]", () => {
    expect(intensity(0)).toBe(0);
    expect(intensity(-5)).toBe(0);
    expect(intensity(1000, 80)).toBe(1);
    expect(intensity(40, 80)).toBeCloseTo(0.5);
  });
});
