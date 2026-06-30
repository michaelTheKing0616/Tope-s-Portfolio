"""In-memory business data store with deterministic seed data.

This stands in for the real backend (Postgres + a vector store) so the agent can
run end-to-end offline. Money is kept in **kobo** (integer minor units) to avoid
floating-point drift — the same discipline a payments system must use.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Item:
    sku: str
    name: str
    qty: int
    unit_price_kobo: int


@dataclass
class Customer:
    id: str
    name: str
    phone: str


@dataclass
class Sale:
    sku: str
    name: str
    units: int
    revenue_kobo: int
    days_ago: int


@dataclass
class Invoice:
    id: str
    customer_id: str
    lines: list[dict]
    total_kobo: int
    status: str = "sent"


NAIRA = 100  # kobo per naira


class BusinessStore:
    """A tiny, deterministic store of inventory, customers, sales and invoices."""

    def __init__(self) -> None:
        self.items: dict[str, Item] = {
            "rice": Item("RICE-50KG", "Rice 50kg", 8, 62_000 * NAIRA),
            "milk": Item("MILK-CTN", "Milk carton", 15, 18_500 * NAIRA),
            "sugar": Item("SUGAR-1KG", "Sugar 1kg", 130, 700 * NAIRA),
            "oil": Item("OIL-5L", "Vegetable oil 5L", 22, 9_500 * NAIRA),
        }
        self.customers: dict[str, Customer] = {
            "amaka": Customer("C-104", "Amaka", "+2348030004821"),
            "chioma": Customer("C-105", "Chioma", "+2348060007215"),
            "bola": Customer("C-106", "Bola", "+2348090001120"),
        }
        # Seeded last-7-days sales for the reporting tool.
        self.sales: list[Sale] = [
            Sale("RICE-50KG", "Rice 50kg", 21, 1_302_000 * NAIRA, 2),
            Sale("MILK-CTN", "Milk carton", 64, 1_184_000 * NAIRA, 1),
            Sale("SUGAR-1KG", "Sugar 1kg", 130, 910_000 * NAIRA, 3),
            Sale("OIL-5L", "Vegetable oil 5L", 40, 380_000 * NAIRA, 4),
        ]
        self._invoice_seq = 2290
        self.invoices: dict[str, Invoice] = {}

    # --- lookups ---------------------------------------------------------
    def find_item(self, name: str) -> Item | None:
        return self.items.get(name.strip().lower())

    def find_customer(self, name: str) -> Customer | None:
        return self.customers.get(name.strip().lower())

    # --- mutations -------------------------------------------------------
    def next_invoice_id(self) -> str:
        self._invoice_seq += 1
        return f"INV-{self._invoice_seq}"

    def create_invoice(self, inv: Invoice) -> Invoice:
        self.invoices[inv.id] = inv
        return inv
