"""Guardrails: the boring, critical machinery that makes an agent safe to run
unattended a thousand times a day.

  * tool allowlist  — the agent may only call permitted tools
  * spend cap       — committing money above a threshold is refused
  * idempotency     — repeated commit requests with the same key are deduped
"""

from __future__ import annotations

from dataclasses import dataclass, field


class GuardrailError(Exception):
    """Raised when an action violates a guardrail. Callers should surface this,
    never swallow it."""


@dataclass
class Guardrails:
    allowed_tools: frozenset[str]
    daily_spend_cap_kobo: int = 500_000 * 100  # ₦500,000
    _spent_kobo: int = 0
    _idempotency: dict[str, dict] = field(default_factory=dict)

    def check_permission(self, tool: str) -> None:
        if tool not in self.allowed_tools:
            raise GuardrailError(f"Tool '{tool}' is not permitted")

    def check_spend(self, amount_kobo: int) -> None:
        if amount_kobo < 0:
            raise GuardrailError("Refusing a negative spend amount")
        if self._spent_kobo + amount_kobo > self.daily_spend_cap_kobo:
            raise GuardrailError(
                f"Spend cap exceeded: {(self._spent_kobo + amount_kobo) / 100:.0f} "
                f"> {self.daily_spend_cap_kobo / 100:.0f} naira"
            )

    def record_spend(self, amount_kobo: int) -> None:
        self._spent_kobo += amount_kobo

    @property
    def spent_kobo(self) -> int:
        return self._spent_kobo

    def seen(self, key: str) -> dict | None:
        """Return the previously committed result for an idempotency key, if any."""
        return self._idempotency.get(key)

    def remember(self, key: str, result: dict) -> None:
        self._idempotency[key] = result
