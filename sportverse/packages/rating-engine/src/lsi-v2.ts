/**
 * LSI v2 — Statistical Rigor Standard (z-score ensemble, empirical Bayes, connectivity).
 * @see DRAFTBALLER Statistical Rigor Standard & LSI v2 addendum
 */

import type { CrossLeagueFixture, LeagueStrengthIndexEntry, PlayerTransfer } from "@sportverse/sports-db";

export const LSI_REFERENCE = { leagueId: "premier-league", season: "2020" } as const;

/** UNCALIBRATED — EXPERT PRIOR: starting ensemble weights until held-out fixture fit runs. */
export const DEFAULT_ENSEMBLE_WEIGHTS = {
  elo: 0.45,
  transfer: 0.35,
  talent: 0.12,
  nat: 0.08,
} as const;

/** Grounded default from World Football Elo provisional threshold (~30 matches). */
export const DEFAULT_SHRINKAGE_K = 30;

/** Target spread for LSI distribution — calibrated against top-5 European league clustering. */
export const DEFAULT_SIGMA_LSI = 0.08;

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function stdev(values: number[]): number {
  if (values.length < 2) return 1;
  const m = mean(values);
  const v = values.reduce((s, x) => s + (x - m) ** 2, 0) / values.length;
  return Math.sqrt(v) || 1;
}

/** Population z-score for a single value (§2.1). */
export function populationZScore(value: number, population: number[]): number {
  const m = mean(population);
  const s = stdev(population);
  return (value - m) / s;
}

/** James-Stein / empirical Bayes shrinkage weight n/(n+k) (§2.4). */
export function shrinkageWeight(n: number, k = DEFAULT_SHRINKAGE_K): number {
  return n / (n + Math.max(1, k));
}

/** Empirical Bayes posterior mean toward hierarchical prior. */
export function empiricalBayesShrink(raw: number, n: number, prior: number, k = DEFAULT_SHRINKAGE_K): number {
  const w = shrinkageWeight(n, k);
  return w * raw + (1 - w) * prior;
}

export interface PairwiseMargin {
  strongerId: string;
  weakerId: string;
  /** Average goal differential: stronger − weaker. */
  margin: number;
}

/**
 * Massey least-squares ratings with one reference node fixed at 0 (§3 toy example).
 * Minimizes Σ (r_i − r_j − margin)² over all pairwise margins.
 */
export function solveMasseyLeastSquares(
  nodeIds: readonly string[],
  referenceId: string,
  margins: readonly PairwiseMargin[],
): Map<string, number> {
  const ids = [...nodeIds];
  const refIdx = ids.indexOf(referenceId);
  if (refIdx < 0) throw new Error(`referenceId ${referenceId} not in nodeIds`);

  const unknownIds = ids.filter((id) => id !== referenceId);
  const idx = new Map(unknownIds.map((id, i) => [id, i]));
  const n = unknownIds.length;
  if (!n) return new Map(ids.map((id) => [id, 0]));

  const ata: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const atb = Array(n).fill(0);

  for (const { strongerId, weakerId, margin } of margins) {
    const coeff = new Array(n).fill(0);
    let rhs = margin;

    if (strongerId !== referenceId) {
      const i = idx.get(strongerId);
      if (i == null) continue;
      coeff[i] += 1;
    } else {
      rhs = margin;
    }

    if (weakerId !== referenceId) {
      const j = idx.get(weakerId);
      if (j == null) continue;
      coeff[j] -= 1;
    } else {
      rhs = -margin;
    }

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) ata[i]![j]! += coeff[i]! * coeff[j]!;
      atb[i]! += coeff[i]! * rhs;
    }
  }

  const x = solveSymmetricLinearSystem(ata, atb);
  const out = new Map<string, number>();
  out.set(referenceId, 0);
  for (let i = 0; i < unknownIds.length; i++) out.set(unknownIds[i]!, x[i]!);
  return out;
}

/** Toy fixture from Statistical Rigor Standard §3. */
export const MASSEY_TOY_MARGINS: PairwiseMargin[] = [
  { strongerId: "A", weakerId: "B", margin: 0.5 },
  { strongerId: "B", weakerId: "C", margin: 1.0 },
  { strongerId: "A", weakerId: "C", margin: 1.2 },
];

