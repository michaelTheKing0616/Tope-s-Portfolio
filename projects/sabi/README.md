# Sabi

An **agentic AI assistant for African SMEs**. Millions of micro-businesses run on
WhatsApp and a notebook; they don't need another dashboard, they need something
that *does the work* — records a sale, checks stock, drafts an invoice, answers a
customer. Sabi is that system, built the way 2026 actually hires for agents: as a
**reliable system, not a chatbot**.

> Part of the portfolio of Temitope Olaitan. The whole point is that the model is
> the *easy* part — the engineering is reliability: typed tools, guardrails,
> idempotency, a critic, observability and an eval harness.

## Run it (no API key, no installs)

The core runs on the Python standard library alone (3.10+):

```bash
cd projects/sabi

python -m sabi.cli "A customer wants 3 bags of rice - in stock and total?"
python -m sabi.cli --scenario invoice
python -m sabi.cli --eval          # run the evaluation harness
python -m sabi.cli                  # interactive REPL

# tests (stdlib unittest — no dependencies)
python -m unittest discover -s tests -t .
```

Example trajectory:

```
> Send an invoice to Amaka for 2 cartons of milk.
  [plan:create_invoice]
    - Find the customer 'amaka'
    - Verify milk stock and price
    - Create and send the invoice
    - Confirm against the spend guardrail
  [tool] lookup_customer({'name': 'amaka'}) -> {'found': True, 'id': 'C-104', ...}
  [tool] check_inventory({'item': 'milk'}) -> {'found': True, 'sku': 'MILK-CTN', ...}
  [tool] create_invoice({...}) -> {'invoice': 'INV-2291', 'total_kobo': 3700000, 'status': 'sent'}
  [critic:ok] Invoice INV-2291 within spend cap. Committed.
  [answer] Invoice INV-2291 for ₦37,000 sent to Amaka. I'll notify you the moment they pay.
```

## Architecture

```
WhatsApp ─▶ Agent ─▶ Planner ─▶ Worker(typed tools) ─▶ Critic ─▶ Answer
                       │             │                    │
                    intent +      guardrails           validates
                    rationale   (perms, spend,        gathered
                                 idempotency)          evidence
                                     │
                              Observability (tracer: spans, latency)
```

| Module | Responsibility |
|--------|----------------|
| `planner.py` | Intent detection + entity extraction → a typed `Plan`. **Swappable for an LLM** (same output shape). |
| `tools.py` | The typed tool surface + a registry that enforces permissions and tracing at the call boundary. |
| `guardrails.py` | Tool allowlist, daily spend cap, idempotency memory. |
| `agent.py` | The plan → act → critic → answer loop, with `$from` argument-binding resolution between tool calls. |
| `observability.py` | Span-based tracing (latency per step) — the local stand-in for OpenTelemetry. |
| `evals.py` | Labelled dataset + runner scoring **task success** and **tool-call accuracy**. |

## Why this reads as senior

- **Reliability as the product.** Idempotent commits, a hard spend cap, an
  allowlist, graceful failure, and a critic gate before any answer.
- **Tool-arg binding.** Later tool calls reference earlier results
  (`{"$from": "lookup_customer.id"}`), resolved by the agent — the real pattern
  behind multi-step tool use, made explicit and testable.
- **Evals in the loop.** `--eval` (and `test_evals.py`) measure task success and
  tool-call accuracy and could gate CI — the clearest 2026 agentic-AI signal.
- **Deterministic + offline.** No model, no key, no network needed to run or test;
  swap in `openai`/`anthropic` via the `llm` extra to go live without touching the
  agent, guardrails or evals.

## Going live

Implement an `LLMPlanner` that returns the same `Plan` shape from a model
response (function/tool-calling), install the `llm` extra, and wire it into
`build_agent(planner=LLMPlanner(...))`. Everything downstream is unchanged.

## License

MIT
