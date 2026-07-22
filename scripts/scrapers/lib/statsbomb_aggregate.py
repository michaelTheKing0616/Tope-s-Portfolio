"""Aggregate StatsBomb open-data events into player-match advanced metrics."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

import pandas as pd

PITCH_LENGTH = 120.0
PROGRESSIVE_DISTANCE = 10.0  # StatsBomb coords (~ yards on 120-unit pitch)


def event_type_name(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get("name", ""))
    return str(value or "")


def nested_name(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get("name", ""))
    return str(value or "")


def event_id(value: Any) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    return str(value)


def player_id_value(value: Any) -> int | str | None:
    """StatsBomb open data may use int ids or UUID strings."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, int):
        return value
    text = str(value).strip()
    if not text or text.lower() == "nan":
        return None
    try:
        return int(text)
    except (TypeError, ValueError):
        return text


def parse_clock(value: Any, fallback: float = 0.0) -> float:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return fallback
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text:
        return fallback
    if ":" in text:
        mins, secs = text.split(":", 1)
        return float(mins) + float(secs) / 60.0
    return float(text)


def minutes_from_positions(positions: Any, default: float = 0.0) -> float:
    if not isinstance(positions, list) or not positions:
        return default
    total = 0.0
    for seg in positions:
        if not isinstance(seg, dict):
            continue
        start = parse_clock(seg.get("from"), 0.0)
        end = parse_clock(seg.get("to"), 90.0)
        total += max(0.0, end - start)
    return total


def empty_player_stats(player_id: int | str, player_name: str, team_name: str) -> dict[str, Any]:
    return {
        "player_id": player_id,
        "player_name": player_name,
        "team_name": team_name,
        "minutes": 0.0,
        "appearances": 0,
        "goals": 0,
        "np_goals": 0,
        "assists": 0,
        "shots": 0,
        "shots_on_target": 0,
        "xg": 0.0,
        "npxg": 0.0,
        "xa": 0.0,
        "key_passes": 0,
        "sca": 0,
        "gca": 0,
        "passes": 0,
        "progressive_passes": 0,
        "passes_into_final_third": 0,
        "passes_into_penalty_area": 0,
        "crosses": 0,
        "carries": 0,
        "progressive_carries": 0,
        "carries_into_penalty_area": 0,
        "dribbles": 0,
        "successful_dribbles": 0,
        "pressures": 0,
        "tackles": 0,
        "interceptions": 0,
        "blocks": 0,
        "clearances": 0,
        "ball_recoveries": 0,
        "aerials": 0,
        "aerials_won": 0,
        "fouls_committed": 0,
        "fouls_drawn": 0,
        "yellow_cards": 0,
        "red_cards": 0,
        "errors_leading_to_shot": 0,
        "gk_saves": 0,
        "gk_goals_against": 0,
        "gk_psxg": 0.0,
    }


def infer_attacking_direction(events: pd.DataFrame, team_name: str) -> int:
    """Return +1 if team attacks toward x=120, else -1."""
    team_shots = events[
        (events["team"] == team_name)
        & (events["type"].apply(event_type_name) == "Shot")
        & events["location"].notna()
    ]
    if team_shots.empty:
        return 1
    xs = team_shots["location"].apply(lambda loc: loc[0] if isinstance(loc, list) and loc else 60)
    return 1 if xs.mean() >= 60 else -1


def forward_progress(start: Any, end: Any, direction: int) -> float:
    if not isinstance(start, list) or not isinstance(end, list) or len(start) < 1 or len(end) < 1:
        return 0.0
    delta = (end[0] - start[0]) * direction
    return delta


def in_final_third_x(x: float, direction: int) -> bool:
    return x >= 80 if direction > 0 else x <= 40


def in_penalty_area(loc: Any) -> bool:
    if not isinstance(loc, list) or len(loc) < 2:
        return False
    x, y = loc[0], loc[1]
    return x >= 102 and 18 <= y <= 62


