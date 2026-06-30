import { randomUUID } from "node:crypto";
import type { PaystackWebhookPayload } from "./types.js";
import { markInvoicePaid } from "./invoices.js";
import type { IStore } from "./store/persistent.js";

export class WebhookError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export interface WebhookResult {
  duplicate: boolean;
  invoiceId: string;
  amountKobo: number;
}

export function processPaystackWebhook(
  store: IStore,
  idempotencyKey: string | undefined,
  payload: PaystackWebhookPayload,
): WebhookResult {
  if (!idempotencyKey?.trim()) throw new WebhookError("Missing x-idempotency-key header", 400);
  const key = idempotencyKey.trim();

  const existing = store.findWebhook(key);
  if (existing) {
    return { duplicate: true, invoiceId: existing.invoiceId, amountKobo: existing.amountKobo };
  }

  if (payload.event !== "charge.success") {
    throw new WebhookError(`Unsupported event: ${payload.event}`);
  }

  const invoiceId = payload.data.metadata?.invoice_id;
  if (!invoiceId) throw new WebhookError("Missing metadata.invoice_id");

  const amountKobo = payload.data.amount;
  if (!Number.isInteger(amountKobo) || amountKobo <= 0) {
    throw new WebhookError("Invalid amount");
  }

  markInvoicePaid(store, invoiceId, amountKobo);

  store.rememberWebhook({
    idempotencyKey: key,
    invoiceId,
    amountKobo,
    processedAt: new Date().toISOString(),
    provider: "paystack",
  });

  store.appendEvent("webhook.processed", "webhook", key, {
    invoiceId,
    amountKobo,
    reference: payload.data.reference,
  });

  return { duplicate: false, invoiceId, amountKobo };
}

export function newPaystackPayload(invoiceId: string, amountKobo: number): PaystackWebhookPayload {
  return {
    event: "charge.success",
    data: {
      reference: `ref_${randomUUID().slice(0, 8)}`,
      amount: amountKobo,
      metadata: { invoice_id: invoiceId },
    },
  };
}
