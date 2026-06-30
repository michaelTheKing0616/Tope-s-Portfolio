export interface Player {
  id: string;
  name: string;
  sport: "football";
  nationality?: string;
  position?: string;
  clubs?: string[];
  clues: string[];
  jerseyNumbers?: { club: string; number: number }[];
}

export interface Club {
  id: string;
  name: string;
  founded?: number;
  league?: string;
  nickname?: string;
  stadium?: string;
  country?: string;
  clues: string[];
}

export interface TrueFalseStatement {
  id: string;
  text: string;
  answer: boolean;
  explanation: string;
  sport: string;
}

export interface SpeedQuestion {
  id: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  sport: string;
}

export interface CareerPathEntry {
  id: string;
  playerId: string;
  clubs: string[];
}
