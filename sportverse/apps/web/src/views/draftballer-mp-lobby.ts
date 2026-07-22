import type { DraftFormat } from "@sportverse/draftballer-types";
import { createDraftRoom, isDraftApiEnabled } from "../lib/draft-api.js";
import { connectDraftSocket, socketCreateRoom } from "../lib/draft-socket.js";
import { bindEliteMotion } from "../lib/elite-motion.js";
import { keepieLoaderHtml } from "../lib/keepie-loader.js";

type Navigate = (route: string, param?: string) => void;

const FORMATS: { id: DraftFormat; label: string; hint: string }[] = [
  { id: "snake", label: "Snake", hint: "Classic alternating pick order" },
  { id: "linear", label: "Linear", hint: "Same order every round" },
  { id: "auction", label: "Auction", hint: "Budget bidding on nominated players" },
  { id: "blind", label: "Blind", hint: "Simultaneous hidden picks each round" },
];

function formatChipHtml(format: DraftFormat, active: DraftFormat): string {
  return FORMATS.map(
    (f) =>
      `<button type="button" class="db-lobby-chip${f.id === active ? " db-lobby-chip--active" : ""}" data-format="${f.id}" title="${f.hint}">${f.label.toUpperCase()}</button>`,
  ).join("");
}

function lobbyCardHtml(opts: {
  title: string;
  meta: string;
  format: string;
  players: string;
  action: string;
  actionId: string;
  accent?: boolean;
}): string {
  return `
    <article class="db-lobby-card db-glass${opts.accent ? " db-lobby-card--accent" : ""}">
      <div class="db-lobby-card__main">
        <div class="db-lobby-card__icon" aria-hidden="true">◈</div>
        <div>
          <h4 class="db-lobby-card__title">${opts.title}</h4>
          <p class="db-lobby-card__meta">${opts.meta}</p>
          <p class="db-lobby-card__format">${opts.format}</p>
        </div>
      </div>
      <div class="db-lobby-card__stats">
        <div class="db-lobby-card__stat">
          <span class="db-label-caps">Players</span>
          <span class="db-lobby-card__stat-val">${opts.players}</span>
        </div>
      </div>
      <button class="db-btn-pitch db-lobby-card__join" id="${opts.actionId}">${opts.action}</button>
    </article>`;
}

