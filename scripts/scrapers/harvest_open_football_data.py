#!/usr/bin/env python3
"""
Harvest open-source football advanced stats for Sportverse.

Sources
-------
1. StatsBomb Open Data (statsbombpy) — event-level: xG, xA, pressures, carries, etc.
2. FBref (soccerdata) — league player-season tables: npxG, prog passes, tackles, etc.

Usage
-----
  pip install -r scripts/scrapers/requirements.txt

  # Full background harvest (recommended)
  ./scripts/scrapers/run_background.sh

  # Foreground / partial runs
  python3 scripts/scrapers/harvest_open_football_data.py --sources statsbomb
  python3 scripts/scrapers/harvest_open_football_data.py --sources fbref --league "ENG-Premier League"
  python3 scripts/scrapers/harvest_open_football_data.py --sources statsbomb --max-matches 5

Output
------
  sportverse/data/raw/open-football/statsbomb/player-season-stats.json
  sportverse/data/raw/open-football/fbref/by-league/<league>/<season>.json
  sportverse/data/raw/open-football/checkpoint.json
  sportverse/data/raw/open-football/logs/harvest.log

Attribution (required by StatsBomb User Agreement)
--------------------------------------------------
Public outputs must credit StatsBomb: https://statsbomb.com/
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from lib import ensure_dirs, setup_logging  # noqa: E402
from statsbomb_harvest import harvest_statsbomb  # noqa: E402
from fbref_harvest import harvest_fbref  # noqa: E402
from sofifa_bulk_harvest import harvest_from_csv  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Harvest open-source football advanced stats")
    parser.add_argument(
        "--sources",
        default="statsbomb,fbref",
        help="Comma-separated: statsbomb, fbref, sofifa",
    )
    parser.add_argument("--resume", action="store_true", default=True)
    parser.add_argument("--no-resume", action="store_true")
    parser.add_argument("--sleep-statsbomb", type=float, default=0.35)
    parser.add_argument("--sleep-fbref", type=float, default=2.0)
    parser.add_argument("--max-matches", type=int, default=None, help="StatsBomb only — limit for testing")
    parser.add_argument("--competition-id", type=int, action="append", help="StatsBomb competition filter")
    parser.add_argument("--league", action="append", help='FBref league code, e.g. "ENG-Premier League"')
    parser.add_argument("--season", action="append", help='FBref season code, e.g. "2324"')
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    ensure_dirs()
    logger = setup_logging("harvest")
    sources = [s.strip().lower() for s in args.sources.split(",") if s.strip()]
    resume = not args.no_resume
    summary = {}

    logger.info("Starting open-football harvest: sources=%s resume=%s", sources, resume)

    if "statsbomb" in sources:
        logger.info("=== StatsBomb open data ===")
        summary["statsbomb"] = harvest_statsbomb(
            resume=resume,
            sleep_seconds=args.sleep_statsbomb,
            max_matches=args.max_matches,
            competition_ids=args.competition_id,
        )

    if "fbref" in sources:
        logger.info("=== FBref via soccerdata ===")
        summary["fbref"] = harvest_fbref(
            leagues=args.league,
            seasons=args.season,
            sleep_seconds=args.sleep_fbref,
            resume=resume,
        )

    if "sofifa" in sources:
        logger.info("=== SoFIFA bulk from local FC26 CSV (no HTTP) ===")
        summary["sofifa"] = harvest_from_csv()

    logger.info("All requested sources complete: %s", summary)
    print("\n✓ Harvest finished.")
    print("  StatsBomb player-season:", ROOT / "sportverse/data/raw/open-football/statsbomb/player-season-stats.json")
    print("  FBref league tables:     ", ROOT / "sportverse/data/raw/open-football/fbref/by-league/")
    print("  SoFIFA ratings index:   ", ROOT / "sportverse/data/raw/open-football/sofifa/player-ratings-index.json")
    print("  Logs:                    ", ROOT / "sportverse/data/raw/open-football/logs/harvest.log")
    print("\n  Attribution required: credit StatsBomb on any public outputs.")


if __name__ == "__main__":
    main()
