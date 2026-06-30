export type InvoiceStatus = "draft" | "sent" | "paid" | "void";

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt: string;
}

export interface LineItem {
  description: string;
  quantity: number;
  unitPriceKobo: number;
}

export interface Invoice {
  id: string;
  customerId: string;
  status: InvoiceStatus;
  lineItems: LineItem[];
  totalKobo: number;
  currency: "NGN";
  note?: string;
  createdAt: string;
  sentAt?: string;
  paidAt?: string;
}

export interface AuditEvent {
  id: string;
  at: string;
  type: string;
  entity: string;
  entityId: string;
  payload: Record<string, unknown>;
}

export interface WebhookReceipt {
  idempotencyKey: string;
  invoiceId: string;
  amountKobo: number;
  processedAt: string;
  provider: "paystack" | "flutterwave";
}

export interface Database {
  apiKey: string;
  customers: Customer[];
  invoices: Invoice[];
  events: AuditEvent[];
  webhooks: WebhookReceipt[];
}

export interface PaystackWebhookPayload {
  event: "charge.success";
  data: {
    reference: string;
    amount: number;
    metadata?: { invoice_id?: string };
  };
}
