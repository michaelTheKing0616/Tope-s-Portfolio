"""Core data types and errors for the Alo pipeline.

Stdlib dataclasses only — kept dependency-free so the pipeline runs offline.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


class TransientError(Exception):
    """A retryable failure (e.g. a flaky provider). The orchestrator backs off
    and retries these; anything else is treated as fatal for the job."""


class QualityError(Exception):
    """A quality gate rejected a stage's output. Raised between stages so a bad
    result is caught before the next stage builds on it."""


@dataclass(frozen=True)
class Scene:
    index: int
    narration: str
    image_prompt: str


@dataclass(frozen=True)
class Script:
    title: str
    scenes: tuple[Scene, ...]


@dataclass
class Artifact:
    """A produced asset. `ref` is an opaque locator (a path or stub URI); `meta`
    carries stage-specific detail like duration or dimensions."""

    kind: str  # "script" | "audio" | "image" | "video" | "captions"
    ref: str
    meta: dict[str, Any] = field(default_factory=dict)


@dataclass
class StageResult:
    name: str
    output: dict[str, Any]
    artifacts: list[Artifact] = field(default_factory=list)
    cached: bool = False
    attempts: int = 1


@dataclass
class PipelineResult:
    title: str
    artifacts: list[Artifact] = field(default_factory=list)
    trace: list[dict[str, Any]] = field(default_factory=list)
    success: bool = True
    error: str | None = None

    def by_kind(self, kind: str) -> list[Artifact]:
        return [a for a in self.artifacts if a.kind == kind]
