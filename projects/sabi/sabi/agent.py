"""The Sabi agent: a plan -> act -> critic -> answer loop over typed tools.

This is deliberately *not* a free-running while-loop that hopes to converge. It
is a bounded, inspectable trajectory: the planner proposes a plan, the worker
executes its tool calls (resolving argument bindings against prior results and
passing every call through guardrails), a critic validates the gathered
evidence, and only then is an answer produced. Every phase is traced.
"""

from __future__ import annotations

from typing import Any

from .guardrails import GuardrailError, Guardrails
from .observability import Tracer
from .planner import Planner, RuleBasedPlanner
from .store import BusinessStore
from .tools import ToolContext, ToolRegistry
from .types import AgentResult, StepKind, TraceStep


def _resolve(value: Any, results: dict[str, dict[str, Any]]) -> Any:
    """Recursively replace ``{"$from": "tool.field"}`` bindings with concrete
    values from previously executed tools."""
    if isinstance(value, dict):
        if set(value.keys()) == {"$from"}:
            tool, _, field = value["$from"].partition(".")
            if tool not in results:
                raise GuardrailError(f"Binding references unexecuted tool '{tool}'")
            return results[tool][field]
        return {k: _resolve(v, results) for k, v in value.items()}
    if isinstance(value, list):
        return [_resolve(v, results) for v in value]
    return value


class Agent:
    def __init__(
        self,
        planner: Planner,
        registry: ToolRegistry,
        guardrails: Guardrails,
        tracer: Tracer,
    ) -> None:
        self.planner = planner
        self.registry = registry
        self.guardrails = guardrails
        self.tracer = tracer

    def run(self, request: str) -> AgentResult:
        steps: list[TraceStep] = [TraceStep(StepKind.USER, request)]

        with self.tracer.span("plan", {"request": request}):
            plan = self.planner.plan(request)
        steps.append(TraceStep(StepKind.PLAN, {"intent": plan.intent, "rationale": plan.rationale}))

        results: dict[str, dict[str, Any]] = {}
        error: str | None = None

        for call in plan.calls:
            try:
                args = _resolve(call.args, results)
                out = self.registry.call(call.name, args)
            except (GuardrailError, ValueError, KeyError) as exc:
                error = f"{call.name}: {exc}"
                steps.append(TraceStep(StepKind.TOOL, {"name": call.name, "error": str(exc)}))
                break
            results[call.name] = out
            steps.append(TraceStep(StepKind.TOOL, {"name": call.name, "args": args, "result": out}))
            # A required entity was not found: stop here and let the critic
            # explain, rather than building on missing evidence.
            if out.get("found") is False:
                break

        with self.tracer.span("critic"):
            verdict = plan.critic(results)
        ok = error is None and verdict.ok
        note = error or verdict.note
        steps.append(TraceStep(StepKind.CRITIC, {"ok": ok, "note": note}))

        # On success the plan formats a rich answer; on failure we surface the
        # critic's reason (or a safe generic message for unexpected errors).
        if ok:
            answer = plan.answer(results)
        elif error is not None:
            answer = "Sorry - I couldn't complete that safely."
        else:
            answer = verdict.note
        steps.append(TraceStep(StepKind.ANSWER, answer))
        return AgentResult(answer=answer, steps=steps, success=ok)


def build_agent(planner: Planner | None = None) -> Agent:
    """Wire a ready-to-run agent with the default store, tools and guardrails."""
    store = BusinessStore()
    tracer = Tracer()
    ctx = ToolContext(store=store, guardrails=_default_guardrails(), tracer=tracer)
    registry = ToolRegistry(ctx)
    return Agent(
        planner=planner or RuleBasedPlanner(store),
        registry=registry,
        guardrails=ctx.guardrails,
        tracer=tracer,
    )


def _default_guardrails() -> Guardrails:
    return Guardrails(
        allowed_tools=frozenset(
            {"check_inventory", "calculate_total", "lookup_customer", "create_invoice", "query_sales"}
        )
    )
