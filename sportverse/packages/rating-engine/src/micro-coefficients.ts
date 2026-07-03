import type { PlayerAttributes, Position } from "@sportverse/draftballer-types";
import type { SubMetricKey, SubMetricVector } from "./sub-metrics.js";

export const FLOOR_WEIGHT = 0.02;

type MacroKey = keyof PlayerAttributes;

/** Published micro-coefficient table — every sub-metric floor-weighted (§4.1). */
export const MICRO_COEFFICIENTS: Record<
  Position,
  Record<MacroKey, Partial<Record<SubMetricKey, number>>>
> = {
  ST: {
    sho: { goals_per_90: 0.35, conversion_rate: 0.25, aerial_proxy: 0.12, set_piece_proxy: 0.08, minutes_per_app: 0.1 },
    pac: { goals_per_90: 0.2, minutes_per_app: 0.15, dribble_proxy: 0.12, assists_per_90: 0.08 },
    pas: { assists_per_90: 0.22, pass_volume: 0.18, progressive_pass_proxy: 0.22, set_piece_proxy: 0.08, goals_per_90: 0.12 },
    dri: { dribble_proxy: 0.22, goals_per_90: 0.18, progressive_carry_proxy: 0.22, conversion_rate: 0.12, assists_per_90: 0.08 },
    def: { def_actions_proxy: 0.22, defensive_value_proxy: 0.22, aerial_proxy: 0.18, minutes_per_app: 0.15, pass_volume: 0.12 },
    phy: { aerial_proxy: 0.28, minutes_per_app: 0.22, def_actions_proxy: 0.18, goals_per_90: 0.12 },
  },
  W: {
    sho: { goals_per_90: 0.28, conversion_rate: 0.22, assists_per_90: 0.15, set_piece_proxy: 0.08 },
    pac: { goals_per_90: 0.25, dribble_proxy: 0.22, minutes_per_app: 0.18, assists_per_90: 0.1 },
    pas: { assists_per_90: 0.3, pass_volume: 0.25, goals_per_90: 0.12, set_piece_proxy: 0.08 },
    dri: { dribble_proxy: 0.35, assists_per_90: 0.2, goals_per_90: 0.18, conversion_rate: 0.1 },
    def: { def_actions_proxy: 0.3, minutes_per_app: 0.2, pass_volume: 0.15, aerial_proxy: 0.1 },
    phy: { minutes_per_app: 0.3, aerial_proxy: 0.22, def_actions_proxy: 0.18, goals_per_90: 0.12 },
  },
  AM: {
    sho: { goals_per_90: 0.25, conversion_rate: 0.2, set_piece_proxy: 0.15, assists_per_90: 0.12 },
    pac: { dribble_proxy: 0.25, minutes_per_app: 0.2, goals_per_90: 0.15, assists_per_90: 0.1 },
    pas: { assists_per_90: 0.32, pass_volume: 0.28, set_piece_proxy: 0.12, goals_per_90: 0.1 },
    dri: { dribble_proxy: 0.32, pass_volume: 0.22, assists_per_90: 0.2, goals_per_90: 0.12 },
    def: { def_actions_proxy: 0.28, pass_volume: 0.22, minutes_per_app: 0.18, aerial_proxy: 0.1 },
    phy: { minutes_per_app: 0.28, def_actions_proxy: 0.22, aerial_proxy: 0.18, pass_volume: 0.12 },
  },
  CM: {
    sho: { goals_per_90: 0.22, set_piece_proxy: 0.18, conversion_rate: 0.15, assists_per_90: 0.12 },
    pac: { minutes_per_app: 0.28, pass_volume: 0.2, assists_per_90: 0.15, dribble_proxy: 0.12 },
    pas: { assists_per_90: 0.32, pass_volume: 0.3, set_piece_proxy: 0.12, goals_per_90: 0.1 },
    dri: { pass_volume: 0.28, dribble_proxy: 0.25, assists_per_90: 0.2, goals_per_90: 0.1 },
    def: { def_actions_proxy: 0.32, pass_volume: 0.22, minutes_per_app: 0.2, aerial_proxy: 0.1 },
    phy: { minutes_per_app: 0.32, def_actions_proxy: 0.25, aerial_proxy: 0.18, pass_volume: 0.12 },
  },
  DM: {
    sho: { goals_per_90: 0.18, set_piece_proxy: 0.15, conversion_rate: 0.12, assists_per_90: 0.1 },
    pac: { minutes_per_app: 0.3, def_actions_proxy: 0.22, pass_volume: 0.18, assists_per_90: 0.1 },
    pas: { pass_volume: 0.32, assists_per_90: 0.28, def_actions_proxy: 0.15, set_piece_proxy: 0.1 },
    dri: { pass_volume: 0.28, dribble_proxy: 0.2, assists_per_90: 0.18, def_actions_proxy: 0.12 },
    def: { def_actions_proxy: 0.38, aerial_proxy: 0.22, minutes_per_app: 0.2, pass_volume: 0.12 },
    phy: { def_actions_proxy: 0.32, aerial_proxy: 0.28, minutes_per_app: 0.22, pass_volume: 0.1 },
  },
  FB: {
    sho: { goals_per_90: 0.15, assists_per_90: 0.2, set_piece_proxy: 0.12, conversion_rate: 0.1 },
    pac: { minutes_per_app: 0.32, dribble_proxy: 0.22, assists_per_90: 0.18, goals_per_90: 0.1 },
    pas: { assists_per_90: 0.3, pass_volume: 0.28, def_actions_proxy: 0.15, set_piece_proxy: 0.1 },
    dri: { dribble_proxy: 0.28, pass_volume: 0.25, assists_per_90: 0.2, minutes_per_app: 0.12 },
    def: { def_actions_proxy: 0.35, minutes_per_app: 0.22, aerial_proxy: 0.18, pass_volume: 0.12 },
    phy: { minutes_per_app: 0.3, def_actions_proxy: 0.28, aerial_proxy: 0.2, pass_volume: 0.12 },
  },
  CB: {
    sho: { goals_per_90: 0.2, aerial_proxy: 0.18, set_piece_proxy: 0.12, conversion_rate: 0.1 },
    pac: { minutes_per_app: 0.28, def_actions_proxy: 0.22, aerial_proxy: 0.18, pass_volume: 0.12 },
    pas: { pass_volume: 0.3, def_actions_proxy: 0.25, assists_per_90: 0.15, aerial_proxy: 0.12 },
    dri: { pass_volume: 0.25, def_actions_proxy: 0.22, aerial_proxy: 0.18, minutes_per_app: 0.15 },
    def: { def_actions_proxy: 0.38, aerial_proxy: 0.28, clean_sheet_proxy: 0.15, minutes_per_app: 0.12 },
    phy: { aerial_proxy: 0.35, def_actions_proxy: 0.28, minutes_per_app: 0.2, clean_sheet_proxy: 0.1 },
  },
  GK: {
    sho: { saves_proxy: 0.25, clean_sheet_proxy: 0.2, def_actions_proxy: 0.15, minutes_per_app: 0.12 },
    pac: { saves_proxy: 0.22, minutes_per_app: 0.25, clean_sheet_proxy: 0.18, def_actions_proxy: 0.12 },
    pas: { pass_volume: 0.28, minutes_per_app: 0.22, def_actions_proxy: 0.18, clean_sheet_proxy: 0.12 },
    dri: { pass_volume: 0.25, minutes_per_app: 0.22, saves_proxy: 0.2, clean_sheet_proxy: 0.15 },
    def: { saves_proxy: 0.32, clean_sheet_proxy: 0.28, def_actions_proxy: 0.2, minutes_per_app: 0.12 },
    phy: { aerial_proxy: 0.25, minutes_per_app: 0.28, saves_proxy: 0.22, clean_sheet_proxy: 0.15 },
  },
};

