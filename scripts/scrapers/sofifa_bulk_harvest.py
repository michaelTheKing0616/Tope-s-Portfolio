"""
Bulk SoFIFA / EA FC ratings harvest from local CSV dumps (no HTTP — Cloudflare-safe).

Primary source: sportverse/FC26_20250921.csv (~18k players, SoFIFA export).
Fallback:      sportverse/eafc26_player_ratings/ea_fc26_players.csv

Crosswalks to Sportverse player ids via name + nationality (+ existing ea-fc26-index).

Output: sportverse/data/raw/open-football/sofifa/player-ratings-index.json
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path
from typing import Any

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from lib import ensure_dirs, setup_logging, write_json  # noqa: E402

SOFIFA_DIR = ROOT / "sportverse" / "data" / "raw" / "open-football" / "sofifa"
FC26_CSV = ROOT / "sportverse" / "FC26_20250921.csv"
EA_CSV = ROOT / "sportverse" / "eafc26_player_ratings" / "ea_fc26_players.csv"
PLAYERS_JSON = ROOT / "sportverse" / "packages" / "sports-db" / "data" / "players-extended.json"
EA_INDEX_JSON = ROOT / "sportverse" / "packages" / "sports-db" / "data" / "ea-fc26-index.json"
FAME_JSON = ROOT / "sportverse" / "packages" / "sports-db" / "data" / "fame-index.json"
OUT_INDEX = SOFIFA_DIR / "player-ratings-index.json"
OUT_MANIFEST = SOFIFA_DIR / "manifest.json"

logger = setup_logging("sofifa-bulk")

EA_POS_TO_QUIZ = {
    "GK": "GK",
    "CB": "CB",
    "LCB": "CB",
    "RCB": "CB",
    "LB": "FB",
    "RB": "FB",
    "LWB": "FB",
    "RWB": "FB",
    "CDM": "DM",
    "LDM": "DM",
    "RDM": "DM",
    "CM": "CM",
    "LCM": "CM",
    "RCM": "CM",
    "CAM": "AM",
    "LAM": "AM",
    "RAM": "AM",
    "LW": "W",
    "RW": "W",
    "LM": "W",
    "RM": "W",
    "ST": "ST",
    "CF": "ST",
    "LS": "ST",
    "RS": "ST",
}


def normalize_name(name: str) -> str:
    text = unicodedata.normalize("NFD", name or "")
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = re.sub(r"[^a-z0-9\s]", " ", text.lower())
    return re.sub(r"\s+", " ", text).strip()


def is_stub_id(player_id: str) -> bool:
    return (player_id or "").startswith("not-applicable-")


def id_rank_score(player_id: str, fame_score: float, club_count: int) -> float:
    score = fame_score
    if is_stub_id(player_id):
        score -= 10_000
    if player_id.startswith("tm-"):
        score += 100
    if "-" not in player_id:
        score += 50
    score += min(club_count, 20)
    return score


def map_ea_position(raw: str) -> str:
    pos = (raw or "").split(",")[0].strip().upper()
    return EA_POS_TO_QUIZ.get(pos, "CM")


def load_players_index() -> tuple[dict[str, list[dict]], dict[str, str], dict[str, float]]:
    players = json.loads(PLAYERS_JSON.read_text(encoding="utf-8"))
    by_norm: dict[str, list[dict]] = {}
    by_tm: dict[str, str] = {}
    for p in players:
        norm = normalize_name(p.get("name") or "")
        if norm:
            by_norm.setdefault(norm, []).append(p)
        tm = p.get("tmId")
        if tm:
            by_tm[str(tm)] = p["id"]
    fame: dict[str, float] = {}
    if FAME_JSON.exists():
        for row in json.loads(FAME_JSON.read_text(encoding="utf-8")):
            fame[row["playerId"]] = float(row.get("fameScore") or 0)
    return by_norm, by_tm, fame


def load_ea_index_by_sofifa_id() -> dict[str, str]:
    if not EA_INDEX_JSON.exists():
        return {}
    data = json.loads(EA_INDEX_JSON.read_text(encoding="utf-8"))
    out: dict[str, str] = {}
    for row in data:
        ea_id = str(row.get("eaId") or "")
        sv_id = row.get("playerId") or row.get("id")
        if ea_id and sv_id:
            out[ea_id] = sv_id
    return out


def resolve_player_id(
    name: str,
    nationality: str,
    sofifa_id: str,
    by_norm: dict[str, list[dict]],
    by_tm: dict[str, str],
    fame: dict[str, float],
    ea_by_sofifa: dict[str, str],
) -> str | None:
    hit = ea_by_sofifa.get(sofifa_id)
    if hit and not is_stub_id(hit):
        return hit

    candidates = by_norm.get(normalize_name(name)) or []
    if not candidates:
        return None

    real = [p for p in candidates if not is_stub_id(p["id"])]
    if real:
        candidates = real

    if nationality:
        nat = nationality.lower().split()[0]
        nat_match = [p for p in candidates if nat in (p.get("nationality") or "").lower()]
        if len(nat_match) == 1:
            return nat_match[0]["id"]
        if nat_match:
            candidates = nat_match

    if len(candidates) == 1:
        return candidates[0]["id"]

    ranked = sorted(
        candidates,
        key=lambda p: id_rank_score(p["id"], fame.get(p["id"], 0), len(p.get("clubs") or [])),
        reverse=True,
    )
    if ranked and id_rank_score(ranked[0]["id"], fame.get(ranked[0]["id"], 0), len(ranked[0].get("clubs") or [])) > -5000:
        return ranked[0]["id"]
    return None


def _safe_int(v: Any, default: int = 0) -> int:
    try:
        if v is None or (isinstance(v, float) and pd.isna(v)):
            return default
        return int(v)
    except (TypeError, ValueError):
        return default


def row_from_fc26_csv(row: dict[str, Any]) -> dict[str, Any]:
    positions = str(row.get("player_positions") or "")
    if positions == "nan":
        positions = ""
    return {
        "sofifa_id": _safe_int(row.get("player_id")),
        "player_url": row.get("player_url") if pd.notna(row.get("player_url")) else None,
        "name": row.get("long_name") or row.get("short_name") or "",
        "short_name": row.get("short_name") if pd.notna(row.get("short_name")) else "",
        "overall": _safe_int(row.get("overall")),
        "potential": _safe_int(row.get("potential")),
        "age": _safe_int(row.get("age")),
        "nationality": row.get("nationality_name") if pd.notna(row.get("nationality_name")) else "",
        "team": row.get("club_name") if pd.notna(row.get("club_name")) else "",
        "league": row.get("league_name") if pd.notna(row.get("league_name")) else "",
        "ea_position": positions.split(",")[0].strip() if positions else "",
        "quiz_position": map_ea_position(positions),
        "fifa_version": str(row.get("fifa_version") or "26"),
        "attributes": {
            "pac": _safe_int(row.get("pace")),
            "sho": _safe_int(row.get("shooting")),
            "pas": _safe_int(row.get("passing")),
            "dri": _safe_int(row.get("dribbling")),
            "def": _safe_int(row.get("defending")),
            "phy": _safe_int(row.get("physic")),
        },
        "source": "sofifa_csv_fc26",
        "edition": "fc26",
    }


def harvest_from_csv(csv_path: Path | None = None) -> dict[str, Any]:
    ensure_dirs()
    SOFIFA_DIR.mkdir(parents=True, exist_ok=True)

    path = csv_path or (FC26_CSV if FC26_CSV.exists() else EA_CSV)
    if not path.exists():
        raise FileNotFoundError(f"No SoFIFA CSV found at {FC26_CSV} or {EA_CSV}")

    logger.info("Loading SoFIFA CSV: %s", path)
    df = pd.read_csv(path, low_memory=False)
    logger.info("  %d rows", len(df))

    by_norm, by_tm, fame = load_players_index()
    ea_by_sofifa = load_ea_index_by_sofifa_id()

    records: list[dict[str, Any]] = []
    matched = 0
    for _, raw in df.iterrows():
        row = row_from_fc26_csv(raw.to_dict())
        sv_id = resolve_player_id(
            row["name"] or "",
            row.get("nationality") or "",
            str(row["sofifa_id"]),
            by_norm,
            by_tm,
            fame,
            ea_by_sofifa,
        )
        if sv_id:
            row["sportverse_id"] = sv_id
            matched += 1
        records.append(row)

    payload = {
        "version": 1,
        "source_file": str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path),
        "fifa_edition": "fc26",
        "player_count": len(records),
        "matched_count": matched,
        "players": records,
    }
    write_json(OUT_INDEX, payload)
    write_json(
        OUT_MANIFEST,
        {
            "version": 1,
            "source": "local_csv",
            "csv": payload["source_file"],
            "player_count": len(records),
            "matched_count": matched,
            "output": str(OUT_INDEX.relative_to(ROOT)),
        },
    )
    logger.info("Wrote %d players (%d matched) → %s", len(records), matched, OUT_INDEX)
    return {
        "player_count": len(records),
        "matched_count": matched,
        "output": str(OUT_INDEX),
    }


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Bulk SoFIFA harvest from local FC26 CSV (no HTTP)")
    parser.add_argument("--csv", type=Path, help="Override CSV path")
    args = parser.parse_args()
    summary = harvest_from_csv(args.csv)
    print(f"\n✓ SoFIFA bulk harvest complete: {summary['output']}")
    print(f"  {summary['player_count']} players, {summary['matched_count']} matched to Sportverse ids")


if __name__ == "__main__":
    main()
