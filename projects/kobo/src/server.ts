import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { formatNaira } from "./money.js";
import {
  assertApiKey,
  AuthError,
  createCustomer,
  createInvoice,
  transitionInvoice,
} from "./invoices.js";
import { processPaystackWebhook, WebhookError } from "./webhooks.js";
import { verifyPaystackSignature } from "./paystack.js";
import { renderInvoiceHtml } from "./pdf.js";
import { ConsoleEmailProvider, invoiceEmail } from "./email.js";
import {
  loadConfig,
  MemoryStore,
  PersistentStore,
  type IStore,
  type KoboConfig,
} from "./store/persistent.js";
import type { LineItem } from "./types.js";

export interface AppDeps {
  store: IStore;
  config: KoboConfig;
  email: ConsoleEmailProvider;
}

export function createDeps(overrides?: Partial<AppDeps>): AppDeps {
  const config = loadConfig();
  const store =
    overrides?.store ??
    (process.env.NODE_ENV === "test"
      ? new MemoryStore(config.apiKey)
      : new PersistentStore(config.databasePath, config.apiKey));
  return {
    store,
    config,
    email: overrides?.email ?? new ConsoleEmailProvider(),
  };
}

export function createApp(deps = createDeps()) {
  const { store, config, email } = deps;
  const app = new Hono();

  app.get("/health", (c) =>
    c.json({ ok: true, service: "kobo", version: "0.2.0", persistence: config.databasePath }),
  );

  app.get("/", (c) => c.html(renderDashboard(store)));

  app.get("/api/customers", (c) => {
    try {
      assertApiKey(store, c.req.header("authorization"));
      return c.json(store.customers);
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.get("/api/invoices", (c) => {
    try {
      assertApiKey(store, c.req.header("authorization"));
      return c.json(store.invoices);
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.get("/api/invoices/:id", (c) => {
    try {
      assertApiKey(store, c.req.header("authorization"));
      const inv = store.findInvoice(c.req.param("id"));
      if (!inv) return c.json({ error: "Not found" }, 404);
      return c.json(inv);
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.get("/api/invoices/:id/pdf", (c) => {
    try {
      assertApiKey(store, c.req.header("authorization"));
      const inv = store.findInvoice(c.req.param("id"));
      if (!inv) return c.json({ error: "Not found" }, 404);
      const customer = store.findCustomer(inv.customerId);
      if (!customer) return c.json({ error: "Customer missing" }, 500);
      return c.html(renderInvoiceHtml(inv, customer, config));
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/api/customers", async (c) => {
    try {
      assertApiKey(store, c.req.header("authorization"));
      const body = await c.req.json<{ name: string; email: string; phone?: string }>();
      return c.json(createCustomer(store, body), 201);
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/api/invoices", async (c) => {
    try {
      assertApiKey(store, c.req.header("authorization"));
      const body = await c.req.json<{ customerId: string; lineItems: LineItem[]; note?: string }>();
      return c.json(createInvoice(store, body), 201);
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/api/invoices/:id/send", async (c) => {
    try {
      assertApiKey(store, c.req.header("authorization"));
      const invoice = transitionInvoice(store, c.req.param("id"), "sent");
      const customer = store.findCustomer(invoice.customerId);
      if (customer) {
        const html = renderInvoiceHtml(invoice, customer, config);
        await email.send(invoiceEmail(invoice, customer, html));
        store.appendEvent("invoice.emailed", "invoice", invoice.id, { to: customer.email });
      }
      return c.json(invoice);
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/webhooks/paystack", async (c) => {
    try {
      const raw = await c.req.text();
      const sig = c.req.header("x-paystack-signature");
      if (config.paystackSecret && !verifyPaystackSignature(raw, sig, config.paystackSecret)) {
        throw new WebhookError("Invalid Paystack signature", 401);
      }
      const payload = JSON.parse(raw);
      const result = processPaystackWebhook(store, c.req.header("x-idempotency-key"), payload);
      return c.json({ ok: true, ...result });
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.get("/api/events", (c) => {
    try {
      assertApiKey(store, c.req.header("authorization"));
      return c.json(store.events);
    } catch (e) {
      return jsonError(c, e);
    }
  });

  return app;
}

function jsonError(c: { json: (b: unknown, s?: number) => Response }, e: unknown) {
  if (e instanceof AuthError) return c.json({ error: e.message }, 401);
  if (e instanceof WebhookError) return c.json({ error: e.message }, e.status);
  if (e instanceof Error) return c.json({ error: e.message }, 400);
  return c.json({ error: "Unknown error" }, 500);
}

function renderDashboard(store: IStore): string {
  const rows = store.invoices
    .map(
      (inv) => `<tr>
        <td><a href="/api/invoices/${inv.id}/pdf">${inv.id.slice(0, 8)}</a></td>
        <td><span class="status status--${inv.status}">${inv.status}</span></td>
        <td>${formatNaira(inv.totalKobo)}</td>
        <td>${inv.createdAt.slice(0, 10)}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Kobo — Invoicing</title>
  <style>
    :root { --ink:#0d0d0d; --gold:#b8954a; --gold-light:#e8d9b5; --smoke:#f5f4f1; }
    body { margin:0; font-family:Inter,system-ui,sans-serif; background:var(--smoke); color:var(--ink); }
    header { background:var(--ink); color:var(--gold-light); padding:28px 32px; border-bottom:1px solid rgba(184,149,74,.25); }
    h1 { font-family:Georgia,serif; font-weight:300; margin:0 0 6px; font-size:2.4rem; }
    .sub { font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:var(--gold); }
    main { max-width:960px; margin:0 auto; padding:32px 24px 64px; }
    table { width:100%; border-collapse:collapse; background:#fff; border:1px solid #d8d4cc; }
    th,td { text-align:left; padding:12px 14px; border-bottom:1px solid #eee; font-size:14px; }
    th { font-size:10px; letter-spacing:.16em; text-transform:uppercase; color:#6b6b6b; }
    .status { font-size:10px; letter-spacing:.12em; text-transform: uppercase; padding:3px 8px; border-radius:999px; border:1px solid #ddd; }
    .status--paid { border-color:#5fb37a; color:#2d6b44; }
    .status--sent { border-color:var(--gold); color:#8a6a23; }
    code { background:#f0eeea; padding:2px 6px; border-radius:4px; font-size:12px; }
    p.note { color:#6b6b6b; line-height:1.6; max-width:70ch; }
    a { color: var(--gold); }
  </style>
</head>
<body>
  <header><p class="sub">Kobo</p><h1>Invoicing, done safely.</h1></header>
  <main>
    <p class="note">Persistent JSON store · integer <strong>kobo</strong> · idempotent webhooks · Paystack HMAC · invoice PDF/HTML · email on send.</p>
    <table>
      <thead><tr><th>Invoice</th><th>Status</th><th>Total</th><th>Created</th></tr></thead>
      <tbody>${rows || "<tr><td colspan='4'>No invoices yet.</td></tr>"}</tbody>
    </table>
  </main>
</body>
</html>`;
}

export function startServer(port?: number, deps?: AppDeps) {
  const d = deps ?? createDeps();
  const p = port ?? d.config.port;
  const app = createApp(d);
  serve({ fetch: app.fetch, port: p });
  return app;
}
