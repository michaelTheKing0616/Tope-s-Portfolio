import type { FormationSlotDef, PitchZone } from "@sportverse/draftballer-types";
import { getFormation } from "@sportverse/match-sim";
import { resolveApiBase } from "@sportverse/platform";

type Navigate = (route: string, param?: string) => void;

const API_BASE = resolveApiBase();
const GRID_STEP = 5;
const MAX_SLOTS = 11;
const POSITION_TAGS = ["GK", "CB", "FB", "DM", "CM", "AM", "W", "ST"] as const;

export interface FormationSharePayload {
  name: string;
  slots: Pick<FormationSlotDef, "positionTag" | "x" | "y">[];
}

interface CanvasSlot {
  positionTag: string;
  x: number;
  y: number;
}

function checksum(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Share code — base64 JSON + checksum (same pattern as squad-share.ts). */
export function encodeFormationShare(payload: FormationSharePayload): string {
  const json = JSON.stringify(payload);
  const b64 = btoa(json);
  return `${checksum(b64)}.${b64}`;
}

export function decodeFormationShare(code: string): FormationSharePayload {
  const [sum, b64] = code.split(".");
  if (!sum || !b64 || checksum(b64) !== sum) throw new Error("Invalid formation share code");
  return JSON.parse(atob(b64)) as FormationSharePayload;
}

function zoneFromXY(x: number, y: number): PitchZone {
  const xBand = x < 33 ? "def" : x < 66 ? "mid" : "att";
  const yBand = y < 33 ? "left" : y < 66 ? "center" : "right";
  return `${xBand}_${yBand}` as PitchZone;
}

function snap(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value / GRID_STEP) * GRID_STEP));
}

function defaultSlots(): CanvasSlot[] {
  return getFormation("4-4-2").slots.map((s) => ({
    positionTag: s.positionTag,
    x: s.x,
    y: s.y,
  }));
}

function slotsToFormationDefs(slots: CanvasSlot[]): FormationSlotDef[] {
  return slots.map((s, i) => ({
    slotIndex: i,
    positionTag: s.positionTag,
    x: s.x,
    y: s.y,
    zoneId: zoneFromXY(s.x, s.y),
  }));
}

function renderDots(slots: CanvasSlot[]): string {
  return slots
    .map(
      (s, i) =>
        `<button type="button" class="db-pitch-dot db-pitch-dot--draggable" data-idx="${i}" style="left:${s.y}%;top:${100 - s.x}%" title="${s.positionTag} — drag to move, click to cycle">${s.positionTag.slice(0, 2)}</button>`,
    )
    .join("");
}

function countBackLine(slots: CanvasSlot[]): number {
  return slots.filter((s) => s.positionTag === "CB" || s.positionTag === "FB").length;
}

function widthCategory(slots: CanvasSlot[]): "narrow" | "balanced" | "wide" {
  const ys = slots.filter((s) => s.positionTag !== "GK").map((s) => s.y);
  const spread = Math.max(...ys) - Math.min(...ys);
  if (spread < 55) return "narrow";
  if (spread > 75) return "wide";
  return "balanced";
}

