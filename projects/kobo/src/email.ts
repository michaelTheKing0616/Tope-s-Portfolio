import type { Invoice } from "./types.js";
import type { Customer } from "./types.js";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export interface EmailProvider {
  send(payload: EmailPayload): Promise<{ id: string }>;
}

/** Logs emails in dev; swap for Resend/SendGrid in production. */
export class ConsoleEmailProvider implements EmailProvider {
  readonly sent: EmailPayload[] = [];

  async send(payload: EmailPayload): Promise<{ id: string }> {
    this.sent.push(payload);
    console.log(`[email] → ${payload.to}: ${payload.subject}`);
    return { id: `console_${this.sent.length}` };
  }
}

export function invoiceEmail(
  invoice: Invoice,
  customer: Customer,
  invoiceHtml: string,
): EmailPayload {
  return {
    to: customer.email,
    subject: `Invoice ${invoice.id.slice(0, 8)} — please pay`,
    html: invoiceHtml,
  };
}
