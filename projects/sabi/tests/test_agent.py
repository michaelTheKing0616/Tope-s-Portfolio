import unittest

from sabi.agent import build_agent
from sabi.types import StepKind


def tools_called(result) -> list[str]:
    return [
        s.content["name"]
        for s in result.steps
        if s.kind is StepKind.TOOL and "name" in s.content
    ]


class TestAgent(unittest.TestCase):
    def test_stock_in_range(self) -> None:
        agent = build_agent()
        r = agent.run("A customer wants 3 bags of rice - in stock and total?")
        self.assertTrue(r.success)
        self.assertIn("186,000", r.answer)
        self.assertEqual(tools_called(r), ["check_inventory", "calculate_total"])

    def test_stock_out_of_range_fails_critic(self) -> None:
        agent = build_agent()
        r = agent.run("Customer wants 50 bags of rice, do we have stock?")
        self.assertFalse(r.success)  # only 8 in stock

    def test_invoice_resolves_bindings_and_succeeds(self) -> None:
        agent = build_agent()
        r = agent.run("Send an invoice to Amaka for 2 cartons of milk.")
        self.assertTrue(r.success)
        self.assertIn("37,000", r.answer)
        self.assertEqual(tools_called(r), ["lookup_customer", "check_inventory", "create_invoice"])

    def test_invoice_unknown_customer_fails_gracefully(self) -> None:
        agent = build_agent()
        r = agent.run("Send an invoice to Zainab for 2 milk.")
        self.assertFalse(r.success)
        # It should stop after the failed lookup, not attempt to create an invoice.
        self.assertNotIn("create_invoice", tools_called(r))

    def test_repeated_invoice_is_idempotent_on_same_agent(self) -> None:
        agent = build_agent()
        first = agent.run("Invoice Amaka for 2 milk.")
        second = agent.run("Invoice Amaka for 2 milk.")
        self.assertTrue(first.success and second.success)
        # Same invoice id both times; spend counted once.
        self.assertEqual(agent.guardrails.spent_kobo, 37_000 * 100)

    def test_unknown_intent_is_helpful(self) -> None:
        agent = build_agent()
        r = agent.run("hello there")
        self.assertTrue(r.success)
        self.assertIn("check stock", r.answer)


if __name__ == "__main__":
    unittest.main()
