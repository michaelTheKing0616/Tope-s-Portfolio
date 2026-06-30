import unittest

from sabi.guardrails import GuardrailError, Guardrails
from sabi.observability import Tracer
from sabi.store import BusinessStore
from sabi.tools import ToolContext, ToolRegistry


def make_registry() -> ToolRegistry:
    store = BusinessStore()
    guardrails = Guardrails(
        allowed_tools=frozenset(
            {"check_inventory", "calculate_total", "lookup_customer", "create_invoice", "query_sales"}
        )
    )
    return ToolRegistry(ToolContext(store=store, guardrails=guardrails, tracer=Tracer()))


class TestTools(unittest.TestCase):
    def test_check_inventory(self) -> None:
        reg = make_registry()
        out = reg.call("check_inventory", {"item": "rice"})
        self.assertTrue(out["found"])
        self.assertEqual(out["sku"], "RICE-50KG")
        self.assertEqual(reg.call("check_inventory", {"item": "gold"})["found"], False)

    def test_calculate_total(self) -> None:
        reg = make_registry()
        out = reg.call("calculate_total", {"unit_price_kobo": 6_200_000, "qty": 3})
        self.assertEqual(out["subtotal_kobo"], 18_600_000)

    def test_create_invoice_is_idempotent(self) -> None:
        reg = make_registry()
        args = {
            "customer_id": "C-104",
            "items": [{"sku": "MILK-CTN", "qty": 2}],
            "idempotency_key": "k-1",
        }
        first = reg.call("create_invoice", args)
        second = reg.call("create_invoice", args)
        self.assertEqual(first["invoice"], second["invoice"])
        self.assertTrue(second.get("idempotent_replay"))
        # Spend recorded only once.
        self.assertEqual(reg.ctx.guardrails.spent_kobo, first["total_kobo"])

    def test_create_invoice_respects_spend_cap(self) -> None:
        store = BusinessStore()
        guardrails = Guardrails(allowed_tools=frozenset({"create_invoice"}), daily_spend_cap_kobo=1000)
        reg = ToolRegistry(ToolContext(store=store, guardrails=guardrails, tracer=Tracer()))
        with self.assertRaises(GuardrailError):
            reg.call(
                "create_invoice",
                {"customer_id": "C-104", "items": [{"sku": "RICE-50KG", "qty": 1}], "idempotency_key": "x"},
            )

    def test_unpermitted_tool_is_blocked(self) -> None:
        store = BusinessStore()
        guardrails = Guardrails(allowed_tools=frozenset({"check_inventory"}))
        reg = ToolRegistry(ToolContext(store=store, guardrails=guardrails, tracer=Tracer()))
        with self.assertRaises(GuardrailError):
            reg.call("create_invoice", {"customer_id": "C-1", "items": [], "idempotency_key": "x"})

    def test_query_sales_ranks_by_revenue(self) -> None:
        reg = make_registry()
        rows = reg.call("query_sales", {"range_days": 7, "limit": 3})["rows"]
        self.assertEqual(rows[0]["name"], "Rice 50kg")
        self.assertEqual(len(rows), 3)


if __name__ == "__main__":
    unittest.main()