def aggregate_match(events: pd.DataFrame, lineups: dict[str, pd.DataFrame], match_meta: dict[str, Any]) -> list[dict[str, Any]]:
    """Return per-player advanced metrics for one match."""
    if events.empty:
        return []

    players: dict[int | str, dict[str, Any]] = {}
    team_by_player: dict[int | str, str] = {}

    for team_name, lineup_df in lineups.items():
        for _, row in lineup_df.iterrows():
            pid = player_id_value(row.get("player_id"))
            if pid is None:
                continue
            name = str(row.get("player_name") or row.get("player_nickname") or pid)
            team_by_player[pid] = team_name
            stats = empty_player_stats(pid, name, team_name)
            stats["minutes"] = minutes_from_positions(row.get("positions"))
            cards = row.get("cards")
            if isinstance(cards, list):
                for card in cards:
                    if not isinstance(card, dict):
                        continue
                    card_type = str(card.get("card_type", ""))
                    if "Yellow" in card_type and "Second" not in card_type:
                        stats["yellow_cards"] += 1
                    if "Red" in card_type or "Second Yellow" in card_type:
                        stats["red_cards"] += 1
            if stats["minutes"] >= 1:
                stats["appearances"] = 1
            players[pid] = stats

    team_direction = {
        team: infer_attacking_direction(events, team)
        for team in lineups.keys()
    }

    shots = events[events["type"].apply(event_type_name) == "Shot"].copy()
    shot_xg_by_id = {
        event_id(row["id"]): float(row.get("shot_statsbomb_xg") or 0.0)
        for _, row in shots.iterrows()
        if event_id(row.get("id"))
    }

    for _, row in events.iterrows():
        etype = event_type_name(row.get("type"))
        pid = player_id_value(row.get("player_id"))
        if pid is None:
            continue
        team_name = str(row.get("team") or team_by_player.get(pid, ""))
        if pid not in players:
            players[pid] = empty_player_stats(pid, str(row.get("player") or pid), team_name)
            team_by_player[pid] = team_name
        stats = players[pid]
        direction = team_direction.get(team_name, 1)

        if etype == "Shot":
            stats["shots"] += 1
            xg = float(row.get("shot_statsbomb_xg") or 0.0)
            stats["xg"] += xg
            shot_type = nested_name(row.get("shot_type"))
            is_penalty = shot_type == "Penalty"
            if not is_penalty:
                stats["npxg"] += xg
            outcome = nested_name(row.get("shot_outcome"))
            if outcome == "Goal":
                stats["goals"] += 1
                if not is_penalty:
                    stats["np_goals"] += 1
            if outcome in {"Saved", "Saved to Post", "Goal"}:
                stats["shots_on_target"] += 1

        elif etype == "Pass":
            stats["passes"] += 1
            if bool(row.get("pass_goal_assist")):
                stats["assists"] += 1
                stats["gca"] += 1
            if bool(row.get("pass_shot_assist")):
                stats["key_passes"] += 1
                stats["sca"] += 1
                assisted_id = event_id(row.get("pass_assisted_shot_id"))
                if assisted_id:
                    stats["xa"] += shot_xg_by_id.get(assisted_id, 0.0)
            if bool(row.get("pass_cross")):
                stats["crosses"] += 1
            start = row.get("location")
            end = row.get("pass_end_location")
            prog = forward_progress(start, end, direction)
            if prog >= PROGRESSIVE_DISTANCE:
                stats["progressive_passes"] += 1
            if isinstance(end, list) and len(end) >= 1 and in_final_third_x(end[0], direction):
                stats["passes_into_final_third"] += 1
            if in_penalty_area(end):
                stats["passes_into_penalty_area"] += 1

        elif etype == "Carry":
            stats["carries"] += 1
            start = row.get("location")
            end = row.get("carry_end_location")
            if forward_progress(start, end, direction) >= PROGRESSIVE_DISTANCE:
                stats["progressive_carries"] += 1
            if in_penalty_area(end):
                stats["carries_into_penalty_area"] += 1

        elif etype == "Pressure":
            stats["pressures"] += 1
        elif etype == "Dribble":
            stats["dribbles"] += 1
            if nested_name(row.get("dribble_outcome")) in {"Complete", "Success"}:
                stats["successful_dribbles"] += 1
        elif etype == "Block":
            stats["blocks"] += 1
        elif etype == "Clearance":
            stats["clearances"] += 1
        elif etype == "Interception":
            stats["interceptions"] += 1
        elif etype == "Ball Recovery":
            stats["ball_recoveries"] += 1
        elif etype == "Duel":
            duel_type = nested_name(row.get("duel_type"))
            outcome = nested_name(row.get("duel_outcome"))
            if "Aerial" in duel_type:
                stats["aerials"] += 1
                if outcome in {"Won", "Success", "Success In Play"}:
                    stats["aerials_won"] += 1
            if duel_type == "Tackle" and outcome in {"Won", "Success", "Success In Play"}:
                stats["tackles"] += 1
        elif etype == "Foul Committed":
            stats["fouls_committed"] += 1
        elif etype == "Foul Won":
            stats["fouls_drawn"] += 1
        elif etype == "Bad Behaviour":
            card = nested_name(row.get("bad_behaviour_card"))
            if card == "Yellow Card":
                stats["yellow_cards"] += 1
            elif card == "Red Card":
                stats["red_cards"] += 1
        elif etype == "Goal Keeper":
            gk_type = nested_name(row.get("goalkeeper_type"))
            outcome = nested_name(row.get("goalkeeper_outcome"))
            if gk_type in {"Save", "Shot Faced"} and outcome in {"Saved", "Saved To Post", "Saved to Post"}:
                stats["gk_saves"] += 1
            if gk_type in {"Goal Conceded", "Penalty Conceded"}:
                stats["gk_goals_against"] += 1
        elif etype == "Error":
            if nested_name(row.get("miscommunication")) or nested_name(row.get("error_leading_to_shot")):
                stats["errors_leading_to_shot"] += 1

    out = []
    for stats in players.values():
        minutes = max(stats["minutes"], 0.0)
        stats["minutes"] = round(minutes, 1)
        per90 = (90.0 / minutes) if minutes >= 1 else None
        stats["per90"] = {}
        if per90:
            for key in (
                "goals", "np_goals", "assists", "shots", "xg", "npxg", "xa",
                "key_passes", "sca", "gca", "passes", "progressive_passes",
                "progressive_carries", "pressures", "tackles", "interceptions",
                "blocks", "clearances", "ball_recoveries",
            ):
                stats["per90"][key] = round(float(stats[key]) * per90, 3)
        stats["match_id"] = match_meta.get("match_id")
        stats["competition_id"] = match_meta.get("competition_id")
        stats["season_id"] = match_meta.get("season_id")
        stats["competition_name"] = match_meta.get("competition_name")
        stats["season_name"] = match_meta.get("season_name")
        stats["match_date"] = match_meta.get("match_date")
        out.append(stats)
    return out


