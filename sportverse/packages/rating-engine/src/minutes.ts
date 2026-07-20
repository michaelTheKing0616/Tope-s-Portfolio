import type { PlayerSeasonStat } from "@sportverse/sports-db";

/**
 * Below this minutes-per-appearance (with a real sample of apps) the row is
 * treated as corrupted source data, not a genuine cameo role.
 * The Transfermarkt archive holds thousands of rows like "33 apps, 144 min"
 * (~4 min/game) for regular starters, which craters PAC/PHY sub-metrics.
 */
export const MIN_PLAUSIBLE_MPA = 25;
/** Imputed minutes-per-appearance for corrupted rows — typical rotation starter. */
export const IMPUTED_MPA = 72;
/** Hard ceiling — a football appearance cannot exceed ~120 minutes + stoppage. */
export const MAX_PLAUSIBLE_MPA = 120;
/** Rows with fewer appearances than this keep their minutes as-is (real cameos). */
const MIN_APPS_FOR_REPAIR = 5;

/** Repair implausible minutes on a single season row (returns a copy when changed). */
export function repairSeasonMinutes(row: PlayerSeasonStat): PlayerSeasonStat {
  const apps = row.appearances;
  if (!apps || apps < 1) return row;
  const mpa = (row.minutes ?? 0) / apps;
  if (!row.minutes || (apps >= MIN_APPS_FOR_REPAIR && mpa < MIN_PLAUSIBLE_MPA)) {
    return { ...row, minutes: apps * IMPUTED_MPA };
  }
  if (mpa > MAX_PLAUSIBLE_MPA) {
    return { ...row, minutes: apps * MAX_PLAUSIBLE_MPA };
  }
  return row;
}

export function repairSeasonMinutesRows(rows: PlayerSeasonStat[]): PlayerSeasonStat[] {
  return rows.map(repairSeasonMinutes);
}
