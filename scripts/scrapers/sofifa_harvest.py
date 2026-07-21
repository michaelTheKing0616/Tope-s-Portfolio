#!/usr/bin/env python3
"""
Harvest FIFA ratings from SoFIFA for Sportverse legend / EA calibration.

Two modes:

  1. OFFLINE BULK (active FC26 players, no network — already run):
     python3 scripts/scrapers/sofifa_harvest.py --bulk

  2. LIVE BULK (retired legends / historical — one command, checkpoint/resume):
     python3 scripts/scrapers/sofifa_live_bulk.py --target legends-missing --no-headless
     ./scripts/scrapers/run_sofifa_background.sh

Single-player live fetch (prefer sofifa_live_bulk.py for batches):
  python3 scripts/scrapers/sofifa_harvest.py --player-id 168609 --live --no-headless
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from lib import ensure_dirs, setup_logging, write_json  # noqa: E402
from lib.sofifa_client import (  # noqa: E402
    SofifaBrowserClient,
    harvest_player_live,
    load_sofifa_overrides,
    pick_search_hit,
)
from sofifa_bulk_harvest import harvest_from_csv  # noqa: E402

OUT_DIR = ROOT / "sportverse" / "data" / "raw" / "open-football" / "sofifa"
logger = setup_logging("sofifa")


def main() -> None:
    parser = argparse.ArgumentParser(description="Harvest SoFIFA player ratings")
    parser.add_argument("--bulk", action="store_true", help="Harvest all players from local FC26 CSV")
    parser.add_argument("--csv", type=Path, help="Override CSV for --bulk")
    parser.add_argument("--search", help="Player name search (requires --live)")
    parser.add_argument("--team", help="Filter search results by team substring")
    parser.add_argument("--player-id", type=int, action="append", help="SoFIFA player id")
    parser.add_argument("--tm-ids", help="Comma-separated Transfermarkt ids")
    parser.add_argument("--live", action="store_true", help="Use browser (Cloudflare bypass)")
    parser.add_argument("--no-headless", action="store_true", help="Show browser window")
    parser.add_argument("--editions", choices=["last", "all"], default="last")
    parser.add_argument("--sleep", type=float, default=2.0)
    args = parser.parse_args()

    ensure_dirs()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    if args.bulk or (not args.search and not args.player_id and not args.tm_ids):
        summary = harvest_from_csv(args.csv)
        print(f"\n✓ SoFIFA bulk harvest complete: {summary['output']}")
        print(f"  {summary['player_count']} players, {summary['matched_count']} matched to Sportverse ids")
        if not args.search and not args.player_id and not args.tm_ids:
            print("\n  For retired legends, run:")
            print("    python3 scripts/scrapers/sofifa_live_bulk.py --target legends-missing --no-headless")
            return

    overrides = load_sofifa_overrides()
    player_ids: list[int] = list(args.player_id or [])
    if args.tm_ids:
        for raw in args.tm_ids.split(","):
            key = raw.strip().replace("tm-", "")
            pid = overrides.get(raw.strip()) or overrides.get(key)
            if pid:
                player_ids.append(pid)
            else:
                logger.warning("No SoFIFA override for %s — use --search --live or add to data/sofifa-id-overrides.json", raw)

    if not (player_ids or args.search):
        parser.error("Provide --bulk, --player-id, --search, or --tm-ids")

    if not args.live:
        logger.error("Live fetch requires --live. For batches use: python3 scripts/scrapers/sofifa_live_bulk.py")
        sys.exit(1)

    out: list[dict[str, Any]] = []
    with SofifaBrowserClient(sleep=args.sleep, headless=not args.no_headless) as client:
        client.warm_up()
        if args.search:
            hits = client.search_players(args.search)
            if args.team:
                hits = [h for h in hits if args.team.lower() in (h.get("team") or "").lower()]
            picked = pick_search_hit(hits, name=args.search)
            if picked:
                player_ids.append(picked["sofifa_id"])
        for pid in dict.fromkeys(player_ids):
            out.append(harvest_player_live(client, pid, editions=args.editions))

    write_json(OUT_DIR / "player-ratings.json", out)
    print(f"\n✓ SoFIFA live harvest complete: {OUT_DIR / 'player-ratings.json'}")


if __name__ == "__main__":
    main()
