/**
 * The streaming core. Two ideas earn their keep here:
 *
 *  1. A fixed-capacity RingBuffer that *drops the oldest* item when full instead
 *     of growing without bound. This is backpressure: a burst of events can
 *     never exhaust memory or stall the consumer; it degrades gracefully and
 *     reports how many it shed.
 *
 *  2. A deterministic Simulator (seeded RNG) standing in for a real WebSocket
 *     feed. Swap `Simulator.tick` for socket messages and nothing downstream
 *     changes — the render loop only ever drains the buffer.
 */
import { intBetween, mulberry32, weightedPick } from "./rng";

export type EventKind = "deploy" | "signup" | "payment" | "commit";

export interface TechEvent {
  /** Monotonic timestamp in ms. */
  t: number;
  city: string;
  kind: EventKind;
  /** A positive magnitude (e.g. payment amount, or 1 for a count). */
  value: number;
}

export class RingBuffer<T> {
  private buf: (T | undefined)[];
  private head = 0; // next write
  private count = 0;
  private droppedTotal = 0;

  constructor(public readonly capacity: number) {
    if (capacity <= 0) throw new Error("capacity must be positive");
    this.buf = new Array<T | undefined>(capacity);
  }

  get size(): number {
    return this.count;
  }
  get dropped(): number {
    return this.droppedTotal;
  }
  get isFull(): boolean {
    return this.count === this.capacity;
  }

  /** Push one item. When full, the oldest item is overwritten (backpressure). */
  push(item: T): void {
    if (this.isFull) this.droppedTotal++;
    this.buf[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  /** Remove and return everything in insertion order, leaving the buffer empty. */
  drain(): T[] {
    const out: T[] = [];
    const start = (this.head - this.count + this.capacity) % this.capacity;
    for (let i = 0; i < this.count; i++) {
      out.push(this.buf[(start + i) % this.capacity] as T);
    }
    this.count = 0;
    this.head = 0;
    this.buf.fill(undefined);
    return out;
  }
}

export const CITIES = ["Lagos", "Nairobi", "Accra", "Cairo", "Kigali", "Cape Town"] as const;
const KINDS: EventKind[] = ["deploy", "signup", "payment", "commit"];
const KIND_WEIGHTS = [2, 5, 3, 6];

export interface SimulatorOptions {
  seed?: number;
  /** Mean events generated per second; actual count per tick is Poisson-ish. */
  ratePerSecond?: number;
}

export class Simulator {
  private rand: () => number;
  private clock = 0;
  private readonly rate: number;

  constructor(opts: SimulatorOptions = {}) {
    this.rand = mulberry32(opts.seed ?? 1);
    this.rate = opts.ratePerSecond ?? 40;
  }

  /** Advance time by `dtMs` and return the events generated in that slice. */
  tick(dtMs: number): TechEvent[] {
    this.clock += dtMs;
    const expected = (this.rate * dtMs) / 1000;
    // Jittered count around the expected rate, never negative.
    const n = Math.max(0, Math.round(expected + (this.rand() - 0.5) * expected));
    const events: TechEvent[] = [];
    for (let i = 0; i < n; i++) {
      const kind = weightedPick(this.rand, KINDS, KIND_WEIGHTS);
      events.push({
        t: this.clock,
        city: weightedPick(this.rand, CITIES, [6, 4, 3, 4, 2, 3]),
        kind,
        value: kind === "payment" ? intBetween(this.rand, 500, 250000) : 1,
      });
    }
    return events;
  }
}