/** Drag-and-drop custom formation builder on 0–100 pitch grid. */
export function renderDraftballerFormationCanvas(root: HTMLElement, navigate: Navigate) {
  let slots = defaultSlots();
  let formationName = "Custom formation";
  let shareCode = "";
  let statusMsg = "";
  let draggingIdx: number | null = null;

  function draw() {
    root.innerHTML = `
      <div class="shell db-root">
        <button class="btn btn--ghost" id="back">← Squad Builder</button>
        <header class="db-hero">
          <p class="db-hero__label">Formation Canvas</p>
          <h1 class="db-hero__title">CUSTOM XI</h1>
          <p style="color:var(--db-muted);font-size:0.85rem">Drag dots on the pitch · snap 5% grid · ${slots.length}/${MAX_SLOTS} slots</p>
        </header>

        <div class="panel">
          <label for="fname">Formation name</label>
          <input id="fname" class="btn btn--ghost btn--block" value="${formationName}" style="margin-top:6px;text-align:left" />
        </div>

        <div class="db-formation-canvas panel" id="pitch" aria-label="Pitch formation canvas">
          <div class="db-formation-canvas__grid" aria-hidden="true"></div>
          ${renderDots(slots)}
        </div>

        <div class="db-formation-canvas__toolbar">
          <button class="btn btn--ghost" id="reset" type="button">Reset 4-4-2</button>
          <button class="btn btn--ghost" id="remove" type="button" ${slots.length <= 1 ? "disabled" : ""}>Remove slot</button>
          <button class="btn btn--ghost" id="add" type="button" ${slots.length >= MAX_SLOTS ? "disabled" : ""}>Add slot</button>
        </div>

        <button class="btn" id="save" style="width:100%;margin-top:12px" ${slots.length !== MAX_SLOTS ? "disabled" : ""}>
          Save formation (${slots.length}/${MAX_SLOTS})
        </button>
        <button class="btn btn--ghost" id="share" style="width:100%;margin-top:8px">Generate share code</button>

        ${shareCode ? `<div class="panel" style="margin-top:12px"><label>Share code</label><code class="db-share-code">${shareCode}</code></div>` : ""}
        ${statusMsg ? `<p class="db-formation-canvas__status">${statusMsg}</p>` : ""}

        <div class="panel" style="margin-top:12px;font-size:0.8rem;color:var(--db-muted)">
          <strong style="color:var(--db-gold)">Import share code</strong>
          <input id="import" class="btn btn--ghost btn--block" placeholder="checksum.base64…" style="margin-top:6px;text-align:left" />
          <button class="btn btn--ghost" id="loadShare" style="width:100%;margin-top:8px">Load from code</button>
        </div>
      </div>`;

    bindEvents();
  }

  function bindEvents() {
    root.querySelector("#back")?.addEventListener("click", () => navigate("draftballer", "squad-builder"));
    root.querySelector("#fname")?.addEventListener("input", (e) => {
      formationName = (e.target as HTMLInputElement).value.trim() || "Custom formation";
    });
    root.querySelector("#reset")?.addEventListener("click", () => {
      slots = defaultSlots();
      shareCode = "";
      statusMsg = "";
      draw();
    });
    root.querySelector("#add")?.addEventListener("click", () => {
      if (slots.length >= MAX_SLOTS) return;
      slots.push({ positionTag: "CM", x: 50, y: 50 });
      draw();
    });
    root.querySelector("#remove")?.addEventListener("click", () => {
      if (slots.length <= 1) return;
      slots.pop();
      draw();
    });
    root.querySelector("#share")?.addEventListener("click", () => {
      shareCode = encodeFormationShare({
        name: formationName,
        slots: slots.map(({ positionTag, x, y }) => ({ positionTag, x, y })),
      });
      statusMsg = "Share code generated — copy and send to friends.";
      draw();
    });
    root.querySelector("#loadShare")?.addEventListener("click", () => {
      const raw = (root.querySelector("#import") as HTMLInputElement)?.value.trim();
      if (!raw) return;
      try {
        const payload = decodeFormationShare(raw);
        formationName = payload.name;
        slots = payload.slots.slice(0, MAX_SLOTS).map((s) => ({
          positionTag: s.positionTag,
          x: snap(s.x),
          y: snap(s.y),
        }));
        shareCode = raw;
        statusMsg = `Loaded "${payload.name}" (${slots.length} slots).`;
        draw();
      } catch {
        statusMsg = "Invalid share code.";
        draw();
      }
    });
    root.querySelector("#save")?.addEventListener("click", () => void saveFormation());

    const pitch = root.querySelector("#pitch") as HTMLElement | null;
    pitch?.querySelectorAll<HTMLElement>(".db-pitch-dot--draggable").forEach((dot) => {
      const idx = Number(dot.dataset.idx);
      dot.addEventListener("click", (e) => {
        if (draggingIdx !== null) return;
        e.preventDefault();
        const cur = POSITION_TAGS.indexOf(slots[idx]!.positionTag as (typeof POSITION_TAGS)[number]);
        const next = POSITION_TAGS[(cur + 1) % POSITION_TAGS.length]!;
        slots[idx]!.positionTag = next;
        draw();
      });
      dot.addEventListener("pointerdown", (e) => startDrag(e, idx, pitch));
    });
  }

  function startDrag(e: PointerEvent, idx: number, pitch: HTMLElement) {
    e.preventDefault();
    draggingIdx = idx;
    const dot = e.currentTarget as HTMLElement;
    dot.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      if (draggingIdx === null) return;
      const rect = pitch.getBoundingClientRect();
      const relY = ((ev.clientX - rect.left) / rect.width) * 100;
      const relX = 100 - ((ev.clientY - rect.top) / rect.height) * 100;
      slots[idx] = {
        ...slots[idx]!,
        x: snap(relX),
        y: snap(relY),
      };
      dot.style.left = `${slots[idx]!.y}%`;
      dot.style.top = `${100 - slots[idx]!.x}%`;
    };

    const onUp = () => {
      dot.releasePointerCapture(e.pointerId);
      dot.removeEventListener("pointermove", onMove);
      dot.removeEventListener("pointerup", onUp);
      dot.removeEventListener("pointercancel", onUp);
      draggingIdx = null;
    };

    dot.addEventListener("pointermove", onMove);
    dot.addEventListener("pointerup", onUp);
    dot.addEventListener("pointercancel", onUp);
  }

  async function saveFormation() {
    if (slots.length !== MAX_SLOTS) {
      statusMsg = `Need exactly ${MAX_SLOTS} slots to save.`;
      draw();
      return;
    }
    statusMsg = "Saving…";
    draw();
    try {
      const body = {
        name: formationName,
        slots: slotsToFormationDefs(slots),
        backLineCount: countBackLine(slots),
        widthCategory: widthCategory(slots),
        eraTags: [] as string[],
      };
      const res = await fetch(`${API_BASE}/api/formations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Save failed (${res.status})`);
      }
      const saved = (await res.json()) as { id: string; name: string };
      shareCode = encodeFormationShare({
        name: formationName,
        slots: slots.map(({ positionTag, x, y }) => ({ positionTag, x, y })),
      });
      statusMsg = `Saved "${saved.name}" (${saved.id}). Share code ready below.`;
      draw();
    } catch (err) {
      statusMsg = err instanceof Error ? err.message : "Save failed";
      draw();
    }
  }

  draw();
}
