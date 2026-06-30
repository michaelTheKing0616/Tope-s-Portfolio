export interface SeasonRank {
  tier: "rookie" | "amateur" | "semi_pro" | "pro" | "elite" | "legend" | "hall_of_fame";
  division: number;
  points: number;
  wins: number;
  losses: number;
}

export interface CollectionCard {
  id: string;
  setId: string;
  name: string;
  rarity: "common" | "rare" | "legend";
}

export interface CommunityChallenge {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  rewardXp: number;
  rewardCardId?: string;
  endsAt: string;
}

export interface SportXp {
  football: number;
  basketball: number;
  multi: number;
}

export interface CoachTip {
  weakness: string;
  drill: string;
  gameRecommendation: string;
}

export interface CommentaryLine {
  text: string;
  intensity: "calm" | "rising" | "explosive";
}
