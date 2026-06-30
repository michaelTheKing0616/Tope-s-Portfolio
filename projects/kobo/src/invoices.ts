import { randomUUID } from "node:crypto";
import type { Customer, Invoice, InvoiceStatus, LineItem } from "./types.js";
import { sumKobo } from "./money.js";
import type { IStore } from "./store/persistent.js";

export class AuthError extends Error {
  readonly status = 401;
}

export function assertApiKey(store: IStore, header: string | undefined): void {
  const token = header?.replace(/^Bearer\s+/i, "").trim();
  if (!token || token !== store.getApiKey()) {
    throw new AuthError("Invalid or missing API key");
  }
}

export function createCustomer(
  store: IStore,
  input: { name: string; email: string; phone?: string },
): Customer {
  const customer: Customer = {
    id: randomUUID(),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim(),
    createdAt: new Date().toISOString(),
  };
  store.saveCustomer(customer);
  store.appendEvent("customer.created", "customer", customer.id, { email: customer.email });
  return customer;
}

export function computeTotal(lineItems: LineItem[]): number {
  return sumKobo(lineItems.map((li) => li.quantity * li.unitPriceKobo));
}

export function createInvoice(
  store: IStore,
  input: { customerId: string; lineItems: LineItem[]; note?: string },
): Invoice {
  const customer = store.findCustomer(input.customerId);
  if (!customer) throw new Error("Customer not found");

  const invoice: Invoice = {
    id: randomUUID(),
    customerId: input.customerId,
    status: "draft",
    lineItems: input.lineItems,
    totalKobo: computeTotal(input.lineItems),
    currency: "NGN",
    note: input.note,
    createdAt: new Date().toISOString(),
  };
  store.saveInvoice(invoice);
  store.appendEvent("invoice.created", "invoice", invoice.id, { totalKobo: invoice.totalKobo });
  return invoice;
}

const ALLOWED: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["sent", "void"],
  sent: ["paid", "void"],
  paid: [],
  void: [],
};

export function transitionInvoice(store: IStore, id: string, next: InvoiceStatus): Invoice {
  const invoice = store.findInvoice(id);
  if (!invoice) throw new Error("Invoice not found");
  if (!ALLOWED[invoice.status].includes(next)) {
    throw new Error(`Cannot transition ${invoice.status} → ${next}`);
  }
  const updated: Invoice = {
    ...invoice,
    status: next,
    sentAt: next === "sent" ? new Date().toISOString() : invoice.sentAt,
    paidAt: next === "paid" ? new Date().toISOString() : invoice.paidAt,
  };
  store.updateInvoice(updated);
  store.appendEvent(`invoice.${next}`, "invoice", updated.id, { status: next });
  return updated;
}

export function markInvoicePaid(store: IStore, id: string, amountKobo: number): Invoice {
  const invoice = store.findInvoice(id);
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status === "paid") return invoice;
  if (invoice.status !== "sent") throw new Error("Only sent invoices can be paid");
  if (amountKobo !== invoice.totalKobo) {
    throw new Error(`Amount mismatch: expected ${invoice.totalKobo}, got ${amountKobo}`);
  }
  return transitionInvoice(store, id, "paid");
}