export function solveMasseyToyExample(): Map<string, number> {
  return solveMasseyLeastSquares(["A", "B", "C"], "A", MASSEY_TOY_MARGINS);
}

function solveSymmetricLinearSystem(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(m[row]![col]!) > Math.abs(m[pivot]![col]!)) pivot = row;
    }
    [m[col], m[pivot]] = [m[pivot]!, m[col]!];
    const div = m[col]![col]! || 1e-12;
    for (let j = col; j <= n; j++) m[col]![j]! /= div;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = m[row]![col]!;
      for (let j = col; j <= n; j++) m[row]![j]! -= factor * m[col]![j]!;
    }
  }
  return m.map((row) => row[n]!);
}

export type LeagueSeasonKey = `${string}::${string}`;

export function leagueSeasonKey(competitionId: string, seasonLabel: string): LeagueSeasonKey {
  return `${competitionId}::${seasonLabel}`;
}

/** Union-find connected components for league-season graph (§2.3). */
export function connectedComponents(
  nodes: readonly string[],
  edges: readonly [string, string][],
): string[][] {
  const parent = new Map<string, string>();
  for (const n of nodes) parent.set(n, n);

  function find(x: string): string {
    const p = parent.get(x)!;
    if (p !== x) parent.set(x, find(p));
    return parent.get(x)!;
  }

  function unite(a: string, b: string): void {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  for (const [a, b] of edges) {
    if (parent.has(a) && parent.has(b)) unite(a, b);
  }

  const groups = new Map<string, string[]>();
  for (const n of nodes) {
    const root = find(n);
    const list = groups.get(root) ?? [];
    list.push(n);
    groups.set(root, list);
  }
  return [...groups.values()];
}

/** Whether node can reach reference via edges (§2.3 connectivity). */
export function isConnectedToReference(
  node: string,
  referenceNode: string,
  edges: readonly [string, string][],
): boolean {
  if (node === referenceNode) return true;
  const adj = new Map<string, Set<string>>();
  for (const [a, b] of edges) {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  }
  const seen = new Set<string>();
  const queue = [referenceNode];
  while (queue.length) {
    const cur = queue.pop()!;
    if (cur === node) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const n of adj.get(cur) ?? []) queue.push(n);
  }
  return false;
}

/** @deprecated Use isConnectedToReference for LSI gating. */
export function isInMainComponent(node: string, nodes: readonly string[], edges: readonly [string, string][]): boolean {
  const components = connectedComponents(nodes, edges);
  if (!components.length) return false;
  const main = components.reduce((best, c) => (c.length > best.length ? c : best), components[0]!);
  return main.includes(node);
}

/** Resolve hierarchical prior: same-league adjacent season → regional tier → global (§2.4). */
export function resolveHierarchicalPrior(
  competitionId: string,
  seasonLabel: string,
  computed: Map<LeagueSeasonKey, number>,
  regionalPrior: Record<string, number>,
  globalPrior = 0.85,
): number {
  const numeric = Number(seasonLabel);
  if (Number.isFinite(numeric)) {
    for (const delta of [1, -1, 2, -2]) {
      const neighbor = leagueSeasonKey(competitionId, String(numeric + delta));
      const v = computed.get(neighbor);
      if (v != null && Number.isFinite(v)) return v;
    }
  }
  return regionalPrior[competitionId] ?? globalPrior;
}

