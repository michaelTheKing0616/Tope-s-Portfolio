"""Sabi - an agentic AI assistant for African SMEs.

A deterministic, offline-runnable reference implementation of a reliable agent:
planner -> typed tools -> critic -> answer, with guardrails, observability and an
eval harness. Swap ``RuleBasedPlanner`` for an LLM-backed planner to go live.
"""

from .agent import Agent, build_agent
from .evals import run_evals
from .types import AgentResult, StepKind

__all__ = ["Agent", "build_agent", "run_evals", "AgentResult", "StepKind"]
__version__ = "0.1.0"
