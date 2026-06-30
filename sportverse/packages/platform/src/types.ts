import type { ClubState } from "../../sim-core/src/club-builder.js";
import type { CollectionCard, SeasonRank, SportXp } from "./live.js";

export interface PlayerProfile {
  id: string;
  displayName: string;
  isGuest: boolean;
  xp: number;
  level: number;
  coins: number;
  streak: number;
  lastPlayedDate?: string;
  achievements: string[];
  stats: {
    gamesPlayed: number;
    quizWins: number;
    footballIqCorrect: number;
    goalkeeperSaves: number;
    transfersCompleted: number;
    clubUpgrades: number;
    decathlonBest: number;
  };
  season: SeasonRank;
  sportXp: SportXp;
  collection: CollectionCard[];
  club?: ClubState;
  completedChallenges: string[];
}

export interface LeaderboardEntry {
  playerId: string;
  displayName: string;
  xp: number;
  level: number;
  seasonTier?: string;
}

export interface RewardGrant {
  xp: number;
  coins: number;
  achievementId?: string;
  sport?: keyof SportXp;
  cardId?: string;
}

export const ACHIEVEMENTS = {
  FIRST_GAME: { id: "first_game", title: "Kickoff", desc: "Play your first game." },
  QUIZ_MASTER: { id: "quiz_master", title: "Sports IQ", desc: "Score 500+ in a quiz." },
  TACTICIAN: { id: "tactician", title: "Tactician", desc: "Make 3 optimal Football IQ decisions." },
  SHOT_STOPPER: { id: "shot_stopper", title: "Shot Stopper", desc: "Save 5 penalties." },
  STREAK_3: { id: "streak_3", title: "Hat-trick", desc: "3-day play streak." },
  LEGENDS_CARD: { id: "legends_card", title: "Premier League Legend", desc: "Complete a collection set." },
  CLUB_OWNER: { id: "club_owner", title: "Club Owner", desc: "Upgrade 3 buildings." },
  TRANSFER_GURU: { id: "transfer_guru", title: "Transfer Guru", desc: "Complete a successful transfer." },
  DECATHLON: { id: "decathlon", title: "Decathlete", desc: "Finish Sports Decathlon." },
  SEASON_PROMO: { id: "season_promo", title: "Promotion", desc: "Reach Pro tier." },
} as const;

export const COLLECTION_SET: CollectionCard[] = [
  { id: "c_salah", setId: "pl_legends", name: "Salah", rarity: "legend" },
  { id: "c_haaland", setId: "pl_legends", name: "Haaland", rarity: "legend" },
  { id: "c_saka", setId: "pl_legends", name: "Saka", rarity: "rare" },
  { id: "c_rice", setId: "pl_legends", name: "Rice", rarity: "rare" },
  { id: "c_palmer", setId: "pl_legends", name: "Palmer", rarity: "common" },
];

export const SEASON_TIERS = ["rookie", "amateur", "semi_pro", "pro", "elite", "legend", "hall_of_fame"] as const;

export function xpToLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}

export function xpForNextLevel(level: number): number {
  return level * level * 50;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function defaultSeason(): SeasonRank {
  return { tier: "rookie", division: 5, points: 0, wins: 0, losses: 0 };
}

export function defaultSportXp(): SportXp {
  return { football: 0, basketball: 0, multi: 0 };
}

export function applyReward(profile: PlayerProfile, reward: RewardGrant): PlayerProfile {
  const xp = profile.xp + reward.xp;
  const achievements = [...profile.achievements];
  if (reward.achievementId && !achievements.includes(reward.achievementId)) {
    achievements.push(reward.achievementId);
  }
  const sportXp = { ...profile.sportXp };
  if (reward.sport) sportXp[reward.sport] += reward.xp;

  let collection = [...profile.collection];
  if (reward.cardId) {
    const card = COLLECTION_SET.find((c) => c.id === reward.cardId);
    if (card && !collection.some((c) => c.id === card.id)) collection.push(card);
  }

  let season = { ...profile.season };
  if (reward.xp >= 40) {
    season.points += Math.floor(reward.xp / 10);
    if (reward.xp >= 50) season.wins += 1;
    else season.losses += 1;
    season = maybePromote(season);
  }

  return {
    ...profile,
    xp,
    level: xpToLevel(xp),
    coins: profile.coins + reward.coins,
    achievements,
    sportXp,
    collection,
    season,
  };
}

export function maybePromote(season: SeasonRank): SeasonRank {
  if (season.points >= 100) {
    const idx = SEASON_TIERS.indexOf(season.tier);
    if (idx < SEASON_TIERS.length - 1) {
      return {
        tier: SEASON_TIERS[idx + 1]!,
        division: Math.max(1, season.division - 1),
        points: season.points - 100,
        wins: season.wins,
        losses: season.losses,
      };
    }
  }
  return season;
}

export function updateStreak(profile: PlayerProfile): PlayerProfile {
  const today = todayISO();
  if (profile.lastPlayedDate === today) return profile;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const y = yesterday.toISOString().slice(0, 10);
  const streak = profile.lastPlayedDate === y ? profile.streak + 1 : 1;
  const achievements = [...profile.achievements];
  if (streak >= 3 && !achievements.includes(ACHIEVEMENTS.STREAK_3.id)) {
    achievements.push(ACHIEVEMENTS.STREAK_3.id);
  }
  return { ...profile, streak, lastPlayedDate: today, achievements };
}

export function createGuestProfile(name = "Guest"): PlayerProfile {
  return {
    id: `guest_${crypto.randomUUID().slice(0, 8)}`,
    displayName: name,
    isGuest: true,
    xp: 0,
    level: 1,
    coins: 100,
    streak: 0,
    achievements: [],
    stats: {
      gamesPlayed: 0,
      quizWins: 0,
      footballIqCorrect: 0,
      goalkeeperSaves: 0,
      transfersCompleted: 0,
      clubUpgrades: 0,
      decathlonBest: 0,
    },
    season: defaultSeason(),
    sportXp: defaultSportXp(),
    collection: [],
    completedChallenges: [],
  };
}

export function migrateProfile(raw: Partial<PlayerProfile> & { id: string }): PlayerProfile {
  const base = createGuestProfile();
  return {
    ...base,
    ...raw,
    stats: { ...base.stats, ...raw.stats },
    season: raw.season ?? defaultSeason(),
    sportXp: raw.sportXp ?? defaultSportXp(),
    collection: raw.collection ?? [],
    completedChallenges: raw.completedChallenges ?? [],
  };
}
