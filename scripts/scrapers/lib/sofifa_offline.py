"""Offline legend ratings — no browser, no Cloudflare."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
BULK_INDEX = ROOT / "sportverse" / "data" / "raw" / "open-football" / "sofifa" / "player-ratings-index.json"

_csv_by_sofifa: dict[int, dict[str, Any]] | None = None


def load_csv_by_sofifa_id() -> dict[int, dict[str, Any]]:
    global _csv_by_sofifa
    if _csv_by_sofifa is not None:
        return _csv_by_sofifa

    _csv_by_sofifa = {}
    if not BULK_INDEX.exists():
        return _csv_by_sofifa

    data = json.loads(BULK_INDEX.read_text(encoding="utf-8"))
    for row in data.get("players", []):
        sid = row.get("sofifa_id")
        if sid is not None:
            _csv_by_sofifa[int(sid)] = row
    return _csv_by_sofifa


def harvest_legend_offline(
    item: dict[str, Any],
    *,
    sofifa_id: int | None = None,
) -> dict[str, Any]:
    """Build a legend rating row without HTTP — CSV snapshot or legend anchor OVR."""
    csv = load_csv_by_sofifa_id().get(int(sofifa_id)) if sofifa_id else None
    legend_ovr = item.get("legend_ovr") or 0

    if csv and (csv.get("overall") or 0) > 0:
        peak = int(csv["overall"])
        attrs = csv.get("attributes") or {}
        source = "sofifa_csv_fc26"
        edition_label = f"FC26 ({csv.get('team') or 'active'})"
    elif legend_ovr > 0:
        peak = int(legend_ovr)
        attrs = {}
        source = "legend_anchor"
        edition_label = "legend-ratings.json anchor"
    else:
        peak = 0
        attrs = {}
        source = "unresolved"
        edition_label = "none"

    return {
        "sofifa_id": sofifa_id,
        "peak_overall": peak,
        "editions": [
            {
                "overall": peak,
                "potential": csv.get("potential") if csv else None,
                "attributes": attrs,
                "source": source,
                "version_label": edition_label,
            }
        ],
        "edition_count": 1,
        "source": source,
        "sportverse_id": item.get("sportverse_id"),
        "legend_ovr": legend_ovr,
        "resolved_name": item.get("name"),
        "attributes": attrs,
    }


def resolve_offline_sofifa_id(
    item: dict[str, Any],
    overrides: dict[str, int],
    ea_map: dict[str, int],
) -> int | None:
    if item.get("sofifa_id"):
        return int(item["sofifa_id"])
    sv_id = item.get("sportverse_id")
    if sv_id:
        hit = overrides.get(str(sv_id)) or ea_map.get(str(sv_id))
        if hit:
            return int(hit)
    tm_id = item.get("tm_id")
    if tm_id:
        hit = overrides.get(str(tm_id)) or overrides.get(f"tm-{tm_id}")
        if hit:
            return int(hit)
    return None
