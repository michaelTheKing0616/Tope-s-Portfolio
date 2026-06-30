"""Minimal tracing for agent runs.

Real deployments would export these spans to an OpenTelemetry collector
(Jaeger/Tempo) and aggregate cost/latency. Here we keep an in-process span list
that is enough to reason about, render, and assert on in tests.
"""

from __future__ import annotations

import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any, Iterator


@dataclass
class Span:
    name: str
    inputs: dict[str, Any]
    output: Any = None
    duration_ms: float = 0.0
    error: str | None = None


@dataclass
class Tracer:
    spans: list[Span] = field(default_factory=list)

    @contextmanager
    def span(self, name: str, inputs: dict[str, Any] | None = None) -> Iterator[Span]:
        sp = Span(name=name, inputs=inputs or {})
        start = time.perf_counter()
        try:
            yield sp
        except Exception as exc:  # record then re-raise; never swallow silently
            sp.error = repr(exc)
            raise
        finally:
            sp.duration_ms = round((time.perf_counter() - start) * 1000, 2)
            self.spans.append(sp)

    @property
    def total_ms(self) -> float:
        return round(sum(s.duration_ms for s in self.spans), 2)

    def render(self) -> str:
        lines = ["trace:"]
        for s in self.spans:
            status = "ERR" if s.error else "ok"
            lines.append(f"  [{status}] {s.name} ({s.duration_ms}ms)")
        lines.append(f"  total: {self.total_ms}ms")
        return "\n".join(lines)
