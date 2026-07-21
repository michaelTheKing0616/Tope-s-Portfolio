"""Download and aggregate all StatsBomb open-data competitions."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

import pandas as pd
from statsbombpy import sb
from tqdm import tqdm

from lib import (
    STATSBOMB_DIR,
    load_checkpoint,
    read_json,
    save_checkpoint,
    setup_logging,
    sleep_politely,
    write_json,
)
from lib.statsbomb_aggregate import aggregate_match, rollup_player_season

logger = setup_logging("statsbomb")


def fetch_competitions() -> pd.DataFrame:
    comps = sb.competitions()
    write_json(STATSBOMB_DIR / "competitions.json", comps.to_dict(orient="records"))
    return comps


def harvest_statsbomb(
    *,
    resume: bool = True,
    sleep_seconds: float = 0.35,
    max_matches: int | None = None,
    competition_ids: list[int] | None = None,
) -> dict[str, Any]:
    checkpoint = load_checkpoint()
    completed = set(checkpoint["statsbomb"].get("completed_matches", []))
    failed: dict[str, str] = checkpoint["statsbomb"].get("failed_matches", {})

    comps = fetch_competitions()
    if competition_ids:
        comps = comps[comps["competition_id"].isin(competition_ids)]

    all_player_match: list[dict[str, Any]] = read_json(
        STATSBOMB_DIR / "player-match-stats.partial.json",
        [],
    )
    processed = 0

    for _, comp in comps.iterrows():
        cid = int(comp["competition_id"])
        sid = int(comp["season_id"])
        comp_name = str(comp.get("competition_name", cid))
        season_name = str(comp.get("season_name", sid))
        logger.info("Competition %s — %s (cid=%s sid=%s)", comp_name, season_name, cid, sid)

        try:
            matches = sb.matches(cid, sid)
        except Exception as exc:
            logger.error("Failed to list matches for %s/%s: %s", cid, sid, exc)
            continue

        if matches.empty:
            continue

        match_rows = matches.to_dict(orient="records")
        for match in tqdm(match_rows, desc=f"{comp_name} {season_name}", unit="match"):
            if max_matches is not None and processed >= max_matches:
                break
            match_id = int(match["match_id"])
            if resume and match_id in completed:
                continue

            out_path = STATSBOMB_DIR / "player-match" / f"{match_id}.json"
            try:
                events = sb.events(match_id)
                lineups = sb.lineups(match_id)
                meta = {
                    "match_id": match_id,
                    "competition_id": cid,
                    "season_id": sid,
                    "competition_name": comp_name,
                    "season_name": season_name,
                    "match_date": str(match.get("match_date", "")),
                    "home_team": str(match.get("home_team", "")),
                    "away_team": str(match.get("away_team", "")),
                }
                player_rows = aggregate_match(events, lineups, meta)
                write_json(out_path, player_rows)
                all_player_match.extend(player_rows)
                completed.add(match_id)
                failed.pop(str(match_id), None)
                processed += 1
                if processed % 10 == 0:
                    write_json(STATSBOMB_DIR / "player-match-stats.partial.json", all_player_match)
                    checkpoint["statsbomb"]["completed_matches"] = sorted(completed)
                    save_checkpoint(checkpoint)
            except Exception as exc:
                logger.error("Match %s failed: %s", match_id, exc)
                failed[str(match_id)] = str(exc)
            sleep_politely(sleep_seconds)

        if max_matches is not None and processed >= max_matches:
            logger.info("Reached max_matches=%s", max_matches)
            break

    write_json(STATSBOMB_DIR / "player-match-stats.json", all_player_match)
    season_rows = rollup_player_season(all_player_match)
    write_json(STATSBOMB_DIR / "player-season-stats.json", season_rows)

    checkpoint["statsbomb"]["completed_matches"] = sorted(completed)
    checkpoint["statsbomb"]["failed_matches"] = failed
    checkpoint["statsbomb"]["player_match_rows"] = len(all_player_match)
    checkpoint["statsbomb"]["player_season_rows"] = len(season_rows)
    save_checkpoint(checkpoint)

    summary = {
        "matches_completed": len(completed),
        "matches_failed": len(failed),
        "player_match_rows": len(all_player_match),
        "player_season_rows": len(season_rows),
    }
    logger.info("StatsBomb harvest complete: %s", summary)
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Harvest StatsBomb open data")
    parser.add_argument("--resume", action="store_true", default=True)
    parser.add_argument("--no-resume", action="store_true")
    parser.add_argument("--sleep", type=float, default=0.35)
    parser.add_argument("--max-matches", type=int, default=None)
    parser.add_argument("--competition-id", type=int, action="append")
    args = parser.parse_args()
    harvest_statsbomb(
        resume=not args.no_resume,
        sleep_seconds=args.sleep,
        max_matches=args.max_matches,
        competition_ids=args.competition_id,
    )


if __name__ == "__main__":
    main()
