---
title: "Pulse"
tagline: "A real-time, GPU-rendered view of African tech in motion."
domain: "Web / Data Visualisation"
domains: ["Web", "AI"]
status: "in-progress"
year: "2026"
stack: ["TypeScript", "WebGL / Shaders", "Streaming", "Ring buffer", "Vitest"]
skill: "Real-time data streaming + custom-shader performance"
seniorSignal: "Custom shaders and a streaming pipeline held at 60fps — visual craft plus genuine performance engineering."
summary: "A live data-visualisation dashboard that streams and renders African tech metrics with custom WebGL shaders — built for 60fps under continuous updates rather than generic chart libraries."
order: 8
featured: false
links: []
---

## The idea

Most dashboards are static charts. Pulse treats data as something alive — a continuously updating, GPU-rendered field that makes scale and movement *felt*, not just read. It proves visual craft and performance discipline in the same breath.

## What I built

A standalone Vite app in `projects/pulse`:

```text
Simulator (seeded) ──push──▶ RingBuffer(capacity) ──drain()──▶ Metrics ──▶ WebGL field + HUD
   (producer, ~120Hz)         (backpressure: drops oldest)      (pure)       (rAF, 60fps)
```

No API keys, no backend. The live feed is a **deterministic, seeded simulator** standing in for a WebSocket — swapping in a real socket means feeding `RingBuffer.push` from `socket.onmessage`; nothing downstream changes.

## Engineering decisions

- **Backpressure by construction.** The producer runs faster than the renderer on purpose; the bounded buffer guarantees memory safety and a steady frame rate, and surfaces exactly how many events were shed.
- **Deterministic core.** Seeded simulation makes the stream reproducible and the logic genuinely unit-testable — rare for "real-time viz" projects.
- **Custom shader, not chart widgets.** A gold-on-ink fragment field whose motion tracks live throughput — on brand, not generic particles.
- **Accessibility is not optional.** `prefers-reduced-motion` yields a calm static view; WebGL failure falls back to CSS.

## Results

```bash
cd projects/pulse
npm install && npm run dev && npm test
```

18 Vitest tests cover ring-buffer ordering + drop accounting, simulator determinism, metrics EMA/history bounds and colour helpers.

## Senior signal

Real-time data plus custom shaders held at frame budget is a rare combination — design taste *and* systems instincts in one artifact.
