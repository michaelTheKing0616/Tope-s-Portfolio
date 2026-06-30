/**
 * Wiring: a fast producer pushes simulated events into a small RingBuffer; a
 * requestAnimationFrame consumer drains and folds them into Metrics, then paints
 * the GL field and the HUD. Producer and consumer are intentionally decoupled,
 * so a burst is absorbed (and counted as "shed") rather than stalling the frame.
 */
import { Metrics, intensity } from "./metrics";
import { mountField } from "./renderer";
import { RingBuffer, Simulator, type TechEvent } from "./stream";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const $ = <T extends Element>(sel: string) => document.querySelector<T>(sel)!;

function fmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));
}
function naira(kobo: number): string {
  return `\u20a6${Math.round(kobo / 100).toLocaleString("en-NG")}`;
}

function start(): void {
  const canvas = $("[data-field]") as HTMLCanvasElement;
  const field = mountField(canvas, reducedMotion);

  const sim = new Simulator({ seed: 7, ratePerSecond: 90 });
  const buffer = new RingBuffer<TechEvent>(256);
  const metrics = new Metrics();

  // Producer: ~120Hz, deliberately faster than the frame consumer.
  let lastProduce = performance.now();
  const producer = window.setInterval(() => {
    const now = performance.now();
    for (const e of sim.tick(now - lastProduce)) buffer.push(e);
    lastProduce = now;
  }, 8);

  const spark = $("[data-spark]") as HTMLCanvasElement;
  const sctx = spark.getContext("2d");

  let lastFrame = performance.now();
  const render = (now: number) => {
    const dt = now - lastFrame;
    lastFrame = now;

    const batch = buffer.drain();
    metrics.update(batch, dt);
    const snap = metrics.snapshot();

    field?.setIntensity(intensity(snap.throughput));

    $("[data-stat=throughput]").textContent = snap.throughput.toFixed(0);
    $("[data-stat=total]").textContent = fmt(snap.totalEvents);
    $("[data-stat=volume]").textContent = naira(snap.paymentVolume);
    $("[data-stat=shed]").textContent = String(buffer.dropped);

    const legend = $("[data-legend]");
    legend.innerHTML = metrics
      .topKinds()
      .map((k) => `<li><span class="dot dot--${k.kind}"></span>${k.kind}<b>${fmt(k.count)}</b></li>`)
      .join("");

    if (sctx) drawSparkline(sctx, spark, snap.history);

    if (!reducedMotion) requestAnimationFrame(render);
  };

  if (reducedMotion) {
    // One settle pass for a calm static view.
    for (let i = 0; i < 30; i++) metrics.update(sim.tick(33), 33);
    render(performance.now());
  } else {
    requestAnimationFrame(render);
  }

  window.addEventListener("beforeunload", () => {
    clearInterval(producer);
    field?.dispose();
  });
}

function drawSparkline(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, data: number[]): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = (canvas.width = canvas.clientWidth * dpr);
  const h = (canvas.height = canvas.clientHeight * dpr);
  ctx.clearRect(0, 0, w, h);
  if (data.length < 2) return;
  const max = Math.max(...data, 1);
  ctx.beginPath();
  data.forEach((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * (h * 0.9) - h * 0.05;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "#b8954a";
  ctx.lineWidth = 1.5 * dpr;
  ctx.stroke();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
