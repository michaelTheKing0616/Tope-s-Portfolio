"""The agent's tool surface.

Tools are the only way the agent touches the world. Each tool is typed, returns
a JSON-serialisable dict, and is invoked through ``ToolRegistry.call`` which
enforces permissions and tracing in one place. Mutating tools additionally pass
through spend and idempotency guardrails.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from .guardrails import GuardrailError, Guardrails
from .observability import Tracer
from .store import BusinessStore, Invoice


@dataclass
class ToolContext:
    store: BusinessStore
    guardrails: Guardrails
    tracer: Tracer


ToolFn = Callable[..., dict[str, Any]]


@dataclass
class Tool:
    name: str
    description: str
    fn: ToolFn
    mutates: bool = False


# --- tool implementations -------------------------------------------------

def check_inventory(ctx: ToolContext, item: str) -> dict[str, Any]:
    found = ctx.store.find_item(item)
    if not found:
        return {"found": False, "item": item}
    return {
        "found": True,
        "sku": found.sku,
        "name": found.name,
        "qty": found.qty,
        "unit_price_kobo": found.unit_price_kobo,
    }


def calculate_total(ctx: ToolContext, unit_price_kobo: int, qty: int) -> dict[str, Any]:
    if qty <= 0:
        raise ValueError("qty must be positive")
    return {"subtotal_kobo": unit_price_kobo * qty, "qty": qty}


def lookup_customer(ctx: ToolContext, name: str) -> dict[str, Any]:
    found = ctx.store.find_customer(name)
    if not found:
        return {"found": False, "name": name}
    return {"found": True, "id": found.id, "name": found.name, "phone": found.phone}


def create_invoice(
    ctx: ToolContext,
    customer_id: str,
    items: list[dict[str, Any]],
    idempotency_key: str,
) -> dict[str, Any]:
    # Idempotency: a retried commit with the same key returns the original result.
    prior = ctx.guardrails.seen(idempotency_key)
    if prior is not None:
        return {**prior, "idempotent_replay": True}

    total = 0
    lines: list[dict] = []
    for line in items:
        sku = line["sku"]
        qty = int(line["qty"])
        item = next((i for i in ctx.store.items.values() if i.sku == sku), None)
        if item is None:
            raise ValueError(f"Unknown SKU {sku}")
        amount = item.unit_price_kobo * qty
        total += amount
        lines.append({"sku": sku, "qty": qty, "amount_kobo": amount})

    ctx.guardrails.check_spend(total)

    inv = ctx.store.create_invoice(
        Invoice(id=ctx.store.next_invoice_id(), customer_id=customer_id, lines=lines, total_kobo=total)
    )
    result = {"invoice": inv.id, "total_kobo": inv.total_kobo, "status": inv.status}

    ctx.guardrails.record_spend(total)
    ctx.guardrails.remember(idempotency_key, result)
    return result


def query_sales(ctx: ToolContext, range_days: int = 7, limit: int = 3) -> dict[str, Any]:
    recent = [s for s in ctx.store.sales if s.days_ago <= range_days]
    recent.sort(key=lambda s: s.revenue_kobo, reverse=True)
    rows = [
        {"sku": s.sku, "name": s.name, "units": s.units, "revenue_kobo": s.revenue_kobo}
        for s in recent[:limit]
    ]
    return {"rows": rows, "range_days": range_days}


# --- registry -------------------------------------------------------------

class ToolRegistry:
    def __init__(self, ctx: ToolContext) -> None:
        self.ctx = ctx
        self._tools: dict[str, Tool] = {}
        for tool in _DEFAULT_TOOLS:
            self._tools[tool.name] = tool

    def names(self) -> list[str]:
        return list(self._tools)

    def call(self, name: str, args: dict[str, Any]) -> dict[str, Any]:
        tool = self._tools.get(name)
        if tool is None:
            raise GuardrailError(f"No such tool: {name}")
        self.ctx.guardrails.check_permission(name)
        with self.ctx.tracer.span(f"tool:{name}", args) as sp:
            out = tool.fn(self.ctx, **args)
            sp.output = out
        return out


_DEFAULT_TOOLS: list[Tool] = [
    Tool("check_inventory", "Look up stock and price for an item", check_inventory),
    Tool("calculate_total", "Multiply a unit price by a quantity", calculate_total),
    Tool("lookup_customer", "Find a customer by name", lookup_customer),
    Tool("create_invoice", "Create and send an invoice", create_invoice, mutates=True),
    Tool("query_sales", "Query recent sales grouped by item", query_sales),
]
