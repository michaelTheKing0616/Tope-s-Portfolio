import { describe, expect, it } from "vitest";
import { MemoryStore } from "../src/store/persistent.js";
import { createCustomer, createInvoice, transitionInvoice } from "../src/invoices.js";
import { newPaystackPayload, processPaystackWebhook } from "../src/webhooks.js";
import { nairaToKobo } from "../src/money.js";

describe("webhooks", () => {
  it("processes a payment exactly once per idempotency key", () => {
    const store = new MemoryStore();
    const customer = createCustomer(store, { name: "Tunde", email: "t@example.com" });
    const invoice = createInvoice(store, {
      customerId: customer.id,
      lineItems: [{ description: "Dev", quantity: 2, unitPriceKobo: nairaToKobo(50_000) }],
    });
    transitionInvoice(store, invoice.id, "sent");

    const payload = newPaystackPayload(invoice.id, invoice.totalKobo);
    const first = processPaystackWebhook(store, "idem-1", payload);
    const second = processPaystackWebhook(store, "idem-1", payload);

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(store.webhooks).toHaveLength(1);
    expect(store.invoices[0]?.status).toBe("paid");
    expect(store.events.filter((e) => e.type === "webhook.processed")).toHaveLength(1);
  });

  it("rejects amount mismatch", () => {
    const store = new MemoryStore();
    const customer = createCustomer(store, { name: "Ada", email: "a@example.com" });
    const invoice = createInvoice(store, {
      customerId: customer.id,
      lineItems: [{ description: "Logo", quantity: 1, unitPriceKobo: nairaToKobo(20_000) }],
    });
    transitionInvoice(store, invoice.id, "sent");

    const payload = newPaystackPayload(invoice.id, invoice.totalKobo + 100);
    expect(() => processPaystackWebhook(store, "idem-2", payload)).toThrow(/mismatch/i);
  });
});
