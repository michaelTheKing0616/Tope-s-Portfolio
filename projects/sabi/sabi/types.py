"""Core data types for the Sabi agent.

Kept dependency-free (stdlib dataclasses) so the whole system runs with nothing
but a Python 3.10+ interpreter — reviewers can clone and run it offline.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable


class StepKind(str, Enum):
    """The kinds of step that appear in an agent trajectory."""

    USER = "user"
    PLAN = "plan"
    TOOL = "tool"
    CRITIC = "critic"
    ANSWER = "answer"


@dataclass(frozen=True)
class ToolCall:
    """A request to invoke a named tool with JSON-serialisable arguments.

    Argument values may contain a binding reference of the form
    ``{"$from": "tool_name.field"}`` which the agent resolves against the results
    of previously executed tools before the call is made.
    """

    name: str
    args: dict[str, Any]


@dataclass
class ToolResult:
    name: str
    args: dict[str, Any]
    result: dict[str, Any]
    ok: bool = True
    error: str | None = None


@dataclass
class TraceStep:
    kind: StepKind
    content: Any
    duration_ms: float = 0.0


@dataclass
class Plan:
    """A planner's output: a human-readable rationale plus the ordered tool
    calls to make, a critic to validate the gathered results, and a template
    that turns those results into the final natural-language answer."""

    intent: str
    rationale: list[str]
    calls: list[ToolCall]
    critic: Callable[[dict[str, dict[str, Any]]], "CriticVerdict"]
    answer: Callable[[dict[str, dict[str, Any]]], str]


@dataclass
class CriticVerdict:
    ok: bool
    note: str


@dataclass
class AgentResult:
    answer: str
    steps: list[TraceStep] = field(default_factory=list)
    success: bool = True
