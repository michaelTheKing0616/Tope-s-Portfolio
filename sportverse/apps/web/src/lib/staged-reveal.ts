import type { RatedPlayerCard } from "@sportverse/draftballer-types";
import { playDraftSound } from "./draft-sound.js";
import { playerCardHtml } from "../views/draftballer-hub.js";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Blind-mode pack opening: face-down cards flip ascending OVR so the highest lands last.
 */
export function mountStagedReveal(
  container: HTMLElement,
  cards: RatedPlayerCard[],
  options?: { delayMs?: number },
): void {
  const delay = options?.delayMs ?? 420;
  // Ascending OVR → highest revealed last (pack-opening climax).
  const ordered = [...cards].sort((a, b) => a.ovr - b.ovr);
  const reduced = prefersReducedMotion();

  container.innerHTML = `
    <div class="db-reveal-grid" role="list">
      ${ordered
        .map(
          (c, i) => `
        <div class="db-reveal-slot" data-reveal-i="${i}" role="listitem">
          <div class="db-reveal-card db-reveal-card--back" aria-hidden="true">
            <span class="db-reveal-q">?</span>
          </div>
          <div class="db-reveal-card db-reveal-card--front">${playerCardHtml(c, true)}</div>
        </div>`,
        )
        .join("")}
    </div>`;

  if (reduced) {
    container.querySelectorAll(".db-reveal-slot").forEach((el) => el.classList.add("db-reveal-slot--open"));
    playDraftSound("crowd");
    return;
  }

  ordered.forEach((card, i) => {
    window.setTimeout(() => {
      const slot = container.querySelector(`[data-reveal-i="${i}"]`);
      slot?.classList.add("db-reveal-slot--open");
      if (card.tier === "prismatic" || card.fameTier === "icon") {
        slot?.classList.add("db-reveal-slot--sting");
        playDraftSound("crowd");
      } else {
        playDraftSound("flip");
      }
    }, delay * (i + 1));
  });
}
