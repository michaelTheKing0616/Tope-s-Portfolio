export interface CalibrationEntry {
  playerId: string;
  nudge: number;
  reason: string;
  evidenceRef: string;
  reviewerId: string;
  at: string;
}

const MAX_NUDGE = 3;
const LOW_CONFIDENCE_THRESHOLD = 0.72;

let cache: CalibrationEntry[] = [];

export function setCalibrationData(entries: CalibrationEntry[]): void {
  cache = entries;
}

/** Community Calibration Panel — bounded ±3 for low-confidence players only (§4.3). */
export function communityCalibrationNudge(playerId: string, confidence: number): {
  nudge: number;
  entry?: CalibrationEntry;
} {
  if (confidence >= LOW_CONFIDENCE_THRESHOLD) return { nudge: 0 };
  const entry = cache.find((e) => e.playerId === playerId);
  if (!entry) return { nudge: 0 };
  const nudge = Math.max(-MAX_NUDGE, Math.min(MAX_NUDGE, entry.nudge));
  return { nudge, entry };
}

export function setCalibrationDataForTests(entries: CalibrationEntry[]): void {
  cache = entries;
}

export { LOW_CONFIDENCE_THRESHOLD, MAX_NUDGE };
