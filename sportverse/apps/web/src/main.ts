import "./styles.css";
import "./styles/draftballer.css";
import { platform } from "@sportverse/platform";
import { renderHub } from "./views/hub.js";
import { renderQuiz } from "./views/quiz.js";
import { renderFootballIQ } from "./views/football-iq.js";
import { renderGoalkeeper } from "./views/goalkeeper.js";
import { renderDraftballerHub } from "./views/draftballer-hub.js";
import { renderDraftballerArchitect, renderDraftballerQuick } from "./views/draftballer-architect.js";
import { renderDraftballerRoom } from "./views/draftballer-room.js";

const app = document.getElementById("app")!;

type Route =
  | "hub"
  | "quiz"
  | "football-iq"
  | "goalkeeper"
  | "draftballer"
  | "draftballer-architect"
  | "draftballer-room";

function parseRoute(): { route: Route; param?: string; sub?: string } {
  const hash = location.hash.replace(/^#\/?/, "") || "hub";
  const parts = hash.split("/");
  const head = parts[0] ?? "hub";

  if (head === "draftballer") {
    if (parts[1] === "architect") return { route: "draftballer-architect" };
    if (parts[1] === "room") return { route: "draftballer-room" };
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
  if (route === "hub" || route === "draftballer") {
    location.hash = `#/${route}`;
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

async function render() {
  const { route, param, sub } = parseRoute();
  platform.getProfile();

  try {
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
        renderDraftballerRoom(app, navigate);
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

export { navigate };
