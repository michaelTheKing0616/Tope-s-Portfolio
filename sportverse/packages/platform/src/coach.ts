import type { PlayerProfile } from "./types.js";
import type { CoachTip, CommentaryLine, CommunityChallenge } from "./live.js";

export function generateCoachTip(profile: PlayerProfile): CoachTip {
  const { stats, sportXp } = profile;
  if (stats.footballIqCorrect < stats.quizWins) {
    return {
      weakness: "Tactical decision-making under pressure",
      drill: "Play 3 Football IQ scenarios focusing on optimal choices.",
      gameRecommendation: "football-iq",
    };
  }
  if (stats.goalkeeperSaves < 3) {
    return {
      weakness: "Reading striker body language",
      drill: "Goalkeeper Instinct levels 1–5 — trust foot angle over eyes.",
      gameRecommendation: "goalkeeper",
    };
  }
  if (sportXp.basketball < sportXp.football) {
    return {
      weakness: "Basketball mechanics & court vision",
      drill: "Shot Scientist — aim for 48° release, 45° arc.",
      gameRecommendation: "shot-scientist",
    };
  }
  return {
    weakness: "Breadth across sports",
    drill: "Complete a Sports Decathlon run for cross-sport XP.",
    gameRecommendation: "decathlon",
  };
}

export function generateCommentary(event: {
  type: "goal" | "save" | "miss" | "transfer" | "upgrade";
  playerName?: string;
  optimal?: boolean;
}): CommentaryLine[] {
  const lines: CommentaryLine[] = [];
  switch (event.type) {
    case "goal":
      lines.push({ text: "The crowd erupts!", intensity: "explosive" });
      lines.push({
        text: event.optimal
          ? `What a decision! ${event.playerName ?? "The striker"} finishes clinically.`
          : `${event.playerName ?? "The striker"} scores, but there was a better option…`,
        intensity: "rising",
      });
      break;
    case "save":
      lines.push({ text: "Brilliant reflexes!", intensity: "explosive" });
      lines.push({ text: "The keeper read the body language perfectly.", intensity: "calm" });
      break;
    case "transfer":
      lines.push({
        text: event.optimal
          ? "The fax machine is humming — what a signing!"
          : "The deal collapses — the press room is chaos.",
        intensity: event.optimal ? "rising" : "explosive",
      });
      break;
    case "upgrade":
      lines.push({ text: "Infrastructure investment — the club grows.", intensity: "calm" });
      break;
    default:
      lines.push({ text: "So close — learn and come back stronger.", intensity: "calm" });
  }
  return lines;
}

export function getActiveChallenges(): CommunityChallenge[] {
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  return [
    {
      id: "ch_fiq_10",
      title: "Tactical Master",
      description: "Make 10 optimal Football IQ decisions this week.",
      target: 10,
      progress: 0,
      rewardXp: 200,
      rewardCardId: "c_saka",
      endsAt: weekEnd.toISOString(),
    },
    {
      id: "ch_quiz_20",
      title: "Quiz Marathon",
      description: "Win 20 quiz rounds across any mode.",
      target: 20,
      progress: 0,
      rewardXp: 150,
      endsAt: weekEnd.toISOString(),
    },
    {
      id: "ch_decathlon",
      title: "Decathlon Week",
      description: "Complete Sports Decathlon with 3000+ score.",
      target: 3000,
      progress: 0,
      rewardXp: 300,
      rewardCardId: "c_haaland",
      endsAt: weekEnd.toISOString(),
    },
  ];
}

export function progressChallenge(
  challenge: CommunityChallenge,
  amount: number,
): CommunityChallenge {
  return { ...challenge, progress: Math.min(challenge.target, challenge.progress + amount) };
}
