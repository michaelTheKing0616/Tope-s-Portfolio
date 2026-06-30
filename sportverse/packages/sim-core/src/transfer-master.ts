export interface TransferOffer {
  id: string;
  playerName: string;
  position: string;
  age: number;
  fee: number;
  wage: number;
  contractYears: number;
  personality: "professional" | "volatile" | "ambitious" | "loyal";
  agentDemand: number;
  fanPressure: "low" | "medium" | "high";
  homegrown: boolean;
  nationalityQuota: boolean;
}

export interface TransferDecision {
  action: "accept" | "reject" | "negotiate_lower" | "add_bonus";
}

export interface TransferResult {
  success: boolean;
  finalFee: number;
  moraleDelta: number;
  fanDelta: number;
  boardDelta: number;
  narrative: string;
  seasonImpact: "boost" | "neutral" | "disaster";
}

export const TRANSFER_SCENARIOS: TransferOffer[] = [
  {
    id: "t1",
    playerName: "Marcus Cole",
    position: "CM",
    age: 24,
    fee: 45_000_000,
    wage: 120_000,
    contractYears: 4,
    personality: "professional",
    agentDemand: 5_000_000,
    fanPressure: "high",
    homegrown: false,
    nationalityQuota: false,
  },
  {
    id: "t2",
    playerName: "Yuki Tanaka",
    position: "LW",
    age: 19,
    fee: 12_000_000,
    wage: 35_000,
    contractYears: 5,
    personality: "ambitious",
    agentDemand: 1_500_000,
    fanPressure: "medium",
    homegrown: false,
    nationalityQuota: true,
  },
  {
    id: "t3",
    playerName: "James Okonkwo",
    position: "ST",
    age: 28,
    fee: 70_000_000,
    wage: 200_000,
    contractYears: 3,
    personality: "volatile",
    agentDemand: 8_000_000,
    fanPressure: "high",
    homegrown: true,
    nationalityQuota: false,
  },
];

export function resolveTransfer(offer: TransferOffer, decision: TransferDecision, budget: number, transferDiscount = 0): TransferResult {
  const discount = 1 - transferDiscount / 100;
  let finalFee = offer.fee;
  let success = false;
  let narrative = "";
  let moraleDelta = 0;
  let fanDelta = 0;
  let boardDelta = 0;
  let seasonImpact: TransferResult["seasonImpact"] = "neutral";

  switch (decision.action) {
    case "reject":
      return {
        success: true,
        finalFee: 0,
        moraleDelta: offer.fanPressure === "high" ? -10 : 0,
        fanDelta: offer.fanPressure === "high" ? -15 : 0,
        boardDelta: 5,
        narrative: "Board approves fiscal discipline. Fans divided.",
        seasonImpact: "neutral",
      };
    case "negotiate_lower":
      finalFee = Math.round(offer.fee * 0.85 * discount);
      success = finalFee <= budget && offer.personality !== "volatile";
      narrative = success
        ? `Agent accepts €${(finalFee / 1e6).toFixed(1)}M after tough talks.`
        : "Volatile player walks — deal collapses.";
      moraleDelta = success ? 5 : -8;
      fanDelta = success ? 5 : -12;
      boardDelta = success ? -3 : 10;
      seasonImpact = success ? "boost" : "disaster";
      break;
    case "add_bonus":
      finalFee = Math.round(offer.fee * discount);
      success = finalFee + offer.agentDemand <= budget * 1.1;
      narrative = success
        ? "Structured deal with performance bonuses — squad delighted."
        : "FFP concerns block the move.";
      moraleDelta = success ? 12 : -5;
      fanDelta = success ? 10 : -5;
      boardDelta = success ? -8 : 15;
      seasonImpact = success ? "boost" : "neutral";
      break;
    case "accept":
    default:
      finalFee = Math.round(offer.fee * discount);
      success = finalFee <= budget;
      narrative = success
        ? `${offer.playerName} signs! Media frenzy.`
        : "Insufficient budget — embarrassing leak to press.";
      moraleDelta = success ? 8 : -10;
      fanDelta = success ? (offer.fanPressure === "high" ? 20 : 8) : -20;
      boardDelta = success ? -12 : 8;
      seasonImpact = success ? "boost" : "disaster";
  }

  if (offer.nationalityQuota && !success && decision.action !== "reject") {
    narrative += " Foreign quota would have been exceeded.";
    boardDelta += 5;
  }

  return { success, finalFee, moraleDelta, fanDelta, boardDelta, narrative, seasonImpact };
}

export function getTransfer(id: string): TransferOffer | undefined {
  return TRANSFER_SCENARIOS.find((t) => t.id === id);
}
