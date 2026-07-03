import type { WeatherCondition } from "@sportverse/draftballer-types";
import type { Rng } from "./rng.js";

export interface WeatherEffects {
  condition: WeatherCondition;
  chanceMultiplier: number;
  fatigueMultiplier: number;
  label: string;
}

export function resolveWeather(condition: WeatherCondition, rng: Rng): WeatherEffects {
  let resolved = condition;
  if (condition === "random") {
    const opts: WeatherCondition[] = ["clear", "rain", "wind", "heat"];
    resolved = opts[Math.floor(rng() * opts.length)]!;
  }
  switch (resolved) {
    case "rain":
      return { condition: "rain", chanceMultiplier: 0.94, fatigueMultiplier: 1.15, label: "Rain" };
    case "wind":
      return { condition: "wind", chanceMultiplier: 0.9, fatigueMultiplier: 1.05, label: "Wind" };
    case "heat":
      return { condition: "heat", chanceMultiplier: 0.96, fatigueMultiplier: 1.25, label: "Extreme heat" };
    default:
      return { condition: "clear", chanceMultiplier: 1, fatigueMultiplier: 1, label: "Clear" };
  }
}
