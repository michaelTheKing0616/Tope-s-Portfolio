export interface ClubUpgrade {
  id: string;
  name: string;
  category: "stadium" | "academy" | "medical" | "analytics" | "training" | "scouting" | "fans" | "media";
  level: number;
  maxLevel: number;
  cost: number;
  effect: string;
  buff: Partial<ClubBuffs>;
}

export interface ClubBuffs {
  youthQuality: number;
  transferDiscount: number;
  injuryReduction: number;
  matchInsight: number;
  trainingSpeed: number;
  fanRevenue: number;
}

export interface ClubState {
  name: string;
  coins: number;
  revenuePerTick: number;
  upgrades: Record<string, number>;
  lastTickAt: string;
}

export const UPGRADE_CATALOG: Omit<ClubUpgrade, "level">[] = [
  { id: "stadium", name: "Stadium", category: "stadium", maxLevel: 5, cost: 500, effect: "+fan capacity & revenue", buff: { fanRevenue: 10 } },
  { id: "academy", name: "Academy", category: "academy", maxLevel: 5, cost: 400, effect: "+youth player quality", buff: { youthQuality: 5 } },
  { id: "scouting", name: "Scouts", category: "scouting", maxLevel: 5, cost: 350, effect: "Cheaper transfers", buff: { transferDiscount: 3 } },
  { id: "medical", name: "Medical Center", category: "medical", maxLevel: 5, cost: 300, effect: "Fewer injuries", buff: { injuryReduction: 4 } },
  { id: "analytics", name: "Analytics Dept", category: "analytics", maxLevel: 5, cost: 450, effect: "+match insight in Football IQ", buff: { matchInsight: 5 } },
  { id: "training", name: "Training Center", category: "training", maxLevel: 5, cost: 380, effect: "Faster player growth", buff: { trainingSpeed: 4 } },
  { id: "fans", name: "Fan Engagement", category: "fans", maxLevel: 5, cost: 250, effect: "+passive revenue", buff: { fanRevenue: 8 } },
  { id: "media", name: "Media Dept", category: "media", maxLevel: 5, cost: 320, effect: "+brand revenue", buff: { fanRevenue: 6 } },
];

export function createClubState(name = "FC Legend"): ClubState {
  return {
    name,
    coins: 200,
    revenuePerTick: 5,
    upgrades: Object.fromEntries(UPGRADE_CATALOG.map((u) => [u.id, 0])),
    lastTickAt: new Date().toISOString(),
  };
}

export function computeBuffs(state: ClubState): ClubBuffs {
  const buffs: ClubBuffs = { youthQuality: 0, transferDiscount: 0, injuryReduction: 0, matchInsight: 0, trainingSpeed: 0, fanRevenue: 0 };
  for (const u of UPGRADE_CATALOG) {
    const lvl = state.upgrades[u.id] ?? 0;
    for (const [k, v] of Object.entries(u.buff)) {
      (buffs as Record<string, number>)[k]! += (v ?? 0) * lvl;
    }
  }
  return buffs;
}

export function tickClub(state: ClubState): ClubState {
  const buffs = computeBuffs(state);
  const revenue = state.revenuePerTick + Math.floor(buffs.fanRevenue / 2);
  return {
    ...state,
    coins: state.coins + revenue,
    lastTickAt: new Date().toISOString(),
  };
}

export function upgradeBuilding(state: ClubState, upgradeId: string): { state: ClubState; ok: boolean; message: string } {
  const def = UPGRADE_CATALOG.find((u) => u.id === upgradeId);
  if (!def) return { state, ok: false, message: "Unknown building" };
  const lvl = state.upgrades[upgradeId] ?? 0;
  if (lvl >= def.maxLevel) return { state, ok: false, message: "Max level reached" };
  const cost = def.cost * (lvl + 1);
  if (state.coins < cost) return { state, ok: false, message: `Need ${cost} coins` };
  const next = {
    ...state,
    coins: state.coins - cost,
    upgrades: { ...state.upgrades, [upgradeId]: lvl + 1 },
  };
  return { state: next, ok: true, message: `${def.name} upgraded to Lv ${lvl + 1}` };
}