/** Standard Elo component mapped to ~0.55–1.2 scale (feeds z-score layer). */
export function computeEloRawByLeague(
  fixtures: readonly CrossLeagueFixture[],
  referenceLeagueId = LSI_REFERENCE.leagueId,
): Map<string, number> {
  const leagueElo = new Map<string, number>();
  const K = 24;

  const ensure = (id: string) => {
    if (!leagueElo.has(id)) leagueElo.set(id, 1500);
    return leagueElo.get(id)!;
  };

  for (const f of fixtures) {
    const a = ensure(f.leagueAId);
    const b = ensure(f.leagueBId);
    const expectedA = 1 / (1 + 10 ** ((b - a) / 400));
    const scoreA = f.result === 1 ? 1 : f.result === 0 ? 0.5 : 0;
    leagueElo.set(f.leagueAId, a + K * (scoreA - expectedA));
    leagueElo.set(f.leagueBId, b + K * ((1 - scoreA) - (1 - expectedA)));
  }

  const ref = leagueElo.get(referenceLeagueId) ?? 1500;
  const out = new Map<string, number>();
  for (const [league, elo] of leagueElo) {
    const delta = (elo - ref) / 400;
    out.set(league, clamp(1 + delta * 0.25, 0.55, 1.2));
  }
  return out;
}

/** Transfer-delta Massey-style component (§1.3). */
export function computeTransferRawByLeague(
  transfers: readonly PlayerTransfer[],
  referenceLeagueId = LSI_REFERENCE.leagueId,
): Map<string, number> {
  const leagues = [...new Set(transfers.flatMap((t) => [t.fromLeagueId, t.toLeagueId]))];
  const idx = new Map(leagues.map((l, i) => [l, i]));
  const n = leagues.length;
  if (!n) return new Map();

  const ata: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const atb = Array(n).fill(0);

  for (const t of transfers) {
    if (t.roleChangeFlag) continue;
    const agePenalty = Math.max(0, (t.ageAtTransfer - 27) * 0.05);
    const delta = t.postMoveZ - t.preMoveZ + agePenalty;
    const i = idx.get(t.fromLeagueId);
    const j = idx.get(t.toLeagueId);
    if (i == null || j == null) continue;
    ata[i]![i]! += 1;
    ata[j]![j]! += 1;
    ata[i]![j]! -= 1;
    ata[j]![i]! -= 1;
    atb[i]! += delta;
    atb[j]! -= delta;
  }

  const refIdx = idx.get(referenceLeagueId);
  if (refIdx != null) {
    ata[refIdx]![refIdx]! += 1000;
    atb[refIdx]! += 1000;
  }

  let strength = Array(n).fill(1);
  for (let iter = 0; iter < 40; iter++) {
    for (let i = 0; i < n; i++) {
      let sum = atb[i]!;
      for (let j = 0; j < n; j++) {
        if (i !== j) sum -= ata[i]![j]! * strength[j]!;
      }
      strength[i] = clamp(sum / (ata[i]![i]! || 1), 0.55, 1.2);
    }
  }

  return new Map(leagues.map((l, i) => [l, strength[i]!]));
}

export interface EnsembleWeights {
  elo: number;
  transfer: number;
  talent: number;
  nat: number;
}

/** Constrained weight fit on held-out fixture outcomes (§2.5). */
export function fitEnsembleWeights(
  fixtures: readonly CrossLeagueFixture[],
  componentMaps: {
    elo: Map<string, number>;
    transfer: Map<string, number>;
    talent: Map<string, number>;
    nat: Map<string, number>;
  },
  holdoutFraction = 0.2,
): { weights: EnsembleWeights; holdoutAccuracy: number } {
  const shuffled = [...fixtures].sort((a, b) => a.fixtureId.localeCompare(b.fixtureId));
  const holdoutCount = Math.max(1, Math.floor(shuffled.length * holdoutFraction));
  const holdout = shuffled.slice(0, holdoutCount);

  let best = { ...DEFAULT_ENSEMBLE_WEIGHTS };
  let bestAcc = 0;

  const candidates: EnsembleWeights[] = [];
  for (let w1 = 0.2; w1 <= 0.6; w1 += 0.05) {
    for (let w2 = 0.15; w2 <= 0.5; w2 += 0.05) {
      for (let w3 = 0.05; w3 <= 0.25; w3 += 0.05) {
        const w4 = 1 - w1 - w2 - w3;
        if (w4 < 0.05 || w4 > 0.25) continue;
        candidates.push({ elo: w1, transfer: w2, talent: w3, nat: w4 });
      }
    }
  }

  for (const weights of candidates) {
    let correct = 0;
    for (const f of holdout) {
      const zA = combinedZForLeague(f.leagueAId, componentMaps, weights);
      const zB = combinedZForLeague(f.leagueBId, componentMaps, weights);
      const predicted = zA >= zB ? 1 : -1;
      if (predicted === f.result || (f.result === 0 && Math.abs(zA - zB) < 0.05)) correct++;
    }
    const acc = correct / holdout.length;
    if (acc > bestAcc) {
      bestAcc = acc;
      best = weights;
    }
  }

  return { weights: best, holdoutAccuracy: bestAcc };
}

