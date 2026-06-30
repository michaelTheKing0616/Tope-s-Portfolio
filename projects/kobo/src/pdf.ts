import type { Customer, Invoice } from "./types.js";
import { formatNaira } from "./money.js";
import type { KoboConfig } from "./store/persistent.js";

export function renderInvoiceHtml(
  invoice: Invoice,
  customer: Customer,
  config: Pick<KoboConfig, "businessName" | "businessEmail" | "appUrl">,
): string {
  const rows = invoice.lineItems
    .map(
      (li) =>
        `<tr>
          <td>${escapeHtml(li.description)}</td>
          <td style="text-align:center">${li.quantity}</td>
          <td style="text-align:right">${formatNaira(li.unitPriceKobo)}</td>
          <td style="text-align:right">${formatNaira(li.quantity * li.unitPriceKobo)}</td>
        </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Invoice ${invoice.id.slice(0, 8)}</title>
  <style>
    body { font-family: Georgia, serif; color: #0d0d0d; max-width: 720px; margin: 40px auto; padding: 0 24px; }
    h1 { font-weight: 300; font-size: 2rem; margin-bottom: 4px; }
    .meta { font-family: Inter, sans-serif; font-size: 12px; color: #6b6b6b; margin-bottom: 32px; }
    table { width: 100%; border-collapse: collapse; font-family: Inter, sans-serif; font-size: 14px; }
    th, td { border-bottom: 1px solid #d8d4cc; padding: 10px 8px; }
    th { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: #6b6b6b; }
    .total { text-align: right; font-size: 1.4rem; margin-top: 24px; color: #b8954a; }
    .status { display: inline-block; padding: 4px 10px; border: 1px solid #b8954a; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; }
  </style>
</head>
<body>
  <h1>Invoice</h1>
  <p class="meta">
    ${escapeHtml(config.businessName)} · ${escapeHtml(config.businessEmail)}<br/>
    Invoice ID: ${invoice.id}<br/>
    Date: ${invoice.createdAt.slice(0, 10)} · <span class="status">${invoice.status}</span>
  </p>
  <p><strong>Bill to:</strong> ${escapeHtml(customer.name)} &lt;${escapeHtml(customer.email)}&gt;</p>
  <table>
    <thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Line total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="total">Total: ${formatNaira(invoice.totalKobo)}</p>
  ${invoice.note ? `<p><em>${escapeHtml(invoice.note)}</em></p>` : ""}
  <p class="meta">Pay via ${config.appUrl}/pay/${invoice.id} (wire Paystack checkout in production)</p>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
