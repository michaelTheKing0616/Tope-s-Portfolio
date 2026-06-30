"""Command-line entry point for Sabi.

    python -m sabi.cli "Do we have 3 bags of rice?"   # run one request
    python -m sabi.cli --scenario invoice              # run a preset
    python -m sabi.cli --eval                           # run the eval harness
    python -m sabi.cli                                  # interactive REPL
"""

from __future__ import annotations

import argparse
import sys

from .agent import build_agent
from .evals import run_evals
from .types import AgentResult, StepKind

SCENARIOS = {
    "stock": "A customer wants 3 bags of rice - do we have stock and what's the total?",
    "invoice": "Send an invoice to Amaka for 2 cartons of milk.",
    "report": "What were my best-selling items this week?",
}


def render(result: AgentResult) -> str:
    lines: list[str] = []
    for step in result.steps:
        if step.kind is StepKind.USER:
            lines.append(f"\n> {step.content}")
        elif step.kind is StepKind.PLAN:
            lines.append(f"  [plan:{step.content['intent']}]")
            for item in step.content["rationale"]:
                lines.append(f"    - {item}")
        elif step.kind is StepKind.TOOL:
            c = step.content
            if "error" in c:
                lines.append(f"  [tool] {c['name']} -> ERROR: {c['error']}")
            else:
                lines.append(f"  [tool] {c['name']}({c.get('args', {})}) -> {c['result']}")
        elif step.kind is StepKind.CRITIC:
            mark = "ok" if step.content["ok"] else "blocked"
            lines.append(f"  [critic:{mark}] {step.content['note']}")
        elif step.kind is StepKind.ANSWER:
            lines.append(f"  [answer] {step.content}")
    return "\n".join(lines)


def run_once(request: str) -> int:
    agent = build_agent()
    result = agent.run(request)
    print(render(result))
    print("\n" + agent.tracer.render())
    return 0 if result.success else 1


def main(argv: list[str] | None = None) -> int:
    # The trace prints the ₦ symbol; ensure UTF-8 output even on consoles that
    # default to a legacy code page (e.g. Windows cp1252).
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
    except (AttributeError, ValueError):
        pass

    parser = argparse.ArgumentParser(prog="sabi", description="Sabi - SME operations agent")
    parser.add_argument("request", nargs="?", help="A natural-language request")
    parser.add_argument("--scenario", choices=sorted(SCENARIOS), help="Run a preset request")
    parser.add_argument("--eval", action="store_true", help="Run the evaluation harness")
    args = parser.parse_args(argv)

    if args.eval:
        report = run_evals()
        print(report.render())
        return 0 if report.task_success_rate == 1.0 else 1

    if args.scenario:
        return run_once(SCENARIOS[args.scenario])

    if args.request:
        return run_once(args.request)

    # Interactive REPL
    print("Sabi - type a request (Ctrl-D / 'quit' to exit).")
    try:
        while True:
            line = input("you> ").strip()
            if line.lower() in {"quit", "exit"}:
                break
            if line:
                run_once(line)
    except EOFError:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