def rollup_player_season(player_match_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Roll up player-match rows to player/competition/season aggregates."""
    grouped: dict[tuple, dict[str, Any]] = {}

    sum_keys = [
        "minutes", "appearances", "goals", "np_goals", "assists", "shots", "shots_on_target",
        "xg", "npxg", "xa", "key_passes", "sca", "gca", "passes", "progressive_passes",
        "passes_into_final_third", "passes_into_penalty_area", "crosses", "carries",
        "progressive_carries", "carries_into_penalty_area", "dribbles", "successful_dribbles",
        "pressures", "tackles", "interceptions", "blocks", "clearances", "ball_recoveries",
        "aerials", "aerials_won", "fouls_committed", "fouls_drawn", "yellow_cards", "red_cards",
        "errors_leading_to_shot", "gk_saves", "gk_goals_against",
    ]

    for row in player_match_rows:
        key = (
            row["player_id"],
            row.get("competition_id"),
            row.get("season_id"),
            row.get("team_name"),
        )
        if key not in grouped:
            grouped[key] = {
                "player_id": row["player_id"],
                "player_name": row["player_name"],
                "team_name": row.get("team_name"),
                "competition_id": row.get("competition_id"),
                "season_id": row.get("season_id"),
                "competition_name": row.get("competition_name"),
                "season_name": row.get("season_name"),
                "matches": 0,
            }
            for k in sum_keys:
                grouped[key][k] = 0 if k != "minutes" else 0.0
        agg = grouped[key]
        agg["matches"] += 1
        for k in sum_keys:
            agg[k] += float(row.get(k) or 0)

    out = []
    for agg in grouped.values():
        minutes = max(float(agg["minutes"]), 1.0)
        per90 = {}
        for k in sum_keys:
            if k in {"minutes", "appearances", "matches"}:
                continue
            per90[k] = round(float(agg[k]) * 90.0 / minutes, 4)
        agg["per90"] = per90
        agg["source"] = "statsbomb_open_data"
        out.append(agg)
    return out
