import "./styles.css";
import "./styles/draftballer.css";
import { platform } from "@sportverse/platform";
import { ensureExtendedDataLoaded, poolCounts } from "@sportverse/sports-db";
import { renderHub } from "./views/hub.js";
import { renderQuiz } from "./views/quiz.js";
import { renderFootballIQ } from "./views/football-iq.js";
import { renderGoalkeeper } from "./views/goalkeeper.js";
import { renderDraftballerHub } from "./views/draftballer-hub.js";
import { renderDraftballerArchitect, renderDraftballerQuick } from "./views/draftballer-architect.js";
import { renderDraftballerRoom } from "./views/draftballer-room.js";
import { renderDraftballerWheel } from "./views/draftballer-wheel.js";
import { renderDraftballerSeason } from "./views/draftballer-season.js";
import { renderDraftballerDaily } from "./views/draftballer-daily.js";
import { renderDraftballerH2h } from "./views/draftballer-h2h.js";
import { renderDraftballerMpLobby } from "./views/draftballer-mp-lobby.js";
import { renderDraftballerMpRoom } from "./views/draftballer-mp-room.js";
import { renderDraftballerUcl, renderDraftballerImport } from "./views/draftballer-ucl.js";
import { renderDraftballerSimSetup } from "./views/draftballer-sim-setup.js";
import { renderDraftballerEraLab } from "./views/draftballer-era-lab.js";
import { renderDraftballerSquadBuilder } from "./views/draftballer-squad-builder.js";
import { renderDraftballerFormationCanvas } from "./views/draftballer-formation-canvas.js";
import { renderDraftballerAuction } from "./views/draftballer-auction.js";
import { renderDraftballerBlind } from "./views/draftballer-blind.js";
import { renderDraftballerMiniLeague } from "./views/draftballer-mini-league.js";
import { setAwardsData } from "@sportverse/rating-engine";
import { getAwards, getIconicMoments } from "@sportverse/sports-db";

const app = document.getElementById("app")!;

type Route =
  | "hub"
  | "quiz"
  | "football-iq"
  | "goalkeeper"
  | "draftballer"
  | "draftballer-architect"
  | "draftballer-room"
  | "draftballer-wheel"
  | "draftballer-season"
  | "draftballer-daily"
  | "draftballer-h2h"
  | "draftballer-mp-lobby"
  | "draftballer-mp-room"
  | "draftballer-ucl"
  | "draftballer-import"
  | "draftballer-sim-setup"
  | "draftballer-era-lab"
  | "draftballer-squad-builder"
  | "draftballer-formation-canvas"
  | "draftballer-auction"
  | "draftballer-blind"
  | "draftballer-mini-league";

function parseRoute(): { route: Route; param?: string; sub?: string } {
  const hash = location.hash.replace(/^#\/?/, "") || "hub";
  const parts = hash.split("/");
  const head = parts[0] ?? "hub";

  if (head === "draftballer") {
    if (parts[1] === "architect") return { route: "draftballer-architect" };
    if (parts[1] === "room" && parts[2]) return { route: "draftballer-mp-room", param: parts[2] };
    if (parts[1] === "room") return { route: "draftballer-room" };
    if (parts[1] === "wheel") return { route: "draftballer-wheel" };
    if (parts[1] === "season") return { route: "draftballer-season" };
    if (parts[1] === "daily") return { route: "draftballer-daily" };
    if (parts[1] === "h2h") return { route: "draftballer-h2h" };
    if (parts[1] === "mp-lobby") return { route: "draftballer-mp-lobby" };
    if (parts[1] === "ucl") return { route: "draftballer-ucl" };
    if (parts[1] === "import" && parts[2]) return { route: "draftballer-import", param: parts[2] };
    if (parts[1] === "sim-setup") return { route: "draftballer-sim-setup" };
    if (parts[1] === "era-lab") return { route: "draftballer-era-lab" };
    if (parts[1] === "squad-builder") return { route: "draftballer-squad-builder" };
    if (parts[1] === "formation-canvas") return { route: "draftballer-formation-canvas" };
    if (parts[1] === "mode" && parts[2]) {
      return { route: "draftballer", sub: parts[2] };
    }
    return { route: "draftballer" };
  }

  if (["hub", "quiz", "football-iq", "goalkeeper"].includes(head)) {
    return { route: head as Route, param: parts[1] };
  }
  return { route: "hub" };
}

function navigate(route: string, param?: string) {
  if (route === "hub") {
    location.hash = "#/hub";
    return;
  }
  if (route === "draftballer" && !param) {
    location.hash = "#/draftballer";
    return;
  }
  location.hash = param ? `#/${route}/${param}` : `#/${route}`;
}

function showError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  app.innerHTML = `
    <div class="shell">
      <div class="result result--bad">
        <strong>Something went wrong</strong>
        <p>${message}</p>
        <button class="btn" id="reload">Reload</button>
      </div>
    </div>`;
  app.querySelector("#reload")?.addEventListener("click", () => location.reload());
}

