import { describe, expect, it } from "vitest";
import { RingBuffer, Simulator } from "./stream";

describe("RingBuffer", () => {
  it("preserves insertion order while under capacity", () => {
    const rb = new RingBuffer<number>(4);
    rb.push(1);
    rb.push(2);
    rb.push(3);
    expect(rb.size).toBe(3);
    expect(rb.drain()).toEqual([1, 2, 3]);
    expect(rb.size).toBe(0);
  });

  it("drops the oldest item when full and counts the drops (backpressure)", () => {
    const rb = new RingBuffer<number>(3);
    [1, 2, 3, 4, 5].forEach((n) => rb.push(n));
    expect(rb.size).toBe(3);
    expect(rb.dropped).toBe(2);
    expect(rb.drain()).toEqual([3, 4, 5]); // 1 and 2 were shed
  });

  it("never exceeds capacity no matter the burst", () => {
    const rb = new RingBuffer<number>(8);
    for (let i = 0; i < 1000; i++) rb.push(i);
    expect(rb.size).toBe(8);
    expect(rb.dropped).toBe(992);
    expect(rb.drain().length).toBe(8);
  });

  it("rejects a non-positive capacity", () => {
    expect(() => new RingBuffer<number>(0)).toThrow();
  });
});

describe("Simulator", () => {
  it("is deterministic for a given seed", () => {
    const a = new Simulator({ seed: 42 });
    const b = new Simulator({ seed: 42 });
    expect(a.tick(100)).toEqual(b.tick(100));
  });

  it("diverges for different seeds", () => {
    const a = new Simulator({ seed: 1 }).tick(1000);
    const b = new Simulator({ seed: 2 }).tick(1000);
    expect(a).not.toEqual(b);
  });

  it("produces roughly the configured rate over a second", () => {
    const sim = new Simulator({ seed: 3, ratePerSecond: 60 });
    let count = 0;
    for (let i = 0; i < 100; i++) count += sim.tick(10).length; // 1s in 10ms slices
    expect(count).toBeGreaterThan(30);
    expect(count).toBeLessThan(90);
  });

  it("only attaches monetary value to payment events", () => {
    const sim = new Simulator({ seed: 9, ratePerSecond: 200 });
    for (const e of sim.tick(1000)) {
      if (e.kind === "payment") expect(e.value).toBeGreaterThan(1);
      else expect(e.value).toBe(1);
    }
  });
});
