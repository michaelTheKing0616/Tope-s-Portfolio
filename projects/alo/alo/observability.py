"""Minimal tracing so every stage, retry and cache hit is inspectable.

Mirrors the lightweight tracer used across these projects: spans record a name,
duration and arbitrary metadata, collected into a flat list you can print or
ship to a real backend.
"""

from __future__ import annotations

import time
from contextlib import contextmanager
from typing import Any, Iterator


class Tracer:
    def __init__(self) -> None:
        self.events: list[dict[str, Any]] = []

    @contextmanager
    def span(self, name: str, meta: dict[str, Any] | None = None) -> Iterator[dict[str, Any]]:
        record: dict[str, Any] = {"name": name, "meta": dict(meta or {})}
        start = time.perf_counter()
        try:
            yield record
        finally:
            record["ms"] = round((time.perf_counter() - start) * 1000, 2)
            self.events.append(record)

    def note(self, name: str, **meta: Any) -> None:
        self.events.append({"name": name, "meta": meta, "ms": 0.0})