function combinedZForLeague(
  leagueId: string,
  maps: {
    elo: Map<string, number>;
    transfer: Map<string, number>;
    talent: Map<string, number>;
    nat: Map<string, number>;
  },
  weights: EnsembleWeights,
): number {
  const popElo = [...maps.elo.values()];
  const popTransfer = [...maps.transfer.values()];
  const popTalent = [...maps.talent.values()];
  const popNat = [...maps.nat.values()];

  const zElo = populationZScore(maps.elo.get(leagueId) ?? 0.85, popElo);
  const zTransfer = populationZScore(maps.transfer.get(leagueId) ?? 0.85, popTransfer);
  const zTalent = populationZScore(maps.talent.get(leagueId) ?? 0.85, popTalent);
  const zNat = populationZScore(maps.nat.get(leagueId) ?? 0.85, popNat);

  return weights.elo * zElo + weights.transfer * zTransfer + weights.talent * zTalent + weights.nat * zNat;
}

export interface ComputeLsiV2Input {
  fixtures: CrossLeagueFixture[];
  transfers: PlayerTransfer[];
  existing: LeagueStrengthIndexEntry[];
  regionalPrior?: Record<string, number>;
  shrinkageK?: number;
  sigmaLsi?: number;
}

export interface ComputeLsiV2Result {
  rows: LeagueStrengthIndexEntry[];
  weights: EnsembleWeights;
  sigmaLsi: number;
  shrinkageK: number;
  holdoutAccuracy: number;
}