export function renderDraftballerMpLobby(root: HTMLElement, navigate: Navigate) {
  const modeJson = sessionStorage.getItem("db_mode");
  const mode = modeJson ? (JSON.parse(modeJson) as { id: string; title?: string }) : { id: "all-time-any" };
  let format: DraftFormat = (sessionStorage.getItem("db_mp_format") as DraftFormat) ?? "snake";
  const apiOn = isDraftApiEnabled();

  function bindEvents(status = "") {
    root.querySelector("#back")?.addEventListener("click", () => navigate("draftballer", "architect"));
    root.querySelector("#quick-match")?.addEventListener("click", () => void createRoom());
    root.querySelector("#create-private")?.addEventListener("click", () => void createRoom());
    root.querySelector("#join")?.addEventListener("click", () => {
      const code = (root.querySelector("#code") as HTMLInputElement).value.trim().toUpperCase();
      if (!code) return;
      sessionStorage.setItem("db_mp_code", code);
      sessionStorage.removeItem("db_mp_host");
      sessionStorage.setItem("db_mp_format", format);
      navigate("draftballer", `room/${code}`);
    });
    root.querySelectorAll<HTMLButtonElement>(".db-lobby-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        format = chip.dataset.format as DraftFormat;
        sessionStorage.setItem("db_mp_format", format);
        draw(status);
      });
    });
  }

  function draw(status = "") {
    const formatLabel = FORMATS.find((f) => f.id === format)?.label ?? format;
    root.innerHTML = `
      <div class="shell db-root db-lobby-page">
        <button class="btn btn--ghost" id="back">← Architect</button>

        <header class="db-lobby-header">
          <div class="db-lobby-header__top">
            <span class="db-lobby-header__bar" aria-hidden="true"></span>
            <span class="db-label-caps db-lobby-header__live db-soft-pulse">Live Multiplayer</span>
          </div>
          <h1 class="db-lobby-header__title">Draft Lobby Hub</h1>
          <p class="db-lobby-header__sub">${mode.title ?? mode.id} · real-time drafting sessions</p>
          <div class="db-lobby-header__actions">
            <button class="db-btn-pitch" id="quick-match">Quick Match</button>
            <button class="db-lobby-secondary" id="create-private">Create Private Room</button>
          </div>
        </header>

        <div class="db-lobby-layout">
          <aside class="db-lobby-aside">
            <div class="db-lobby-filters db-glass">
              <h3 class="db-label-caps db-lobby-filters__title">Search Filters</h3>
              <label class="db-label-caps" for="code">Lobby Code</label>
              <input id="code" class="db-lobby-input" placeholder="ABC123" maxlength="8" autocomplete="off" />
              <p class="db-label-caps db-lobby-filters__title db-lobby-filters__title--spaced">Draft Format</p>
              <div class="db-lobby-chips">${formatChipHtml(format, format)}</div>
            </div>

            <div class="db-lobby-status db-glass">
              <div class="db-lobby-status__head">
                <h3 class="db-label-caps">Server Status</h3>
                <span class="db-lobby-status__pill${apiOn ? " db-lobby-status__pill--on" : ""}">${apiOn ? "API ON" : "OFFLINE"}</span>
              </div>
              <div class="db-lobby-status__row">
                <span>Mode</span>
                <span>${mode.title ?? mode.id}</span>
              </div>
              <div class="db-lobby-status__row">
                <span>Format</span>
                <span>${formatLabel}</span>
              </div>
              <div class="db-lobby-status__row">
                <span>Transport</span>
                <span>${apiOn ? "WebSocket + REST" : "Local preview"}</span>
              </div>
            </div>
          </aside>

          <section class="db-lobby-main">
            <div class="db-lobby-main__head">
              <h2 class="db-label-caps db-lobby-main__tab">Public Lobbies</h2>
              <span class="db-lobby-main__meta">RESULT_SET: 2_ACTIVE</span>
            </div>

            <div class="db-lobby-list">
              ${lobbyCardHtml({
                title: "Create Your Own",
                meta: `${mode.title ?? mode.id} · ${formatLabel} draft`,
                format: `${formatLabel.toUpperCase()} · 2 drafters · 11 squad`,
                players: "01/02",
                action: "JOIN",
                actionId: "quick-match-card",
                accent: true,
              })}
              ${lobbyCardHtml({
                title: "Join by Code",
                meta: "Enter a lobby code to enter an existing room",
                format: `${formatLabel.toUpperCase()} · PRIVATE`,
                players: "—/02",
                action: "ENTER",
                actionId: "join",
              })}
            </div>

            ${
              status === "Creating room…"
                ? `<div class="db-keepie-overlay db-keepie-overlay--lobby">${keepieLoaderHtml({ size: 64, label: "Creating" })}</div>`
                : status
                  ? `<p class="db-lobby-status-msg">${status}</p>`
                  : ""
            }
          </section>
        </div>
      </div>`;

    bindEvents(status);
    root.querySelector("#quick-match-card")?.addEventListener("click", () => void createRoom());
    const pageRoot = root.querySelector(".db-root") as HTMLElement | null;
    if (pageRoot) bindEliteMotion(pageRoot, { scan: "wash" });
  }

  async function createRoom() {
    draw("Creating room…");
    sessionStorage.setItem("db_mp_format", format);

    if (apiOn) {
      try {
        const socket = connectDraftSocket();
        if (socket) {
          const ack = await socketCreateRoom(socket, { modeId: mode.id, format, drafters: 2, squadSize: 11 });
          socket.disconnect();
          if (ack.ok && ack.code) {
            sessionStorage.setItem("db_mp_code", ack.code);
            sessionStorage.setItem("db_mp_host", "1");
            navigate("draftballer", `room/${ack.code}`);
            return;
          }
        }
        const created = await createDraftRoom({ modeId: mode.id, format, drafters: 2, squadSize: 11 });
        sessionStorage.setItem("db_mp_code", created.code);
        sessionStorage.setItem("db_mp_host", "1");
        navigate("draftballer", `room/${created.code}`);
        return;
      } catch (e) {
        draw(e instanceof Error ? e.message : "Create failed");
        return;
      }
    }

    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    sessionStorage.setItem("db_mp_code", code);
    sessionStorage.setItem("db_mp_host", "1");
    navigate("draftballer", `room/${code}`);
  }

  draw();
}
