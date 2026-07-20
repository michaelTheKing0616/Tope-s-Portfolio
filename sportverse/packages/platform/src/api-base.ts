/** Resolve SPORTVERSE API base URL — empty in production static embed when unset. */
export function resolveApiBase(): string {
  const env =
    typeof import.meta !== "undefined"
      ? (import.meta as ImportMeta & { env?: { VITE_API_URL?: string; DEV?: boolean } }).env?.VITE_API_URL
      : undefined;

  const trimmed = env?.trim().replace(/\/$/, "");
  if (trimmed) return trimmed;

  const isDev =
    typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true;

  if (isDev) return "http://localhost:8792";

  return "";
}

export function isApiConfigured(base = resolveApiBase()): boolean {
  return base.length > 0;
}
