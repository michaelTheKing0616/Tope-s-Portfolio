#!/usr/bin/env python3
"""
Bulk live SoFIFA harvest — one browser session, checkpoint/resume, no one-by-one CLI.

SoFIFA blocks plain HTTP (Cloudflare). This script queues hundreds of players and
scrapes them in a single run. Active FC26 players are already covered by the offline
CSV bulk harvest — use this for retired legends and anyone missing from that index.

Usage
-----
  pip install -r scripts/scrapers/requirements.txt

  # OFFLINE (recommended for icons — Cloudflare blocks automated player pages):
  python3 scripts/scrapers/sofifa_live_bulk.py --target legends-missing --offline

  # Live browser (often blocked by Cloudflare — peak=0 means captcha page):
  python3 scripts/scrapers/sofifa_live_bulk.py --target legends-missing --no-headless

  # Background (same queue, logs to file)
  ./scripts/scrapers/run_sofifa_background.sh

  # Full edition history (slow — many page loads per player)
  python3 scripts/scrapers/sofifa_live_bulk.py --target legends-missing --editions all --no-headless

  # Test with 5 players
  python3 scripts/scrapers/sofifa_live_bulk.py --target legends-missing --max-players 5 --no-headless

  # Explicit SoFIFA ids
  python3 scripts/scrapers/sofifa_live_bulk.py --player-ids 168609,28003 --no-headless

Output
------
  sportverse/data/raw/open-football/sofifa/player-ratings-history.json
  sportverse/data/raw/open-football/sofifa/checkpoint-live.json
  sportverse/data/raw/open-football/sofifa/player-ratings-history.partial.json
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from lib import SOFIFA_DIR, ensure_dirs, setup_logging, write_json  # noqa: E402
from lib.sofifa_offline import harvest_legend_offline, resolve_offline_sofifa_id  # noqa: E402
from lib.sofifa_client import (  # noqa: E402
    SofifaBrowserClient,
    harvest_player_live,
    load_search_term_overrides,
    load_sofifa_overrides,
    pick_search_hit,
    search_query_variants,
)

LEGENDS_JSON = ROOT / "sportverse" / "packages" / "sports-db" / "data" / "legend-ratings.json"
PLAYERS_JSON = ROOT / "sportverse" / "packages" / "sports-db" / "data" / "players-extended.json"
CURATED_JSON = ROOT / "sportverse" / "packages" / "sports-db" / "data" / "players.json"
EA_INDEX_JSON = ROOT / "sportverse" / "packages" / "sports-db" / "data" / "ea-fc26-index.json"
BULK_INDEX_JSON = SOFIFA_DIR / "player-ratings-index.json"

OUT_HISTORY = SOFIFA_DIR / "player-ratings-history.json"
OUT_PARTIAL = SOFIFA_DIR / "player-ratings-history.partial.json"
CHECKPOINT = SOFIFA_DIR / "checkpoint-live.json"

logger = setup_logging("sofifa-live-bulk")


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def load_checkpoint() -> dict[str, Any]:
    if CHECKPOINT.exists():
        state = load_json(CHECKPOINT, {})
    else:
        state = {
            "version": 1,
            "completed": [],
            "failed": {},
            "id_cache": {},
            "started_at": datetime.now(timezone.utc).isoformat(),
        }
    # Skipped players were wrongly marked completed in earlier runs — allow retry.
    failed = state.get("failed", {})
    completed = set(state.get("completed", []))
    for key, reason in failed.items():
        if reason == "no_sofifa_id":
            completed.discard(key)
    state["completed"] = sorted(completed)
    return state


def save_checkpoint(state: dict[str, Any]) -> None:
    state["updated_at"] = datetime.now(timezone.utc).isoformat()
    write_json(CHECKPOINT, state)


def players_by_id() -> dict[str, dict[str, Any]]:
    rows = load_json(PLAYERS_JSON, [])
    by_id = {p["id"]: p for p in rows}
    for p in load_json(CURATED_JSON, []):
        # Curated names/nationalities win over TM homonyms (e.g. pele → Guinea-Bissau winger).
        prev = by_id.get(p["id"], {})
        by_id[p["id"]] = {**prev, **p, "source_priority": "curated"}
    return by_id


def bulk_matched_sportverse_ids() -> set[str]:
    if not BULK_INDEX_JSON.exists():
        return set()
    data = load_json(BULK_INDEX_JSON, {})
    return {p["sportverse_id"] for p in data.get("players", []) if p.get("sportverse_id")}


def ea_sofifa_by_sportverse_id() -> dict[str, int]:
    out: dict[str, int] = {}
    for row in load_json(EA_INDEX_JSON, []):
        sv = row.get("playerId") or row.get("id")
        ea = row.get("eaId")
        if sv and ea:
            try:
                out[str(sv)] = int(ea)
            except (TypeError, ValueError):
                pass
    return out


def build_queue(target: str, player_ids: list[int] | None = None) -> list[dict[str, Any]]:
    """Build scrape queue entries: {sportverse_id, name, nationality, clubs, sofifa_id?}."""
    if player_ids:
        return [{"sportverse_id": None, "name": f"sofifa-{pid}", "sofifa_id": pid} for pid in player_ids]

    by_id = players_by_id()
    matched = bulk_matched_sportverse_ids()
    legends = load_json(LEGENDS_JSON, [])

    queue: list[dict[str, Any]] = []
    for entry in legends:
        sv_id = entry["playerId"]
        if target == "legends-missing" and sv_id in matched:
            continue
        if target == "legends-all" or target == "legends-missing":
            p = by_id.get(sv_id, {})
            queue.append(
                {
                    "sportverse_id": sv_id,
                    "name": p.get("name") or sv_id,
                    "nationality": p.get("nationality") or "",
                    "clubs": p.get("clubs") or [],
                    "tm_id": p.get("tmId"),
                    "legend_ovr": entry.get("ovr"),
                }
            )
        else:
            raise ValueError(f"Unknown target: {target}")

    return queue


def item_key(item: dict[str, Any]) -> str:
    return str(item.get("sportverse_id") or item.get("sofifa_id"))


def is_scraped(row: dict[str, Any]) -> bool:
    return (row.get("peak_overall") or 0) > 0


def scraped_keys_from_results(results: list[dict[str, Any]]) -> set[str]:
    keys: set[str] = set()
    for row in results:
        key = row.get("sportverse_id") or str(row.get("sofifa_id"))
        if key and is_scraped(row):
            keys.add(str(key))
    return keys


def build_pending_queue(
    queue: list[dict[str, Any]],
    *,
    results: list[dict[str, Any]],
    completed: set[str],
    failed: dict[str, str],
    retry_failed: bool,
) -> list[dict[str, Any]]:
    scraped = scraped_keys_from_results(results)

    if retry_failed:
        retry_keys = set(failed.keys()) | (completed - scraped)
        pending = [q for q in queue if item_key(q) in retry_keys]
        if not pending:
            logger.warning(
                "--retry-failed: nothing to retry (failed=%d, scraped=%d). "
                "Run without --retry-failed to process the full queue.",
                len(failed),
                len(scraped),
            )
        return pending

    # Resume: skip anyone already present in partial output with real data.
    return [q for q in queue if item_key(q) not in scraped]


def resolve_sofifa_id(
    item: dict[str, Any],
    client: SofifaBrowserClient,
    overrides: dict[str, int],
    ea_map: dict[str, int],
    id_cache: dict[str, int],
    search_terms: dict[str, list[str]],
    *,
    allow_search: bool,
) -> int | None:
    if item.get("sofifa_id"):
        return int(item["sofifa_id"])

    sv_id = item.get("sportverse_id")
    cache_key = sv_id or item.get("name", "")
    if cache_key and cache_key in id_cache:
        return id_cache[cache_key]

    tm_id = item.get("tm_id")
    if tm_id:
        hit = overrides.get(str(tm_id)) or overrides.get(f"tm-{tm_id}")
        if hit:
            return hit

    if sv_id:
        hit = overrides.get(str(sv_id))
        if hit:
            return hit
        hit = ea_map.get(str(sv_id))
        if hit:
            return hit

    if not allow_search:
        return None

    name = item.get("name") or ""
    if not name or name.startswith("tm-"):
        return None

    clubs = item.get("clubs") or []
    club_hint = clubs[0] if clubs else ""
    extra = search_terms.get(str(sv_id), []) if sv_id else []
    queries = search_query_variants(name, extra)
    hits = client.search_players_multi(queries)
    picked = pick_search_hit(
        hits,
        name=name,
        nationality=item.get("nationality") or "",
        club_hint=club_hint,
    )
    if picked:
        return int(picked["sofifa_id"])
    return None


def harvest_offline_bulk(
    *,
    target: str = "legends-missing",
    player_ids: list[int] | None = None,
    max_players: int | None = None,
    search_unmapped: bool = True,
) -> dict[str, Any]:
    """No browser — FC26 CSV snapshot + legend-ratings.json anchors."""
    ensure_dirs()
    SOFIFA_DIR.mkdir(parents=True, exist_ok=True)

    queue = build_queue(target, player_ids)
    if max_players is not None:
        queue = queue[:max_players]

    overrides = load_sofifa_overrides()
    ea_map = ea_sofifa_by_sportverse_id()
    results: list[dict[str, Any]] = []
    skipped = 0

    for item in queue:
        key = item_key(item)
        label = item.get("name") or key
        sofifa_id = resolve_offline_sofifa_id(item, overrides, ea_map)

        row = harvest_legend_offline(item, sofifa_id=sofifa_id)
        if row["peak_overall"] <= 0:
            logger.warning("offline skip — no rating for %s", label)
            skipped += 1
            continue
        results.append(row)
        sid = sofifa_id if sofifa_id is not None else "—"
        logger.info("  ✓ %s sofifa=%s peak=%s (%s)", label, sid, row["peak_overall"], row["source"])

    payload = {
        "version": 1,
        "target": target,
        "mode": "offline",
        "scraped_count": len(results),
        "skipped_count": skipped,
        "players": results,
    }
    write_json(OUT_PARTIAL, results)
    write_json(OUT_HISTORY, payload)
    logger.info("Offline harvest: %d rated, %d skipped → %s", len(results), skipped, OUT_HISTORY)
    return {
        "scraped": len(results),
        "skipped": skipped,
        "failed": 0,
        "output": str(OUT_HISTORY),
        "partial": str(OUT_PARTIAL),
    }


def harvest_live_bulk(
    *,
    target: str = "legends-missing",
    player_ids: list[int] | None = None,
    resume: bool = True,
    retry_failed: bool = False,
    max_players: int | None = None,
    sleep: float = 2.5,
    headless: bool = True,
    editions: str = "last",
    search_unmapped: bool = True,
) -> dict[str, Any]:
    ensure_dirs()
    SOFIFA_DIR.mkdir(parents=True, exist_ok=True)

    checkpoint = load_checkpoint()
    completed = set(checkpoint.get("completed", []))
    failed: dict[str, str] = dict(checkpoint.get("failed", {}))
    id_cache: dict[str, int] = dict(checkpoint.get("id_cache", {}))

    results: list[dict[str, Any]] = load_json(OUT_PARTIAL, [])
    by_key = {r.get("sportverse_id") or str(r.get("sofifa_id")): r for r in results}

    queue = build_queue(target, player_ids)
    if max_players is not None:
        queue = queue[:max_players]

    pending = build_pending_queue(
        queue,
        results=results,
        completed=completed,
        failed=failed,
        retry_failed=retry_failed,
    )
    if retry_failed:
        logger.info("Retry-failed mode: %d players", len(pending))
    logger.info(
        "SoFIFA live bulk: target=%s queue=%d pending=%d resume=%s editions=%s",
        target,
        len(queue),
        len(pending),
        resume,
        editions,
    )

    overrides = load_sofifa_overrides()
    search_terms = load_search_term_overrides()
    ea_map = ea_sofifa_by_sportverse_id()
    scraped = 0
    skipped = 0

    with SofifaBrowserClient(sleep=sleep, headless=headless) as client:
        client.warm_up()
        logger.info("Browser warm-up complete — starting queue")

        for i, item in enumerate(pending, start=1):
            key = item_key(item)
            label = item.get("name") or key
            logger.info("[%d/%d] %s", i, len(pending), label)

            try:
                sofifa_id = resolve_sofifa_id(
                    item,
                    client,
                    overrides,
                    ea_map,
                    id_cache,
                    search_terms,
                    allow_search=search_unmapped,
                )
                if not sofifa_id:
                    failed[key] = "no_sofifa_id"
                    logger.warning("  skip — could not resolve SoFIFA id for %s", label)
                    skipped += 1
                    continue

                if key:
                    id_cache[key] = sofifa_id

                row = harvest_player_live(client, sofifa_id, editions=editions)
                row["sportverse_id"] = item.get("sportverse_id")
                row["legend_ovr"] = item.get("legend_ovr")
                row["resolved_name"] = label

                if (row.get("peak_overall") or 0) <= 0:
                    raise RuntimeError("Cloudflare blocked page — no rating parsed")

                by_key[key] = row
                results = list(by_key.values())
                write_json(OUT_PARTIAL, results)

                completed.add(key)
                failed.pop(key, None)
                scraped += 1
                logger.info("  ✓ sofifa=%s peak=%s", sofifa_id, row.get("peak_overall"))

            except Exception as exc:
                failed[key] = str(exc)
                logger.error("  ✗ %s: %s", label, exc)

            checkpoint["completed"] = sorted(completed)
            checkpoint["failed"] = failed
            checkpoint["id_cache"] = id_cache
            save_checkpoint(checkpoint)

    payload = {
        "version": 1,
        "target": target,
        "scraped_count": scraped,
        "skipped_count": skipped,
        "failed_count": len(failed),
        "players": results,
    }
    write_json(OUT_HISTORY, payload)
    logger.info(
        "Done: scraped=%d skipped=%d failed=%d → %s",
        scraped,
        skipped,
        len(failed),
        OUT_HISTORY,
    )
    return {
        "scraped": scraped,
        "skipped": skipped,
        "failed": len(failed),
        "output": str(OUT_HISTORY),
        "partial": str(OUT_PARTIAL),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Bulk live SoFIFA harvest with checkpoint/resume")
    parser.add_argument(
        "--target",
        default="legends-missing",
        choices=["legends-missing", "legends-all"],
        help="Player queue source (default: legend anchors not in FC26 CSV)",
    )
    parser.add_argument("--player-ids", help="Comma-separated SoFIFA ids (overrides --target)")
    parser.add_argument("--max-players", type=int, help="Limit queue size (testing)")
    parser.add_argument("--editions", choices=["last", "all"], default="last", help="last=1 page/player, all=every FIFA edition")
    parser.add_argument("--sleep", type=float, default=2.5, help="Delay between page loads")
    parser.add_argument("--no-headless", action="store_true", help="Show browser (recommended for Cloudflare)")
    parser.add_argument("--offline", action="store_true", help="No browser — use FC26 CSV + legend anchors (recommended)")
    parser.add_argument("--retry-failed", action="store_true", help="Re-run only players that failed or were skipped")
    parser.add_argument("--reset", action="store_true", help="Clear checkpoint + partial output and start fresh")
    parser.add_argument("--no-search", action="store_true", help="Only use known id maps — skip name search")
    parser.add_argument("--no-resume", action="store_true", help="Clear checkpoint before run (keeps partial output)")
    args = parser.parse_args()

    ids = None
    if args.player_ids:
        ids = [int(x.strip()) for x in args.player_ids.split(",") if x.strip()]

    if args.reset:
        for path in (CHECKPOINT, OUT_PARTIAL, OUT_HISTORY):
            if path.exists():
                path.unlink()
                logger.info("Removed %s", path)
    elif args.no_resume and CHECKPOINT.exists():
        CHECKPOINT.unlink()
        logger.info("Cleared checkpoint")

    summary = (
        harvest_offline_bulk(
            target=args.target,
            player_ids=ids,
            max_players=args.max_players,
            search_unmapped=not args.no_search,
        )
        if args.offline
        else harvest_live_bulk(
            target=args.target,
            player_ids=ids,
            resume=not args.no_resume,
            retry_failed=args.retry_failed,
            max_players=args.max_players,
            sleep=args.sleep,
            headless=not args.no_headless,
            editions=args.editions,
            search_unmapped=not args.no_search,
        )
    )
    print(f"\n✓ SoFIFA live bulk complete: {summary['output']}")
    print(f"  scraped={summary['scraped']} skipped={summary['skipped']} failed={summary['failed']}")
    print(f"  checkpoint: {CHECKPOINT}")
    if summary["scraped"] == 0 and summary["failed"] == 0:
        print("\n  Tip: omit --retry-failed for a full run, or use --reset to start fresh.")
    else:
        print("  Re-run the same command to resume after interruption.")


if __name__ == "__main__":
    main()
