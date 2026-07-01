#!/usr/bin/env node
/**
 * Import external football datasets into sportverse (run locally, not on Netlify build).
 *
 * Sources (per DRAFTBALLER spec):
 * - https://github.com/dcaribou/transfermarkt-datasets
 * - https://github.com/datasets/football-datasets
 * - Kaggle: xfkzujqjvx97n/football-datasets (requires kagglehub + API credentials)
 *
 * Usage:
 *   node scripts/seed-external-data.mjs --help
 *
 * Output lands in sportverse/data/raw/ (gitignored). Curated quiz JSON stays in
 * packages/sports-db/data/ and is committed for Netlify builds.
 */
console.log(`
DRAFTBALLER data seed (manual step)

1. Clone datasets locally:
   git clone https://github.com/dcaribou/transfermarkt-datasets.git sportverse/data/raw/transfermarkt
   git clone https://github.com/datasets/football-datasets.git sportverse/data/raw/football-datasets

2. Kaggle (optional):
   pip install kagglehub
   python -c "import kagglehub; print(kagglehub.dataset_download('xfkzujqjvx97n/football-datasets'))"

3. Run the ETL (Phase 5 — coming soon) to merge into Postgres + player_season_stats.

Curated quiz bank for Who Am I / Speed Round: sportverse/packages/sports-db/data/*.json
`);
