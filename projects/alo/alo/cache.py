"""A tiny content-addressed cache.

Stages are keyed by a stable hash of their inputs, so a re-run (or a retry of a
later stage) never recomputes work that already succeeded. In-memory by default;
the same interface could be backed by disk or Redis without touching callers.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any


def key_for(stage: str, payload: Any) -> str:
    blob = json.dumps(payload, sort_keys=True, default=str)
    return f"{stage}:{hashlib.sha256(blob.encode('utf-8')).hexdigest()[:16]}"


class MemoryCache:
    def __init__(self) -> None:
        self._store: dict[str, Any] = {}
        self.hits = 0
        self.misses = 0

    def get(self, key: str) -> Any | None:
        if key in self._store:
            self.hits += 1
            return self._store[key]
        self.misses += 1
        return None

    def set(self, key: str, value: Any) -> None:
        self._store[key] = value
