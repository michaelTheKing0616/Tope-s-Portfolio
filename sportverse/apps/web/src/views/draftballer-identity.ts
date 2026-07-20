import type { TacticalIdentity } from "@sportverse/draftballer-types";
import { tacticalIdentityHint } from "@sportverse/match-sim";

const IDENTITIES: TacticalIdentity[] = [
  "balanced",
  "possession",
  "high_press",
  "counter",
  "route_one",
];

/** Single-screen tactical identity picker HTML (post-draft, pre-season). */
export function identityPickerHtml(selected: TacticalIdentity = "balanced"): string {
  return `
    <div class="panel db-identity-picker" style="margin:16px 0;text-align:left">
      <p class="db-hero__label">Tactical Identity</p>
      <p style="font-size:0.85rem;color:var(--db-muted);margin:0 0 10px">One more choice before the season — how will this XI play?</p>
      <select id="identity" class="btn btn--ghost btn--block">
        ${IDENTITIES.map(
          (i) =>
            `<option value="${i}" ${i === selected ? "selected" : ""}>${i.replace(/_/g, " ")}</option>`,
        ).join("")}
      </select>
      <p id="identity-hint" style="font-size:0.8rem;color:var(--db-gold);margin-top:8px">${tacticalIdentityHint(selected)}</p>
    </div>`;
}

export function bindIdentityPicker(
  root: HTMLElement,
  onChange?: (identity: TacticalIdentity) => void,
): () => TacticalIdentity {
  let current: TacticalIdentity = "balanced";
  const select = root.querySelector("#identity") as HTMLSelectElement | null;
  if (select) {
    current = select.value as TacticalIdentity;
    select.addEventListener("change", () => {
      current = select.value as TacticalIdentity;
      const hint = root.querySelector("#identity-hint");
      if (hint) hint.textContent = tacticalIdentityHint(current);
      onChange?.(current);
    });
  }
  return () => current;
}
