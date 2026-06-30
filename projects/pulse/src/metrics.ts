/**
 * Pure aggregation over drained events. No DOM, no WebGL — just numbers, so it
 * is trivially testable and could run on a server just as well as in the tab.
 */
import type { EventKind, TechEvent } from "./stream";

export interface MetricsSnapshot {
  totalEvents: number;
  /** Smoothed throughput in events/second (exponential moving average). */
  throughput: number;
  byKind: Record<EventKind, number>;
  byCity: Record<string, number>;
  /** Total payment value seen, in minor units (kobo). */
  paymentVolume: number;
  /** Recent throughput samples for a sparkline, oldest first. */
  history: number[];
}

const KINDS: EventKind[] = ["deploy", "signup", "payment", "commit"];

export class Metrics {
  private total = 0;
  private ema = 0;
  private readonly alpha: number;
  private byKind: Record<EventKind, number> = { deploy: 0, signup: 0, payment: 0, commit: 0 };
  private byCity: Record<string, number> = {};
  private paymentVolume = 0;
  private history: number[] = [];

  constructor(private readonly historySize = 120, smoothing = 0.2) {
    this.alpha = smoothing;
  }

  /** Fold one batch of events covering `dtMs` of time into the running metrics. */
  update(events: TechEvent[], dtMs: number): void {
    this.total += events.length;
    for (const e of events) {
      this.byKind[e.kind]++;
      this.byCity[e.city] = (this.byCity[e.city] ?? 0) + 1;
      if (e.kind === "payment") this.paymentVolume += e.value;
    }
    const instantRate = dtMs > 0 ? (events.length * 1000) / dtMs : 0;
    this.ema = this.ema === 0 ? instantRate : this.alpha * instantRate + (1 - this.alpha) * this.ema;
    this.history.push(this.ema);
    if (this.history.length > this.historySize) this.history.shift();
  }

  snapshot(): MetricsSnapshot {
    return {
      totalEvents: this.total,
      throughput: this.ema,
      byKind: { ...this.byKind },
      byCity: { ...this.byCity },
      paymentVolume: this.paymentVolume,
      history: [...this.history],
    };
  }

  /** Kinds sorted by count, descending — handy for a ranked legend. */
  topKinds(): { kind: EventKind; count: number }[] {
    return KINDS.map((kind) => ({ kind, count: this.byKind[kind] })).sort((a, b) => b.count - a.count);
  }
}

/** Normalised intensity in [0,1] from a throughput value, for shader/colour input. */
export function intensity(throughput: number, ceiling = 80): number {
  if (throughput <= 0) return 0;
  return Math.min(1, throughput / ceiling);
}
