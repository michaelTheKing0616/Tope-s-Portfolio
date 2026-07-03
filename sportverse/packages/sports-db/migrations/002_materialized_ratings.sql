-- Materialized rating views (Phase 14 — KNOWN_SIMPLIFICATIONS upgrade)
-- Apply when Postgres is the primary API datastore.

CREATE TABLE IF NOT EXISTS player_ratings_cache (
  player_id TEXT NOT NULL,
  mode_id TEXT NOT NULL,
  club_ovr_raw INT NOT NULL,
  intl_ovr_raw INT NOT NULL,
  blended_ovr INT NOT NULL,
  confidence REAL NOT NULL,
  micro_json JSONB,
  calibration_nudge INT DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, mode_id)
);

CREATE INDEX IF NOT EXISTS idx_player_ratings_ovr ON player_ratings_cache (mode_id, blended_ovr DESC);

CREATE TABLE IF NOT EXISTS era_profiles (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  physicality_intensity REAL NOT NULL,
  tackling_leniency REAL NOT NULL,
  pitch_ball_quality REAL NOT NULL,
  tactical_sophistication REAL NOT NULL,
  tempo REAL NOT NULL,
  source TEXT DEFAULT 'curated',
  version INT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS player_calibration (
  player_id TEXT PRIMARY KEY,
  nudge INT NOT NULL CHECK (nudge BETWEEN -3 AND 3),
  reason TEXT NOT NULL,
  evidence_ref TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_formations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slots_json JSONB NOT NULL,
  created_by TEXT,
  share_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_leaderboard (
  day DATE NOT NULL,
  player_name TEXT NOT NULL,
  ovr INT NOT NULL,
  squad_rating INT,
  submitted_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (day, player_name, submitted_at)
);
