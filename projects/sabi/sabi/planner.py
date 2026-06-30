"""Planning layer.

``Planner`` is a protocol so the deterministic, offline ``RuleBasedPlanner`` used
here can be swapped for an ``LLMPlanner`` (OpenAI/Anthropic) without touching the
agent. The rule-based planner does explicit intent detection + entity extraction
and emits a typed :class:`Plan`; an LLM planner would emit the same shape from a
model response, so everything downstream (execution, guardrails, critic, evals)
is identical.
"""

from __future__ import annotations

import re
from typing import Protocol

from .store import BusinessStore
from .types import CriticVerdict, Plan, ToolCall

_WORD_NUMBERS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
}


def format_naira(kobo: int) -> str:
    return f"\u20a6{kobo // 100:,}"


class Planner(Protocol):
    def plan(self, request: str) -> Plan: ...


class RuleBasedPlanner:
    """Deterministic planner — no model call, fully testable."""

    def __init__(self, store: BusinessStore) -> None:
        self.store = store

    # --- entity extraction ----------------------------------------------
    def _quantity(self, text: str) -> int:
        m = re.search(r"\b(\d+)\b", text)
        if m:
            return int(m.group(1))
        for word, n in _WORD_NUMBERS.items():
            if re.search(rf"\b{word}\b", text, re.I):
                return n
        return 1

    def _item(self, text: str) -> str | None:
        low = text.lower()
        for key in self.store.items:
            if key in low:
                return key
        return None

    def _customer(self, text: str) -> str | None:
        low = text.lower()
        for key in self.store.customers:
            if key in low:
                return key
        m = re.search(r"\bto\s+([A-Z][a-z]+)", text)
        return m.group(1).lower() if m else None

    # --- planning --------------------------------------------------------
    def plan(self, request: str) -> Plan:
        low = request.lower()
        if "invoice" in low:
            return self._plan_invoice(request)
        if any(k in low for k in ("best", "sell", "selling", "sales", "top", "report")):
            return self._plan_report(request)
        if self._item(request) is not None:
            return self._plan_stock(request)
        return self._plan_unknown(request)

    def _plan_stock(self, request: str) -> Plan:
        item = self._item(request) or ""
        qty = self._quantity(request)

        def critic(results: dict) -> CriticVerdict:
            inv = results.get("check_inventory", {})
            if not inv.get("found"):
                return CriticVerdict(False, f"No such item '{item}'.")
            if inv["qty"] < qty:
                return CriticVerdict(False, f"Only {inv['qty']} in stock, {qty} requested.")
            return CriticVerdict(True, f"Stock {inv['qty']} >= {qty}. Total within range.")

        def answer(results: dict) -> str:
            inv = results["check_inventory"]
            if not inv.get("found"):
                return f"Sorry, I couldn't find '{item}' in your inventory."
            total = results["calculate_total"]["subtotal_kobo"]
            return (
                f"Yes - {inv['qty']} {inv['name']} in stock. "
                f"{qty} x {inv['name']} = {format_naira(total)}. "
                f"Want me to reserve them and draft an invoice?"
            )

        return Plan(
            intent="stock_check",
            rationale=[
                f"Check inventory for '{item}'",
                "Compute the order total",
                "Reply with availability and price",
            ],
            calls=[
                ToolCall("check_inventory", {"item": item}),
                ToolCall(
                    "calculate_total",
                    {"unit_price_kobo": {"$from": "check_inventory.unit_price_kobo"}, "qty": qty},
                ),
            ],
            critic=critic,
            answer=answer,
        )

    def _plan_invoice(self, request: str) -> Plan:
        item = self._item(request) or ""
        qty = self._quantity(request)
        customer = self._customer(request) or ""
        idem = f"inv:{customer}:{item}:{qty}"

        def critic(results: dict) -> CriticVerdict:
            if not results.get("lookup_customer", {}).get("found"):
                return CriticVerdict(False, f"Customer '{customer}' not found.")
            if not results.get("check_inventory", {}).get("found"):
                return CriticVerdict(False, f"Item '{item}' not found.")
            inv = results.get("create_invoice", {})
            return CriticVerdict(True, f"Invoice {inv.get('invoice')} within spend cap. Committed.")

        def answer(results: dict) -> str:
            cust = results["lookup_customer"]
            inv = results["create_invoice"]
            return (
                f"Invoice {inv['invoice']} for {format_naira(inv['total_kobo'])} "
                f"sent to {cust['name']}. I'll notify you the moment they pay."
            )

        return Plan(
            intent="create_invoice",
            rationale=[
                f"Find the customer '{customer}'",
                f"Verify {item} stock and price",
                "Create and send the invoice",
                "Confirm against the spend guardrail",
            ],
            calls=[
                ToolCall("lookup_customer", {"name": customer}),
                ToolCall("check_inventory", {"item": item}),
                ToolCall(
                    "create_invoice",
                    {
                        "customer_id": {"$from": "lookup_customer.id"},
                        "items": [{"sku": {"$from": "check_inventory.sku"}, "qty": qty}],
                        "idempotency_key": idem,
                    },
                ),
            ],
            critic=critic,
            answer=answer,
        )

    def _plan_report(self, request: str) -> Plan:
        def critic(results: dict) -> CriticVerdict:
            rows = results.get("query_sales", {}).get("rows", [])
            return CriticVerdict(bool(rows), f"{len(rows)} rows returned.")

        def answer(results: dict) -> str:
            rows = results["query_sales"]["rows"]
            if not rows:
                return "No sales recorded in that period yet."
            parts = [f"{i+1}) {r['name']} - {format_naira(r['revenue_kobo'])}" for i, r in enumerate(rows)]
            return "This week's top sellers: " + ", ".join(parts) + "."

        return Plan(
            intent="sales_report",
            rationale=[
                "Query the last 7 days of sales",
                "Rank items by revenue",
                "Summarise the top three",
            ],
            calls=[ToolCall("query_sales", {"range_days": 7, "limit": 3})],
            critic=critic,
            answer=answer,
        )

    def _plan_unknown(self, request: str) -> Plan:
        def critic(results: dict) -> CriticVerdict:
            return CriticVerdict(True, "No tools required.")

        def answer(results: dict) -> str:
            return (
                "I can check stock, draft invoices and report on sales. "
                "Try: 'Do we have 3 bags of rice?' or 'Invoice Amaka for 2 milk'."
            )

        return Plan(intent="unknown", rationale=["No actionable intent detected"], calls=[], critic=critic, answer=answer)
