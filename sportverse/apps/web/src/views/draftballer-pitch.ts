/** Shared 3D pitch surface — markings SVG + wrapper used across DraftBaller views. */

/** Standard pitch markings (viewBox 0 0 100 130, goal at bottom). */
export function pitchMarkingsSvg(): string {
  return `
    <svg class="db-pitch-surface__markings" viewBox="0 0 100 130" preserveAspectRatio="none" aria-hidden="true">
      <rect x="2" y="2" width="96" height="126" fill="none" stroke="rgba(255,255,255,0.82)" stroke-width="0.55"/>
      <line x1="2" y1="65" x2="98" y2="65" stroke="rgba(255,255,255,0.72)" stroke-width="0.45"/>
      <circle cx="50" cy="65" r="11" fill="none" stroke="rgba(255,255,255,0.72)" stroke-width="0.45"/>
      <circle cx="50" cy="65" r="0.8" fill="rgba(255,255,255,0.85)"/>
      <!-- Top penalty area (opponent goal) -->
      <rect x="22" y="2" width="56" height="20" fill="none" stroke="rgba(255,255,255,0.72)" stroke-width="0.45"/>
      <rect x="34" y="2" width="32" height="7" fill="none" stroke="rgba(255,255,255,0.72)" stroke-width="0.45"/>
      <rect x="40" y="0.5" width="20" height="2.5" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="0.4"/>
      <!-- Bottom penalty area (home goal) -->
      <rect x="22" y="108" width="56" height="20" fill="none" stroke="rgba(255,255,255,0.72)" stroke-width="0.45"/>
      <rect x="34" y="121" width="32" height="7" fill="none" stroke="rgba(255,255,255,0.72)" stroke-width="0.45"/>
      <rect x="40" y="127" width="20" height="2.5" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="0.4"/>
      <!-- Penalty spots -->
      <circle cx="50" cy="16" r="0.7" fill="rgba(255,255,255,0.85)"/>
      <circle cx="50" cy="114" r="0.7" fill="rgba(255,255,255,0.85)"/>
      <!-- Corner arcs -->
      <path d="M 2 8 A 6 6 0 0 0 8 2" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="0.4"/>
      <path d="M 92 2 A 6 6 0 0 0 98 8" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="0.4"/>
      <path d="M 2 122 A 6 6 0 0 1 8 128" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="0.4"/>
      <path d="M 98 122 A 6 6 0 0 1 92 128" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="0.4"/>
    </svg>`;
}

export interface PitchSurfaceOpts {
  className?: string;
  ariaLabel?: string;
  /** Disable rotateX tilt (e.g. small previews). */
  flat?: boolean;
}

export interface PitchSlotChipOpts {
  ovr?: number | string;
  position: string;
  active?: boolean;
  empty?: boolean;
  className?: string;
  title?: string;
}

/** Glass circular slot — OVR + position text (no player photos). */
export function pitchSlotChipHtml(opts: PitchSlotChipOpts): string {
  const classes = [
    "db-tactical-chip",
    opts.active ? "db-tactical-chip--active" : "",
    opts.empty ? "db-tactical-chip--empty" : "",
    opts.className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  const label = opts.ovr != null ? String(opts.ovr) : "—";
  const title = opts.title ? ` title="${opts.title.replace(/"/g, "&quot;")}"` : "";
  return `
    <div class="${classes}"${title}>
      <span class="db-tactical-chip__ovr">${label}</span>
      <span class="db-tactical-chip__pos">${opts.position}</span>
    </div>`;
}

/** Wrap inner pitch content (slots, dots) in the shared 3D surface. */
export function pitchSurfaceHtml(inner: string, opts: PitchSurfaceOpts = {}): string {
  const extra = opts.className ? ` ${opts.className}` : "";
  const flat = opts.flat ? " db-pitch-surface--flat" : "";
  const label = opts.ariaLabel ? ` aria-label="${opts.ariaLabel}"` : "";
  return `
    <div class="db-pitch-surface${extra}${flat}"${label}>
      <div class="db-pitch-surface__stage">
        <div class="db-pitch-surface__grass">
          ${pitchMarkingsSvg()}
          ${inner}
        </div>
      </div>
    </div>`;
}
