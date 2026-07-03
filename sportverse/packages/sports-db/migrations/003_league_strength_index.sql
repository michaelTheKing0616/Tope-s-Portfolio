-- League Strength Index v1 schema (§7 addendum)
-- Apply when migrating from JSON bundles to Postgres.

CREATE TABLE IF NOT EXISTS league_strength_index (
  competition_id TEXT NOT NULL,
  season_id TEXT NOT NULL,
  lsi_final DOUBLE PRECISION NOT NULL,
  lsi_raw DOUBLE PRECISION NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  elo_component DOUBLE PRECISION NOT NULL,
  transfer_delta_component DOUBLE PRECISION NOT NULL,
  talent_flow_component DOUBLE PRECISION NOT NULL,
  nat_team_component DOUBLE PRECISION NOT NULL,
  cross_league_fixtures INT NOT NULL DEFAULT 0,
  transfer_comparisons INT NOT NULL DEFAULT 0,
  regional_tier_prior DOUBLE PRECISION,
  PRIMARY KEY (competition_id, season_id)
);

CREATE TABLE IF NOT EXISTS cross_league_fixtures (
  fixture_id TEXT PRIMARY KEY,
  club_a_id TEXT NOT NULL,
  league_a_id TEXT NOT NULL,
  club_b_id TEXT NOT NULL,
  league_b_id TEXT NOT NULL,
  competition_id TEXT NOT NULL,
  season_id TEXT NOT NULL,
  result SMALLINT NOT NULL CHECK (result IN (-1, 0, 1))
);

CREATE TABLE IF NOT EXISTS player_transfers (
  player_id TEXT NOT NULL,
  from_league_id TEXT NOT NULL,
  to_league_id TEXT NOT NULL,
  transfer_season TEXT NOT NULL,
  pre_move_z DOUBLE PRECISION NOT NULL,
  post_move_z DOUBLE PRECISION NOT NULL,
  age_at_transfer INT NOT NULL,
  minutes_pre INT NOT NULL,
  minutes_post INT NOT NULL,
  role_change_flag BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (player_id, from_league_id, to_league_id, transfer_season)
);

CREATE TABLE IF NOT EXISTS confederation_strength_index (
  competition_id TEXT NOT NULL,
  season_id TEXT NOT NULL,
  csi_final DOUBLE PRECISION NOT NULL,
  csi_raw DOUBLE PRECISION NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  elo_component DOUBLE PRECISION NOT NULL,
  transfer_delta_component DOUBLE PRECISION NOT NULL,
  talent_flow_component DOUBLE PRECISION NOT NULL,
  nat_team_component DOUBLE PRECISION NOT NULL,
  cross_confederation_fixtures INT NOT NULL DEFAULT 0,
  transfer_comparisons INT NOT NULL DEFAULT 0,
  regional_tier_prior DOUBLE PRECISION,
  PRIMARY KEY (competition_id, season_id)
);

CREATE INDEX IF NOT EXISTS idx_lsi_competition ON league_strength_index (competition_id);
CREATE INDEX IF NOT EXISTS idx_cross_league_season ON cross_league_fixtures (season_id);
