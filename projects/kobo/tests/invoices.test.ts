import { describe, expect, it } from "vitest";
import { createApp } from "../src/server.js";
import { MemoryStore } from "../src/store/persistent.js";
import { createCustomer, createInvoice, transitionInvoice } from "../src/invoices.js";
import { nairaToKobo } from "../src/money.js";

const KEY = "test_key";

function headers() {
  return { authorization: `Bearer ${KEY}`, "content-type": "application/json" };
}

describe("invoices API", () => {
  it("requires auth on mutations", async () => {
    const store = new MemoryStore(KEY);
    const app = createApp({ store, config: { apiKey: KEY } as never, email: { send: async () => ({ id: "1" }), sent: [] } });
    const res = await app.request("/api/invoices", { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("creates, sends and lists invoices", async () => {
    const store = new MemoryStore(KEY);
    const email = { send: async () => ({ id: "1" }), sent: [] as never[] };
    const app = createApp({ store, config: { apiKey: KEY, businessName: "T", businessEmail: "a@b.com", appUrl: "http://x" } as never, email });

    const customer = createCustomer(store, { name: "Amaka", email: "amaka@example.com" });
    const invoice = createInvoice(store, {
      customerId: customer.id,
      lineItems: [{ description: "Design", quantity: 1, unitPriceKobo: nairaToKobo(150_000) }],
    });
    transitionInvoice(store, invoice.id, "sent");

    const res = await app.request("/api/invoices", { headers: headers() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string }[];
    expect(body).toHaveLength(1);
    expect(body[0]?.status).toBe("sent");
  });
});