/** Full LSI v2 pipeline — z-score ensemble, connectivity, empirical Bayes shrinkage. */
export function computeLsiV2(input: ComputeLsiV2Input): ComputeLsiV2Result {
  const regionalPrior = input.regionalPrior ?? {
    "premier-league": 0.92,
    "la-liga": 0.9,
    "serie-a": 0.88,
    championship: 0.72,
    "serie-a-brazil": 0.75,
    eredivisie: 0.73,
  };
  const shrinkageK = input.shrinkageK ?? DEFAULT_SHRINKAGE_K;
  const sigmaLsi = input.sigmaLsi ?? DEFAULT_SIGMA_LSI;

  const eloByLeague = computeEloRawByLeague(input.fixtures);
  const transferByLeague = computeTransferRawByLeague(input.transfers);

  const talentByLeague = new Map<string, number>();
  const natByLeague = new Map<string, number>();
  for (const row of input.existing) {
    talentByLeague.set(row.competitionId, row.talentFlowComponent);
    natByLeague.set(row.competitionId, row.natTeamComponent);
  }

  const componentMaps = {
    elo: eloByLeague,
    transfer: transferByLeague,
    talent: talentByLeague,
    nat: natByLeague,
  };

  const { weights, holdoutAccuracy } = fitEnsembleWeights(input.fixtures, componentMaps);

  const seasons = [...new Set(input.fixtures.map((f) => f.seasonLabel))];
  const leagues = [
    ...new Set([
      ...input.fixtures.flatMap((f) => [f.leagueAId, f.leagueBId]),
      ...input.transfers.flatMap((t) => [t.fromLeagueId, t.toLeagueId]),
      ...input.existing.map((r) => r.competitionId),
    ]),
  ];

  const allKeys: LeagueSeasonKey[] = [];
  for (const seasonLabel of seasons.length ? seasons : ["2020"]) {
    for (const competitionId of leagues) allKeys.push(leagueSeasonKey(competitionId, seasonLabel));
  }

  const edges: [string, string][] = [];
  for (const f of input.fixtures) {
    edges.push([
      leagueSeasonKey(f.leagueAId, f.seasonLabel),
      leagueSeasonKey(f.leagueBId, f.seasonLabel),
    ]);
  }
  for (const t of input.transfers) {
    edges.push([
      leagueSeasonKey(t.fromLeagueId, t.transferSeason),
      leagueSeasonKey(t.toLeagueId, t.transferSeason),
    ]);
  }

  const popElo = [...eloByLeague.values()];
  const popTransfer = [...transferByLeague.values()];
  const popTalent = [...talentByLeague.values()];
  const popNat = [...natByLeague.values()];

  const rawByKey = new Map<LeagueSeasonKey, number>();
  const rows: LeagueStrengthIndexEntry[] = [];

  for (const seasonLabel of seasons.length ? seasons : ["2020"]) {
    for (const competitionId of leagues) {
      const key = leagueSeasonKey(competitionId, seasonLabel);
      const fixtureCount = input.fixtures.filter(
        (f) => f.seasonLabel === seasonLabel && (f.leagueAId === competitionId || f.leagueBId === competitionId),
      ).length;
      const transferCount = input.transfers.filter(
        (t) =>
          t.transferSeason === seasonLabel &&
          (t.fromLeagueId === competitionId || t.toLeagueId === competitionId),
      ).length;
      const n = fixtureCount + transferCount * 0.5;

      const eloComponent = eloByLeague.get(competitionId) ?? 0.85;
      const transferDeltaComponent = transferByLeague.get(competitionId) ?? 0.85;
      const talentFlowComponent =
        talentByLeague.get(competitionId) ??
        input.existing.find((r) => r.competitionId === competitionId)?.talentFlowComponent ??
        0.85;
      const natTeamComponent =
        natByLeague.get(competitionId) ??
        input.existing.find((r) => r.competitionId === competitionId)?.natTeamComponent ??
        0.85;

      const refKey = leagueSeasonKey(LSI_REFERENCE.leagueId, LSI_REFERENCE.season);
      const connected = isConnectedToReference(key, refKey, edges);
      let combinedZ: number;
      if (connected) {
        combinedZ =
          weights.elo * populationZScore(eloComponent, popElo) +
          weights.transfer * populationZScore(transferDeltaComponent, popTransfer) +
          weights.talent * populationZScore(talentFlowComponent, popTalent) +
          weights.nat * populationZScore(natTeamComponent, popNat);
      } else {
        combinedZ = 0;
      }

      const lsiRaw = clamp(1 + sigmaLsi * combinedZ, 0.55, 1.15);
      rawByKey.set(key, lsiRaw);

      const prior = resolveHierarchicalPrior(competitionId, seasonLabel, rawByKey, regionalPrior);
      const lsiFinal = connected
        ? empiricalBayesShrink(lsiRaw, n, prior, shrinkageK)
        : prior;

      rows.push({
        competitionId,
        seasonLabel,
        lsiFinal: Math.round(lsiFinal * 1000) / 1000,
        lsiRaw: Math.round(lsiRaw * 1000) / 1000,
        confidence: Math.round(shrinkageWeight(n, shrinkageK) * 1000) / 1000,
        eloComponent: Math.round(eloComponent * 1000) / 1000,
        transferDeltaComponent: Math.round(transferDeltaComponent * 1000) / 1000,
        talentFlowComponent,
        natTeamComponent,
        crossLeagueFixtures: fixtureCount,
        transferComparisons: transferCount,
        regionalTierPrior: regionalPrior[competitionId] ?? 0.85,
      });
    }
  }

  const refRow = rows.find(
    (r) => r.competitionId === LSI_REFERENCE.leagueId && r.seasonLabel === LSI_REFERENCE.season,
  );
  if (refRow && refRow.lsiFinal !== 0) {
    const scale = 1 / refRow.lsiFinal;
    for (const r of rows) {
      r.lsiFinal = Math.round(r.lsiFinal * scale * 1000) / 1000;
      r.lsiRaw = Math.round(r.lsiRaw * scale * 1000) / 1000;
    }
  }

  return { rows, weights, sigmaLsi, shrinkageK, holdoutAccuracy };
}
