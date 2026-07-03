/**
 * Runtime loader for archive-fitted Engine v4 calibration (engine-calibration.json).
 */

export interface EngineCalibrationPayload {
  version: number;
  aggregationBridge: {
    alphaIntercept: number;
    alphaSlope: number;
    betaIntercept: number;
    betaSlope: number;
  };
  leagueBridging: {
    scalingBase: number;
    scalingSlope: number;
    scalingMin: number;
    scalingMax: number;
    shiftSlope: number;
    shiftMin: number;
    shiftMax: number;
  };
}

let cached: EngineCalibrationPayload | null = null;

/** Expert priors when calibration file is absent (Statistical Rigor Standard §6). */
export const EXPERT_PRIOR_CALIBRATION: EngineCalibrationPayload = {
  version: 0,
  aggregationBridge: {
    alphaIntercept: 0,
    alphaSlope: 0.85,
    betaIntercept: 0,
    betaSlope: 0.72,
  },
  leagueBridging: {
    scalingBase: 0.9,
    scalingSlope: 0.25,
    scalingMin: 0.75,
    scalingMax: 1.15,
    shiftSlope: 4,
    shiftMin: -3,
    shiftMax: 3,
  },
};

export function setEngineCalibration(data: EngineCalibrationPayload | null): void {
  cached = data;
}

export function getEngineCalibration(): EngineCalibrationPayload {
  return cached ?? EXPERT_PRIOR_CALIBRATION;
}

export async function loadEngineCalibrationFromFetch(baseUrl: string): Promise<void> {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  try {
    const res = await fetch(`${base}data/engine-calibration.json`);
    if (!res.ok) {
      setEngineCalibration(null);
      return;
    }
    const json = (await res.json()) as EngineCalibrationPayload;
    setEngineCalibration(json);
  } catch {
    setEngineCalibration(null);
  }
}
