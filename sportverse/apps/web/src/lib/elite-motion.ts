/**
 * Elite Draft motion layer — mirrors Stitch *_pro_animated:
 * tactical mouse glow, ambient scan line, staggered entrance.
 */

export type EliteMotionOptions = {
  /** Scan overlay style. Default: thin horizontal line. */
  scan?: "line" | "band" | "wash" | "vscan" | "none";
  /** Auto-stamp entrance stagger on direct section children. */
  autoEntrance?: boolean;
  /** Selector for glass panels that get local mouse glow. */
  glassSelector?: string;
};

const SCAN_CLASS: Record<Exclude<EliteMotionOptions["scan"], undefined | "none">, string> = {
  line: "db-scan-line",
  band: "db-scan-band",
  wash: "db-scan-wash",
  vscan: "db-scan-v",
};

const disposers = new WeakMap<HTMLElement, () => void>();

function setMouseVars(el: HTMLElement, clientX: number, clientY: number, local = false) {
  if (local) {
    const r = el.getBoundingClientRect();
    const x = ((clientX - r.left) / Math.max(1, r.width)) * 100;
    const y = ((clientY - r.top) / Math.max(1, r.height)) * 100;
    el.style.setProperty("--mouse-x", `${x}%`);
    el.style.setProperty("--mouse-y", `${y}%`);
    return;
  }
  el.style.setProperty("--mouse-x", `${clientX}px`);
  el.style.setProperty("--mouse-y", `${clientY}px`);
}

function ensureScan(root: HTMLElement, kind: NonNullable<EliteMotionOptions["scan"]>) {
  if (kind === "none") return;
  const cls = SCAN_CLASS[kind];
  root.querySelectorAll(".db-scan-line, .db-scan-band, .db-scan-wash, .db-scan-v").forEach((n) => {
    if (!n.classList.contains(cls)) n.remove();
  });
  if (root.querySelector(`.${cls}`)) return;
  const scan = document.createElement("div");
  scan.className = cls;
  scan.setAttribute("aria-hidden", "true");
  root.prepend(scan);
}

function stampEntrance(root: HTMLElement) {
  const candidates = root.querySelectorAll<HTMLElement>(
    [
      ".db-hub-command",
      ".db-hub-status-grid > *",
      ".db-hub-featured",
      ".db-hub-tile",
      ".db-hub-data-panel",
      ".db-season-mono-hero",
      ".db-season-page--post > section",
      ".db-season-page--post > .panel",
      ".db-season-page--post > .db-glass",
      ".db-wheel-layout > *",
      ".db-auction-col > *",
      ".db-auction-layout > *",
      ".db-blind-header",
      ".db-blind-grid > *",
      ".db-blind-prob",
      ".db-blind-bot",
      ".db-byo-header",
      ".db-byo-grid > *",
      ".db-byo-forecast",
      ".db-byo-cta",
      ".db-daily-hero",
      ".db-daily-grid > *",
      ".db-daily-stats > *",
      ".db-select-board__head",
      ".db-select-board__list > *",
      ".db-select-board__footer",
      ".db-era-lab-hero",
      ".db-era-lab-layout > *",
      ".db-era-lab-analysis > *",
      ".db-knockout-header",
      ".db-knockout-bracket-wrap",
      ".db-knockout-bento > *",
      ".db-lobby-header",
      ".db-lobby-layout > *",
      ".db-lobby-list > *",
      ".db-tactical-header",
      ".db-tactical-pitch-wrap",
      ".db-tactical-selection",
      ".db-tactical-roster > *",
    ].join(","),
  );

  let i = 0;
  candidates.forEach((el) => {
    if (el.classList.contains("db-entrance")) return;
    el.classList.add("db-entrance");
    el.style.animationDelay = `${Math.min(0.1 + i * 0.08, 1.2)}s`;
    i += 1;
  });
}

/**
 * Bind *_pro_animated motion to a rendered DraftBaller page root.
 * Call after innerHTML paint. Re-binding the same root disposes prior listeners.
 */
export function bindEliteMotion(root: HTMLElement, opts: EliteMotionOptions = {}): () => void {
  disposers.get(root)?.();

  const scan = opts.scan ?? "line";
  const glassSelector = opts.glassSelector ?? ".db-glass";
  const autoEntrance = opts.autoEntrance ?? true;

  root.classList.add("db-elite-motion");
  root.style.setProperty("--mouse-x", "50%");
  root.style.setProperty("--mouse-y", "50%");

  ensureScan(root, scan);
  if (autoEntrance) stampEntrance(root);

  const onMove = (clientX: number, clientY: number) => {
    setMouseVars(root, clientX, clientY, true);
    root.querySelectorAll<HTMLElement>(glassSelector).forEach((panel) => {
      setMouseVars(panel, clientX, clientY, true);
    });
  };

  const onMouse = (e: MouseEvent) => onMove(e.clientX, e.clientY);
  const onTouch = (e: TouchEvent) => {
    const t = e.touches[0];
    if (t) onMove(t.clientX, t.clientY);
  };

  root.addEventListener("mousemove", onMouse, { passive: true });
  root.addEventListener("touchmove", onTouch, { passive: true });

  const dispose = () => {
    root.removeEventListener("mousemove", onMouse);
    root.removeEventListener("touchmove", onTouch);
    disposers.delete(root);
  };
  disposers.set(root, dispose);
  return dispose;
}

/** Wheel snap bump after spin settles — draft_wheel_pro_animated. */
export function triggerWheelSnap(wheelEl: HTMLElement, finalRotationDeg: number) {
  wheelEl.style.setProperty("--final-rot", `${finalRotationDeg}deg`);
  wheelEl.classList.remove("db-wheel--snap");
  void wheelEl.offsetWidth;
  wheelEl.classList.add("db-wheel--snap");
  window.setTimeout(() => wheelEl.classList.remove("db-wheel--snap"), 520);
}
