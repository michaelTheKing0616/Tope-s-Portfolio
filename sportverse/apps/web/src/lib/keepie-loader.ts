/**
 * Keepie-uppie idle loader — lo-fi SVG loop (~1s).
 * Silhouette footballer juggling; ball arcs, soft shadow, tiny body bob.
 * Use on every loading / waiting surface in the app.
 */

export type KeepieLoaderSize = 48 | 64 | 96;

export interface KeepieLoaderOpts {
  size?: KeepieLoaderSize;
  /** Caps label under the SVG (default "Loading"). Pass "" to hide. */
  label?: string;
  className?: string;
  /** Secondary status line (e.g. chunk progress). */
  detail?: string;
  /** Optional DOM id for live-updating the detail line. */
  detailId?: string;
}

/** Inline SVG markup for embedding in views. */
export function keepieLoaderHtml(opts: KeepieLoaderOpts = {}): string {
  const size = opts.size ?? 64;
  const label = opts.label === undefined ? "Loading" : opts.label;
  const className = ["db-keepie", opts.className].filter(Boolean).join(" ");
  const aria = label || opts.detail || "Loading";
  return `
    <div class="${className}" role="status" aria-live="polite" aria-label="${aria}">
      <svg class="db-keepie__svg" width="${size}" height="${size}" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <ellipse class="db-keepie__shadow" cx="48" cy="86" rx="16" ry="3.5" />
        <g class="db-keepie__player">
          <circle class="db-keepie__head" cx="48" cy="28" r="7" />
          <rect class="db-keepie__torso" x="41" y="34" width="14" height="20" rx="3" />
          <path class="db-keepie__arm db-keepie__arm-l" d="M41 38 L32 50" />
          <path class="db-keepie__arm db-keepie__arm-r" d="M55 38 L64 50" />
          <path class="db-keepie__leg-plant" d="M45 54 L42 78" />
          <g class="db-keepie__kick">
            <path class="db-keepie__leg-kick" d="M51 54 L58 74" />
            <circle class="db-keepie__boot-kick" cx="60" cy="76" r="3.2" />
          </g>
          <circle class="db-keepie__boot-plant" cx="41" cy="80" r="3.2" />
        </g>
        <g class="db-keepie__ball">
          <circle cx="0" cy="0" r="5.5" class="db-keepie__ball-body" />
          <path class="db-keepie__ball-mark" d="M-2.5,-3.5 L2.5,-3.5 L0,0 Z" />
        </g>
      </svg>
      ${label ? `<span class="db-keepie__label db-label-caps">${label}</span>` : ""}
      ${
        opts.detail != null
          ? `<p class="db-keepie__detail"${opts.detailId ? ` id="${opts.detailId}"` : ""}>${opts.detail}</p>`
          : ""
      }
    </div>`;
}

/** Full-page centered loader (route boot / heavy fetches). */
export function keepiePageLoaderHtml(opts: {
  title: string;
  detail?: string;
  detailId?: string;
  showProgress?: boolean;
}): string {
  return `
    <div class="shell db-root db-keepie-page">
      <p class="db-hero__label">${opts.title}</p>
      ${keepieLoaderHtml({
        size: 96,
        label: "Loading",
        detail: opts.detail,
        detailId: opts.detailId,
      })}
      ${
        opts.showProgress
          ? `<div class="db-load-bar" aria-hidden="true"><div class="db-load-bar__fill" id="db-load-fill" style="width:8%"></div></div>`
          : ""
      }
    </div>`;
}
