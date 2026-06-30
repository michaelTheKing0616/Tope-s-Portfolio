import "./styles.css";
import { platform } from "@sportverse/platform";
import { renderHub } from "./views/hub.js";
import { renderQuiz } from "./views/quiz.js";
import { renderFootballIQ } from "./views/football-iq.js";
import { renderGoalkeeper } from "./views/goalkeeper.js";

const app = document.getElementById("app")!;

type Route = "hub" | "quiz" | "football-iq" | "goalkeeper";

function parseRoute(): { route: Route; param?: string } {
  const hash = location.hash.replace(/^#\/?/, "") || "hub";
  const [route, param] = hash.split("/") as [Route, string?];
  if (["hub", "quiz", "football-iq", "goalkeeper"].includes(route)) {
    return { route, param };
  }
  return { route: "hub" };
}

function navigate(route: Route, param?: string) {
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
  const { route, param } = parseRoute();
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
