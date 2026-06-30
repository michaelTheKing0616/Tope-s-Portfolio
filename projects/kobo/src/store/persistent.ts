import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { AuditEvent, Customer, Database, Invoice, WebhookReceipt } from "../types.js";

/** Store contract — memory for tests, persistent JSON for production. */
export interface IStore {
  getApiKey(): string;
  readonly customers: Customer[];
  readonly invoices: Invoice[];
  readonly events: AuditEvent[];
  readonly webhooks: WebhookReceipt[];
  appendEvent(type: string, entity: string, entityId: string, payload: Record<string, unknown>): AuditEvent;
  findWebhook(key: string): WebhookReceipt | undefined;
  rememberWebhook(receipt: WebhookReceipt): void;
  saveCustomer(customer: Customer): void;
  saveInvoice(invoice: Invoice): void;
  updateInvoice(invoice: Invoice): void;
  findCustomer(id: string): Customer | undefined;
  findInvoice(id: string): Invoice | undefined;
}

export function loadConfig() {
  return {
    port: Number(process.env.PORT ?? 8787),
    apiKey: process.env.KOBO_API_KEY ?? "kobo_dev_key_change_me",
    databasePath: resolve(process.env.KOBO_DATABASE_PATH ?? "./data/kobo.json"),
    paystackSecret: process.env.PAYSTACK_SECRET ?? "",
    appUrl: process.env.KOBO_APP_URL ?? "http://localhost:8787",
    businessName: process.env.KOBO_BUSINESS_NAME ?? "Your Business",
    businessEmail: process.env.KOBO_BUSINESS_EMAIL ?? "billing@example.com",
  };
}

export type KoboConfig = ReturnType<typeof loadConfig>;

export function createEmptyDb(apiKey: string): Database {
  return { apiKey, customers: [], invoices: [], events: [], webhooks: [] };
}

/** Atomic JSON persistence — write temp file then rename. */
export class PersistentStore implements IStore {
  private data: Database;
  private readonly path: string;

  constructor(path: string, apiKey: string) {
    this.path = path;
    mkdirSync(dirname(path), { recursive: true });
    if (existsSync(path)) {
      this.data = JSON.parse(readFileSync(path, "utf8")) as Database;
    } else {
      this.data = createEmptyDb(apiKey);
      this.flush();
    }
  }

  private flush(): void {
    const tmp = `${this.path}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data, null, 2), "utf8");
    renameSync(tmp, this.path);
  }

  getApiKey(): string {
    return this.data.apiKey;
  }

  get customers(): Customer[] {
    return this.data.customers;
  }
  get invoices(): Invoice[] {
    return this.data.invoices;
  }
  get events(): AuditEvent[] {
    return this.data.events;
  }
  get webhooks(): WebhookReceipt[] {
    return this.data.webhooks;
  }

  appendEvent(type: string, entity: string, entityId: string, payload: Record<string, unknown>): AuditEvent {
    const event: AuditEvent = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      type,
      entity,
      entityId,
      payload,
    };
    this.data.events.push(event);
    this.flush();
    return event;
  }

  findWebhook(key: string): WebhookReceipt | undefined {
    return this.data.webhooks.find((w) => w.idempotencyKey === key);
  }

  rememberWebhook(receipt: WebhookReceipt): void {
    this.data.webhooks.push(receipt);
    this.flush();
  }

  saveCustomer(customer: Customer): void {
    this.data.customers.push(customer);
    this.flush();
  }

  saveInvoice(invoice: Invoice): void {
    this.data.invoices.push(invoice);
    this.flush();
  }

  updateInvoice(invoice: Invoice): void {
    const i = this.data.invoices.findIndex((x) => x.id === invoice.id);
    if (i >= 0) this.data.invoices[i] = invoice;
    this.flush();
  }

  findCustomer(id: string): Customer | undefined {
    return this.data.customers.find((c) => c.id === id);
  }

  findInvoice(id: string): Invoice | undefined {
    return this.data.invoices.find((i) => i.id === id);
  }
}

/** In-memory store for fast unit tests. */
export class MemoryStore implements IStore {
  private data: Database;

  constructor(apiKey = "test_key") {
    this.data = createEmptyDb(apiKey);
  }

  getApiKey(): string {
    return this.data.apiKey;
  }
  get customers() {
    return this.data.customers;
  }
  get invoices() {
    return this.data.invoices;
  }
  get events() {
    return this.data.events;
  }
  get webhooks() {
    return this.data.webhooks;
  }

  appendEvent(type: string, entity: string, entityId: string, payload: Record<string, unknown>): AuditEvent {
    const event: AuditEvent = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      type,
      entity,
      entityId,
      payload,
    };
    this.data.events.push(event);
    return event;
  }

  findWebhook(key: string) {
    return this.data.webhooks.find((w) => w.idempotencyKey === key);
  }

  rememberWebhook(receipt: WebhookReceipt): void {
    this.data.webhooks.push(receipt);
  }

  saveCustomer(customer: Customer): void {
    this.data.customers.push(customer);
  }

  saveInvoice(invoice: Invoice): void {
    this.data.invoices.push(invoice);
  }

  updateInvoice(invoice: Invoice): void {
    const i = this.data.invoices.findIndex((x) => x.id === invoice.id);
    if (i >= 0) this.data.invoices[i] = invoice;
  }

  findCustomer(id: string) {
    return this.data.customers.find((c) => c.id === id);
  }

  findInvoice(id: string) {
    return this.data.invoices.find((i) => i.id === id);
  }
}
