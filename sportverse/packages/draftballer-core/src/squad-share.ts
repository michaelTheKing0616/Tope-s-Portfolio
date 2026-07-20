import type { DraftModeConfig, RatedPlayerCard, SavedSquadPayload } from "@sportverse/draftballer-types";

export interface SharedSquadPayload extends SavedSquadPayload {
  name: string;
  cards: Pick<RatedPlayerCard, "playerId" | "name" | "ovr" | "position">[];
}

function checksum(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Export squad as share code (base64 JSON + checksum). */
export function encodeSquadShare(payload: SharedSquadPayload): string {
  const json = JSON.stringify(payload);
  const b64 = typeof btoa !== "undefined" ? btoa(json) : Buffer.from(json, "utf8").toString("base64");
  return `${checksum(b64)}.${b64}`;
}

export function decodeSquadShare(code: string): SharedSquadPayload {
  const [sum, b64] = code.split(".");
  if (!sum || !b64 || checksum(b64) !== sum) throw new Error("Invalid squad share code");
  const json =
    typeof atob !== "undefined" ? atob(b64) : Buffer.from(b64, "base64").toString("utf8");
  return JSON.parse(json) as SharedSquadPayload;
}

export function squadShareUrl(code: string): string {
  const base = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";
  return `${base}#/draftballer/import/${encodeURIComponent(code)}`;
}

/** Serialize DraftModeConfig as share code (checksum.base64). */
export function encodeModeShare(mode: DraftModeConfig): string {
  const json = JSON.stringify(mode);
  const b64 = typeof btoa !== "undefined" ? btoa(json) : Buffer.from(json, "utf8").toString("base64");
  return `${checksum(b64)}.${b64}`;
}

export function decodeModeShare(code: string): DraftModeConfig {
  const decoded = decodeURIComponent(code);
  const [sum, b64] = decoded.split(".");
  if (!sum || !b64 || checksum(b64) !== sum) throw new Error("Invalid mode share code");
  const json =
    typeof atob !== "undefined" ? atob(b64) : Buffer.from(b64, "base64").toString("utf8");
  return JSON.parse(json) as DraftModeConfig;
}

export function modeShareUrl(code: string): string {
  const base = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";
  return `${base}#/draftballer/mode-code/${encodeURIComponent(code)}`;
}
