---
title: "Sabi"
tagline: "An agentic AI assistant that actually runs a small African business."
domain: "Agentic AI / Backend"
domains: ["AI", "Systems"]
status: "in-progress"
year: "2026"
stack: ["Python", "Tool-calling", "Eval harness", "Guardrails", "Observability"]
skill: "Multi-agent orchestration, evals, observability, guardrails"
seniorSignal: "Treats agent reliability as distributed-systems engineering: state, idempotency, an eval harness and cost caps — not prompt tricks."
summary: "A WhatsApp-first assistant for African SMEs that plans and acts — handling inventory, invoicing and customer questions through tool-calling, with a planner/worker/critic loop, guardrails, an eval harness and full observability. The core is built, tested and runnable offline."
order: 2
featured: true
demo: "sabi"
links: []
---

## The problem

Millions of African micro-businesses run on WhatsApp and a notebook. They don't need another dashboard — they need something that *does the work*: records a sale, checks stock, drafts an invoice, answers a customer at 11pm. That is an agent problem, and in 2026 agent **reliability** is the single clearest senior differentiator.

## What I built

A complete, runnable reference implementation in `projects/sabi` — ships with a CLI, an eval harness and **17 passing tests**.

```text
WhatsApp ─▶ Agent ─▶ Planner ─▶ Worker(typed tools) ─▶ Critic ─▶ Answer
                       │             │                    │
                    intent +      guardrails           validates
                    rationale   (perms, spend,        gathered
                                 idempotency)          evidence
                                     │
                              Observability (tracer: spans, latency)
```

The planner is a `Protocol`: the deterministic `RuleBasedPlanner` used for the offline demo emits exactly the same typed `Plan` an `LLMPlanner` would produce from a model's tool-calling response — so the planner can be swapped for GPT or Claude without touching the agent loop, guardrails, critic or evals.

## Key engineering decisions

- **Plan → act → critic → answer, bounded.** Not a free-running loop that hopes to converge — an inspectable trajectory where a critic gates the answer against the evidence actually gathered.
- **Tool-argument binding.** Later tool calls reference earlier results with `{"$from": "lookup_customer.id"}`, resolved by the agent before the call. This is the real mechanism behind multi-step tool use, made explicit and unit-tested.
- **Guardrails as first-class code.** A tool allowlist, a daily spend cap, and **idempotency** memory so a retried "create invoice" never charges twice.
- **Money in kobo.** All amounts are integer minor units; Naira strings are only produced at the edge — the discipline a payments system needs to avoid float drift.
- **Fail closed.** A missing entity (`found: false`) halts the trajectory and the critic explains, rather than building an invoice on missing data.

## Results

- `python -m sabi.cli --eval` → **100% task success, 100% tool-call accuracy** across the labelled dataset.
- 17 unit tests (stdlib `unittest`, zero dependencies) covering tools, guardrails, the agent loop and the evals — green.
- A full traced trajectory printed per request, with per-step latency.

## Senior signal

The hard part is not the model — it is making the thing dependable when it runs a thousand times a day: idempotent tool calls, a spend cap, graceful degradation, an audit trail, and an **eval gate that can run in CI**. That is exactly what agentic-AI hiring screens for in 2026.

> The interactive trace on the [Demos](/demos) page shows the planning → tool-call → reflection loop in motion.
