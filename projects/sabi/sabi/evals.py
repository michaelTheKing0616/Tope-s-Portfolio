"""Evaluation harness.

In 2026 agentic-AI hiring, the eval harness is the single clearest signal that
someone treats agents as engineering rather than demos. This one is small but
real: a labelled dataset, a runner that executes the agent per case in
isolation, and aggregate metrics (task success + tool-call accuracy) that could
gate a CI pipeline.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .agent import build_agent
from .types import StepKind


@dataclass
class EvalCase:
    name: str
    request: str
    expect_intent: str
    expect_success: bool
    expect_tools: list[str]
    expect_answer_contains: str = ""


DATASET: list[EvalCase] = [
    EvalCase(
        name="stock_in_range",
        request="A customer wants 3 bags of rice - do we have stock and what's the total?",
        expect_intent="stock_check",
        expect_success=True,
        expect_tools=["check_inventory", "calculate_total"],
        expect_answer_contains="186,000",
    ),
    EvalCase(
        name="stock_out_of_range",
        request="Customer wants 20 bags of rice, in stock?",
        expect_intent="stock_check",
        expect_success=False,  # only 8 in stock
        expect_tools=["check_inventory", "calculate_total"],
    ),
    EvalCase(
        name="invoice_known_customer",
        request="Send an invoice to Amaka for 2 cartons of milk.",
        expect_intent="create_invoice",
        expect_success=True,
        expect_tools=["lookup_customer", "check_inventory", "create_invoice"],
        expect_answer_contains="37,000",
    ),
    EvalCase(
        name="invoice_unknown_customer",
        request="Send an invoice to Zainab for 2 milk.",
        expect_intent="create_invoice",
        expect_success=False,
        expect_tools=["lookup_customer"],
    ),
    EvalCase(
        name="sales_report",
        request="What were my best-selling items this week?",
        expect_intent="sales_report",
        expect_success=True,
        expect_tools=["query_sales"],
        expect_answer_contains="Rice",
    ),
]


@dataclass
class CaseResult:
    name: str
    intent_ok: bool
    success_ok: bool
    tools_ok: bool
    answer_ok: bool

    @property
    def passed(self) -> bool:
        return self.intent_ok and self.success_ok and self.tools_ok and self.answer_ok


@dataclass
class EvalReport:
    cases: list[CaseResult] = field(default_factory=list)

    @property
    def task_success_rate(self) -> float:
        return _rate(c.passed for c in self.cases)

    @property
    def tool_accuracy(self) -> float:
        return _rate(c.tools_ok for c in self.cases)

    def render(self) -> str:
        lines = ["Sabi eval report", "-" * 32]
        for c in self.cases:
            mark = "PASS" if c.passed else "FAIL"
            lines.append(
                f"[{mark}] {c.name:24} intent={c.intent_ok} success={c.success_ok} "
                f"tools={c.tools_ok} answer={c.answer_ok}"
            )
        lines.append("-" * 32)
        lines.append(f"task success: {self.task_success_rate * 100:.0f}%")
        lines.append(f"tool accuracy: {self.tool_accuracy * 100:.0f}%")
        return "\n".join(lines)


def _rate(flags) -> float:
    flags = list(flags)
    return sum(1 for f in flags if f) / len(flags) if flags else 0.0


def _tools_called(steps) -> list[str]:
    out = []
    for s in steps:
        if s.kind is StepKind.TOOL and isinstance(s.content, dict) and "name" in s.content:
            out.append(s.content["name"])
    return out


def run_evals(dataset: list[EvalCase] | None = None) -> EvalReport:
    cases = dataset if dataset is not None else DATASET
    report = EvalReport()
    for case in cases:
        agent = build_agent()  # fresh agent (and store) per case for isolation
        result = agent.run(case.request)
        plan_intent = next(
            (s.content["intent"] for s in result.steps if s.kind is StepKind.PLAN),
            "",
        )
        tools = _tools_called(result.steps)
        report.cases.append(
            CaseResult(
                name=case.name,
                intent_ok=plan_intent == case.expect_intent,
                success_ok=result.success == case.expect_success,
                tools_ok=tools == case.expect_tools,
                answer_ok=case.expect_answer_contains in result.answer,
            )
        )
    return report
