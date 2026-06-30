export interface FootballEra {
  id: string;
  decade: string;
  name: string;
  description: string;
  rules: {
    tempo: number;
    physicality: number;
    pressing: number;
    longBall: number;
    dataDriven: number;
  };
  bestTactic: string;
  wrongTacticPenalty: number;
}

export const FOOTBALL_ERAS: FootballEra[] = [
  {
    id: "1950",
    decade: "1950s",
    name: "Heavy Ball Era",
    description: "Heavy leather balls, slow pitches, direct football.",
    rules: { tempo: 0.3, physicality: 0.9, pressing: 0.1, longBall: 0.8, dataDriven: 0 },
    bestTactic: "long_ball",
    wrongTacticPenalty: 0.4,
  },
  {
    id: "1970",
    decade: "1970s",
    name: "Total Football",
    description: "Cruyff's revolution — fluid positions, high technique.",
    rules: { tempo: 0.7, physicality: 0.5, pressing: 0.6, longBall: 0.2, dataDriven: 0.1 },
    bestTactic: "fluid_positions",
    wrongTacticPenalty: 0.35,
  },
  {
    id: "1990",
    decade: "1990s",
    name: "Counterattack",
    description: "Catenaccio meets pace — soak and break.",
    rules: { tempo: 0.5, physicality: 0.7, pressing: 0.3, longBall: 0.5, dataDriven: 0.1 },
    bestTactic: "counter",
    wrongTacticPenalty: 0.35,
  },
  {
    id: "2010",
    decade: "2010s",
    name: "Gegenpress",
    description: "Klopp's heavy metal football — win it back in 8 seconds.",
    rules: { tempo: 0.95, physicality: 0.8, pressing: 0.95, longBall: 0.15, dataDriven: 0.4 },
    bestTactic: "gegenpress",
    wrongTacticPenalty: 0.4,
  },
  {
    id: "2020",
    decade: "2020s",
    name: "Data Analytics",
    description: "xG, PPDA, structured possession — every decision measured.",
    rules: { tempo: 0.75, physicality: 0.55, pressing: 0.7, longBall: 0.2, dataDriven: 0.95 },
    bestTactic: "positional_play",
    wrongTacticPenalty: 0.38,
  },
];

export const ERA_TACTICS = [
  { id: "long_ball", label: "Long ball" },
  { id: "fluid_positions", label: "Fluid positions" },
  { id: "counter", label: "Sit deep & counter" },
  { id: "gegenpress", label: "Gegenpress" },
  { id: "positional_play", label: "Positional play" },
  { id: "park_bus", label: "Park the bus" },
];

export function playEraScenario(era: FootballEra, tacticId: string): {
  score: number;
  success: boolean;
  explanation: string;
  xp: number;
} {
  const optimal = tacticId === era.bestTactic;
  const base = optimal ? 0.85 : 0.35;
  const roll = Math.random();
  const success = roll < base;
  const score = optimal ? (success ? 900 : 500) : success ? 400 : 100;
  const explanation = optimal
    ? `${era.name}: ${tacticId.replace(/_/g, " ")} fits the era's football culture.`
  : `${era.name} demanded ${era.bestTactic.replace(/_/g, " ")} — your choice fought the meta of the decade.`;
  return { score, success, explanation, xp: Math.round(score / 10) };
}

export function getEra(id: string): FootballEra | undefined {
  return FOOTBALL_ERAS.find((e) => e.id === id);
}
