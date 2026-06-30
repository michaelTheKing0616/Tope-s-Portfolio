# Pulse

A real-time, GPU-rendered view of "African tech in motion" — a continuously
updating field of metrics (deploys, signups, payments, commits across cities)
rendered with a custom WebGL shader and held to a 60fps budget.

It is built to prove two things at once: **visual craft** (a bespoke gold-on-ink
shader, not an off-the-shelf chart) and **performance/systems discipline**
(a streaming pipeline with backpressure that never stalls the frame).

## Run

```bash
npm install
npm run dev      # open the printed localhost URL
npm test         # unit tests (Vitest)
npm run build    # typecheck + production build
```

No API keys, no backend. The live feed is a **deterministic, seeded simulator**
standing in for a WebSocket. Swapping in a real socket means feeding
`RingBuffer.push` from `socket.onmessage` — nothing downstream changes.

## Architecture

```
Simulator (seeded) ──push──▶ RingBuffer(capacity) ──drain()──▶ Metrics ──▶ WebGL field + HUD
   (producer, ~120Hz)         (backpressure: drops oldest)      (pure)       (rAF, 60fps)
```

- **`stream.ts`** — `RingBuffer<T>` (fixed capacity, drops oldest when full and
  counts the drops) and `Simulator` (seeded, deterministic event source).
- **`metrics.ts`** — pure aggregation: smoothed throughput (EMA), per-kind and
  per-city counts, payment volume, a bounded history for the sparkline.
- **`renderer.ts`** — WebGL fragment-shader field whose motion/brightness track
  live throughput; pure colour helpers are unit-tested; degrades to a CSS
  background with no WebGL and to a single frame under reduced motion.
- **`main.ts`** — wires a fast producer to an rAF consumer; the two are
  decoupled, so bursts are absorbed (counted as "shed") instead of stalling.

## Where the senior signal is

- **Backpressure by construction.** The producer runs faster than the renderer
  on purpose; the bounded buffer guarantees memory safety and a steady frame
  rate under load, and surfaces exactly how many events were shed.
- **Deterministic core.** Seeded simulation makes the stream reproducible and
  the logic genuinely unit-testable — rare for "real-time viz" projects.
- **Accessibility is not optional.** `prefers-reduced-motion` yields a calm
  static view; the visual layer fails safe when WebGL is unavailable.

## Tests

`npm test` covers ring-buffer ordering + drop accounting, simulator determinism
and rate, metrics aggregation/EMA/history bounds, and the pure colour ramp.
