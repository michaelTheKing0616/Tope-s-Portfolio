import unittest

from sabi.guardrails import GuardrailError, Guardrails


class TestGuardrails(unittest.TestCase):
    def setUp(self) -> None:
        self.g = Guardrails(allowed_tools=frozenset({"a", "b"}), daily_spend_cap_kobo=100_000)

    def test_permission_allowlist(self) -> None:
        self.g.check_permission("a")  # no raise
        with self.assertRaises(GuardrailError):
            self.g.check_permission("c")

    def test_spend_cap(self) -> None:
        self.g.check_spend(60_000)
        self.g.record_spend(60_000)
        with self.assertRaises(GuardrailError):
            self.g.check_spend(60_000)  # would exceed 100_000

    def test_rejects_negative_spend(self) -> None:
        with self.assertRaises(GuardrailError):
            self.g.check_spend(-1)

    def test_idempotency_memory(self) -> None:
        self.assertIsNone(self.g.seen("k1"))
        self.g.remember("k1", {"invoice": "INV-1"})
        self.assertEqual(self.g.seen("k1"), {"invoice": "INV-1"})


if __name__ == "__main__":
    unittest.main()
