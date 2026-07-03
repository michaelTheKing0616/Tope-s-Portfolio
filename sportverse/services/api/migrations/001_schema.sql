-- DRAFTBALLER sports schema (Postgres / SQLite compatible subset)

CREATE TABLE IF NOT EXISTS competitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  country TEXT
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  primary_position TEXT,
  nationality TEXT,
  confidence REAL DEFAULT 0.7
);

CREATE TABLE IF NOT EXISTS player_season_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  season_label TEXT NOT NULL,
  competition_id TEXT NOT NULL,
  context TEXT NOT NULL,
  appearances INTEGER DEFAULT 0,
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  minutes INTEGER DEFAULT 0,
  confidence REAL DEFAULT 0.7,
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE INDEX IF NOT EXISTS idx_pss_player ON player_season_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_pss_comp ON player_season_stats(competition_id);
