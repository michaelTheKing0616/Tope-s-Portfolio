import type { DraftFormat } from "@sportverse/draftballer-types";
import { createDraftRoom, isDraftApiEnabled } from "../lib/draft-api.js";
import { connectDraftSocket, socketCreateRoom } from "../lib/draft-socket.js";

type Navigate = (route: string, param?: string) => void;

const FORMATS: { id: DraftFormat; label: string; hint: string }[] = [
  { id: "snake", label: "Snake", hint: "Classic alternating pick order" },
  { id: "linear", label: "Linear", hint: "Same order every round" },
  { id: "auction", label: "Auction", hint: "Budget bidding on nominated players" },
  { id: "blind", label: "Blind", hint: "Simultaneous hidden picks each round" },
];

export function renderDraftballerMpLobby(root: HTMLElement, navigate: Navigate) {
  const modeJson = sessionStorage.getItem("db_mode");
  const mode = modeJson ? (JSON.parse(modeJson) as { id: string; title?: string }) : { id: "all-time-any" };
  let format: DraftFormat = (sessionStorage.getItem("db_mp_format") as DraftFormat) ?? "snake";
  const apiOn = isDraftApiEnabled();

  function draw(status = "") {
    root.innerHTML = `
      <div class="shell db-root">
        <button class="btn btn--ghost" id="back">← Architect</button>
        <header class="db-hero">
          <p class="db-hero__label">Multiplayer</p>
          <h1 class="db-hero__title">DRAFT ROOM</h1>
          <p class="db-hero__sub">${mode.title ?? mode.id} · ${apiOn ? "Live API + WebSocket" : "Local preview (set VITE_API_URL for live rooms)"}</p>
        </header>
        <div class="panel">
          <label>Draft format</label>
          <select id="format" class="btn btn--ghost btn--block">
            ${FORMATS.map((f) => `<option value="${f.id}" ${f.id === format ? "selected" : ""}>${f.label} — ${f.hint}</option>`).join("")}
          </select>
          <button class="btn" id="create" style="width:100%;margin-top:12px">Create Room</button>
          <label style="display:block;margin-top:12px">Join with code</label>
          <input id="code" class="btn btn--ghost btn--block" placeholder="ABC123" maxlength="8" />
          <button class="btn btn--ghost" id="join" style="width:100%;margin-top:8px">Join Room</button>
          <p id="status" style="color:var(--db-muted);margin-top:12px;font-size:0.85rem">${status}</p>
        </div>
      </div>`;

    root.querySelector("#back")?.addEventListener("click", () => navigate("draftballer", "architect"));
    root.querySelector("#format")?.addEventListener("change", (e) => {
      format = (e.target as HTMLSelectElement).value as DraftFormat;
      sessionStorage.setItem("db_mp_format", format);
    });

    root.querySelector("#create")?.addEventListener("click", () => void createRoom());
    root.querySelector("#join")?.addEventListener("click", () => {
      const code = (root.querySelector("#code") as HTMLInputElement).value.trim().toUpperCase();
      if (!code) return;
      sessionStorage.setItem("db_mp_code", code);
      sessionStorage.removeItem("db_mp_host");
      sessionStorage.setItem("db_mp_format", format);
      navigate("draftballer", `room/${code}`);
    });
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
