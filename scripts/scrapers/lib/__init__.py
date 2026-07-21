"""Shared helpers for open-football harvest scripts."""

from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
RAW_DIR = ROOT / "sportverse" / "data" / "raw" / "open-football"
STATSBOMB_DIR = RAW_DIR / "statsbomb"
FBREF_DIR = RAW_DIR / "fbref"
SOFIFA_DIR = RAW_DIR / "sofifa"
LOG_DIR = RAW_DIR / "logs"
CHECKPOINT_PATH = RAW_DIR / "checkpoint.json"


def ensure_dirs() -> None:
    for path in (
        RAW_DIR,
        STATSBOMB_DIR,
        FBREF_DIR,
        SOFIFA_DIR,
        LOG_DIR,
        STATSBOMB_DIR / "player-match",
        STATSBOMB_DIR / "events-cache",
    ):
        path.mkdir(parents=True, exist_ok=True)


def setup_logging(name: str = "harvest") -> logging.Logger:
    ensure_dirs()
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger
    logger.setLevel(logging.INFO)
    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
    fh = logging.FileHandler(LOG_DIR / f"{name}.log")
    fh.setFormatter(fmt)
    sh = logging.StreamHandler()
    sh.setFormatter(fmt)
    logger.addHandler(fh)
    logger.addHandler(sh)
    return logger


def load_checkpoint() -> dict[str, Any]:
    if CHECKPOINT_PATH.exists():
        return json.loads(CHECKPOINT_PATH.read_text(encoding="utf-8"))
    return {
        "version": 1,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "statsbomb": {"completed_matches": [], "failed_matches": {}},
        "fbref": {"completed": [], "failed": {}},
    }


def save_checkpoint(state: dict[str, Any]) -> None:
    ensure_dirs()
    state["updated_at"] = datetime.now(timezone.utc).isoformat()
    tmp = CHECKPOINT_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2), encoding="utf-8")
    tmp.replace(CHECKPOINT_PATH)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    tmp.replace(path)


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def sleep_politely(seconds: float) -> None:
    if seconds > 0:
        time.sleep(seconds)


def pid_is_running(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False