function showLoading(label: string) {
  app.innerHTML = `
    <div class="shell db-root">
      <p class="db-hero__label">${label}</p>
      <p style="color:var(--db-muted)">Loading player database…</p>
    </div>`;
}

const DRAFTBALLER_ROUTES: Route[] = [
  "draftballer",
  "draftballer-architect",
  "draftballer-room",
  "draftballer-wheel",
  "draftballer-season",
  "draftballer-daily",
  "draftballer-h2h",
  "draftballer-mp-lobby",
  "draftballer-mp-room",
  "draftballer-ucl",
  "draftballer-import",
  "draftballer-sim-setup",
  "draftballer-era-lab",
  "draftballer-squad-builder",
  "draftballer-formation-canvas",
  "draftballer-auction",
  "draftballer-blind",
  "draftballer-mini-league",
];

async function render() {
  const { route, param, sub } = parseRoute();
  platform.getProfile();

  try {
    if (DRAFTBALLER_ROUTES.includes(route)) {
      showLoading("DRAFTBALLER");
      const base = import.meta.env.BASE_URL ?? "/";
      await ensureExtendedDataLoaded(base);
      setAwardsData(getAwards(), getIconicMoments());
    }

    switch (route) {
      case "quiz":
        renderQuiz(app, param, navigate);
        break;
      case "football-iq":
        renderFootballIQ(app, navigate);
        break;
      case "goalkeeper":
        renderGoalkeeper(app, navigate);
        break;
      case "draftballer":
        if (sub) renderDraftballerQuick(app, sub, navigate);
        else renderDraftballerHub(app, navigate);
        break;
      case "draftballer-architect":
        renderDraftballerArchitect(app, navigate);
        break;
      case "draftballer-room":
        renderDraftballerRoom(app, navigate, param);
        break;
      case "draftballer-wheel":
        renderDraftballerWheel(app, navigate);
        break;
      case "draftballer-season":
        renderDraftballerSeason(app, navigate);
        break;
      case "draftballer-daily":
        renderDraftballerDaily(app, navigate);
        break;
      case "draftballer-h2h":
        renderDraftballerH2h(app, navigate);
        break;
      case "draftballer-mp-lobby":
        renderDraftballerMpLobby(app, navigate);
        break;
      case "draftballer-mp-room":
        renderDraftballerMpRoom(app, param ?? "LOCAL", navigate);
        break;
      case "draftballer-ucl":
        renderDraftballerUcl(app, navigate);
        break;
      case "draftballer-import":
        renderDraftballerImport(app, param ?? "", navigate);
        break;
      case "draftballer-sim-setup":
        renderDraftballerSimSetup(app, navigate, "season");
        break;
      case "draftballer-era-lab":
        renderDraftballerEraLab(app, navigate);
        break;
      case "draftballer-squad-builder":
        renderDraftballerSquadBuilder(app, navigate);
        break;
      case "draftballer-formation-canvas":
        renderDraftballerFormationCanvas(app, navigate);
        break;
      case "draftballer-auction":
        renderDraftballerAuction(app, navigate);
        break;
      case "draftballer-blind":
        renderDraftballerBlind(app, navigate);
        break;
      case "draftballer-mini-league":
        renderDraftballerMiniLeague(app, navigate);
        break;
      default:
        await renderHub(app, navigate);
    }
  } catch (err) {
    console.error("[SPORTVERSE]", err);
    showError(err);
  }
}

window.addEventListener("hashchange", () => {
  void render();
});
void render();

export { navigate, poolCounts };
