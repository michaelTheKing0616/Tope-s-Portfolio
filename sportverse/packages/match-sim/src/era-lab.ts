import type { EraLabResult, SimMatchConfig, SimSquadInput } from "@sportverse/draftballer-types";
import { DEFAULT_SIM_CONFIG } from "@sportverse/draftballer-types";
import { listEraProfiles } from "./era-profiles.js";
import { simulateMatchV2 } from "./sim-engine.js";

/** Era Lab §8 — batch simulate squad across all reference era profiles. */
export function simulateEraLab(
  squad: SimSquadInput,
  seed: string,
  baseConfig: Partial<SimMatchConfig> = {},
  opponentFactory: (eraId: string, i: number) => SimSquadInput,
): EraLabResult {
  const coreProfiles = listEraProfiles().filter((p) =>
    ["1950s-60s", "1970s-80s", "1990s", "2000s", "2010s", "2020s"].includes(p.id),
  );
  const rows: EraLabResult["rows"] = [];
  let highlightFit = simulateMatchV2(squad, opponentFactory("2020s", 0), seed, 1, {
    config: {
      ...DEFAULT_SIM_CONFIG,
      ...baseConfig,
      eraContext: { mode: "custom", profileId: "2020s" },
    },
  }).fitReport.slice(0, 3);

  for (let i = 0; i < coreProfiles.length; i++) {
    const profile = coreProfiles[i]!;
    let wins = 0;
    let draws = 0;
    let losses = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;
    let fitSum = 0;
    let fitCount = 0;

    for (let m = 0; m < 3; m++) {
      const opp = opponentFactory(profile.id, m);
      const result = simulateMatchV2(squad, opp, `${seed}:${profile.id}:${m}`, m + 1, {
        config: {
          ...DEFAULT_SIM_CONFIG,
          ...baseConfig,
          eraContext: { mode: "custom", profileId: profile.id },
        },
      });
      goalsFor += result.homeGoals;
      goalsAgainst += result.awayGoals;
      if (result.homeGoals > result.awayGoals) wins++;
      else if (result.homeGoals < result.awayGoals) losses++;
      else draws++;
      for (const f of result.fitReport) {
        fitSum += f.effectiveDelta;
        fitCount++;
      }
    }

    rows.push({
      eraProfileId: profile.id,
      label: profile.label,
      wins,
      draws,
      losses,
      goalsFor,
      goalsAgainst,
      avgFitDelta: fitCount ? Math.round((fitSum / fitCount) * 10) / 10 : 0,
    });
  }

  return {
    squadName: squad.name ?? "Your XI",
    rows,
    highlightFit,
  };
}
