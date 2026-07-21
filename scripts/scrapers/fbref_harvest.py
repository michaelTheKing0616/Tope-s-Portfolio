"""Harvest FBref league player-season stats via soccerdata (open web tables)."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

import pandas as pd

from lib import FBREF_DIR, load_checkpoint, save_checkpoint, setup_logging, sleep_politely, write_json

logger = setup_logging("fbref")

# Big-5 + common feeder leagues. soccerdata league codes.
DEFAULT_LEAGUES = [
    "ENG-Premier League",
    "ESP-La Liga",
    "ITA-Serie A",
    "GER-Bundesliga",
    "FRA-Ligue 1",
    "POR-Primeira Liga",
    "NED-Eredivisie",
    "BEL-First Division A",
    "USA-MLS",
    "ENG-Championship",
]

STAT_TYPES = [
    "standard",
    "shooting",
    "passing",
    "passing_types",
    "goal_shot_creation",
    "defense",
    "possession",
    "misc",
    "keeper",
    "keeper_adv",
]

# soccerdata tries to write logs outside workspace — keep cache inside repo.
os.environ.setdefault("SOCCERDATA_DIR", str(FBREF_DIR.parent / "soccerdata-cache"))


def _flatten_columns(df: pd.DataFrame) -> pd.DataFrame:
    if isinstance(df.columns, pd.MultiIndex):
        df = df.copy()
        df.columns = [
            "-".join(str(part) for part in col if part and str(part) != "")
            for col in df.columns
        ]
    return df.reset_index()


def harvest_fbref(
    *,
    leagues: list[str] | None = None,
    seasons: list[str] | None = None,
    sleep_seconds: float = 2.0,
    resume: bool = True,
) -> dict[str, Any]:
    import soccerdata as sd

    checkpoint = load_checkpoint()
    done = set(checkpoint["fbref"].get("completed", []))
    failed: dict[str, str] = checkpoint["fbref"].get("failed", {})

    leagues = leagues or DEFAULT_LEAGUES
    seasons = seasons or [f"{str(y)[-2:]}{str(y + 1)[-2:]}" for y in range(2017, 2025)]
    all_rows: list[dict[str, Any]] = []

    for league in leagues:
        for season in seasons:
            key = f"{league}|{season}"
            if resume and key in done:
                logger.info("Skipping cached %s", key)
                continue
            logger.info("FBref %s %s", league, season)
            try:
                reader = sd.FBref(leagues=league, seasons=season)
                league_payload: dict[str, Any] = {
                    "league": league,
                    "season": season,
                    "stat_tables": {},
                }
                for stat_type in STAT_TYPES:
                    try:
                        df = reader.read_player_season_stats(stat_type=stat_type)
                        league_payload["stat_tables"][stat_type] = _flatten_columns(df).to_dict(orient="records")
                        sleep_politely(sleep_seconds)
                    except Exception as exc:
                        logger.warning("  stat_type %s skipped: %s", stat_type, exc)
                out = FBREF_DIR / "by-league" / league.replace(" ", "_") / f"{season}.json"
                write_json(out, league_payload)
                all_rows.append(league_payload)
                done.add(key)
                failed.pop(key, None)
            except Exception as exc:
                logger.error("FBref failed %s: %s", key, exc)
                failed[key] = str(exc)
            sleep_politely(sleep_seconds)

    write_json(FBREF_DIR / "manifest.json", {"leagues": leagues, "seasons": seasons, "completed": sorted(done)})
    checkpoint["fbref"]["completed"] = sorted(done)
    checkpoint["fbref"]["failed"] = failed
    checkpoint["fbref"]["datasets"] = len(all_rows)
    save_checkpoint(checkpoint)
    summary = {"datasets": len(done), "failed": len(failed)}
    logger.info("FBref harvest complete: %s", summary)
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Harvest FBref league stats via soccerdata")
    parser.add_argument("--league", action="append")
    parser.add_argument("--season", action="append")
    parser.add_argument("--sleep", type=float, default=2.0)
    parser.add_argument("--no-resume", action="store_true")
    args = parser.parse_args()
    harvest_fbref(
        leagues=args.league,
        seasons=args.season,
        sleep_seconds=args.sleep,
        resume=not args.no_resume,
    )


if __name__ == "__main__":
    main()