function applyFloor(weights: Partial<Record<SubMetricKey, number>>): Record<SubMetricKey, number> {
  const keys = Object.keys(weights) as SubMetricKey[];
  const floored: Partial<Record<SubMetricKey, number>> = {};
  for (const k of keys) floored[k] = Math.max(FLOOR_WEIGHT, weights[k] ?? FLOOR_WEIGHT);
  const sum = Object.values(floored).reduce((a, b) => a + b, 0);
  const out = {} as Record<SubMetricKey, number>;
  for (const k of keys) out[k] = (floored[k]! / sum);
  return out;
}

export function macroFromSubMetrics(
  position: Position,
  subMetrics: SubMetricVector,
): { attrs: PlayerAttributes; microBreakdown: Record<MacroKey, Record<string, number>> } {
  const microBreakdown: Record<MacroKey, Record<string, number>> = {
    pac: {},
    sho: {},
    pas: {},
    dri: {},
    def: {},
    phy: {},
  };
  const attrs = {} as PlayerAttributes;

  for (const macro of Object.keys(MICRO_COEFFICIENTS[position]) as MacroKey[]) {
    const rawWeights = MICRO_COEFFICIENTS[position][macro]!;
    const weights = applyFloor(rawWeights);
    let unit = 0;
    for (const [key, w] of Object.entries(weights) as [SubMetricKey, number][]) {
      const v = subMetrics[key] ?? 0.45;
      const contrib = v * w;
      unit += contrib;
      microBreakdown[macro][key] = Math.round(contrib * 1000) / 1000;
    }
    attrs[macro] = Math.max(1, Math.min(99, Math.round(40 + unit * 58)));
  }

  return { attrs, microBreakdown };
}

export function listMicroCoefficients(position: Position): Record<MacroKey, Record<SubMetricKey, number>> {
  const out = {} as Record<MacroKey, Record<SubMetricKey, number>>;
  for (const macro of Object.keys(MICRO_COEFFICIENTS[position]) as MacroKey[]) {
    out[macro] = applyFloor(MICRO_COEFFICIENTS[position][macro]!);
  }
  return out;
}
