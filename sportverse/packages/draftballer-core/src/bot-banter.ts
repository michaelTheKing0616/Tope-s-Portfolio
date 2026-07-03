export type BotPersonality = "bpa" | "star_hunter" | "formation_purist" | "youth_scout";

export const BOT_PERSONALITIES: { id: BotPersonality; label: string; blurb: string }[] = [
  { id: "bpa", label: "Best Available", blurb: "Always takes the highest OVR on the board." },
  { id: "star_hunter", label: "Star Hunter", blurb: "Overpays for prismatic-tier names." },
  { id: "formation_purist", label: "Formation Purist", blurb: "Fills the XI by position before raw OVR." },
  { id: "youth_scout", label: "Youth Scout", blurb: "Prefers high PAC/DRI profiles." },
];

const BANTER: Record<BotPersonality, string[]> = {
  bpa: [
    "Can't argue with that OVR.",
    "Solid value at this spot.",
    "That's the board speaking.",
  ],
  star_hunter: [
    "You don't pass on a name like that.",
    "The crowd wanted a star — they got one.",
    "Ratings fade; reputations don't.",
  ],
  formation_purist: [
    "Finally — the right shape for that slot.",
    "Balance before brilliance.",
    "Every great XI starts with structure.",
  ],
  youth_scout: [
    "Pace and trickery — the future is now.",
    "Let them run at tired legs.",
    "That profile screams transition threat.",
  ],
};

export function botBanterLine(personality: BotPersonality, playerName: string, ovr: number): string {
  const pool = BANTER[personality];
  const line = pool[Math.floor(Math.random() * pool.length)]!;
  return `${line} (${playerName}, OVR ${ovr})`;
}
