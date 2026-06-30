# Kobo

Invoicing and payments for African freelancers — **integer kobo**, **idempotent Paystack webhooks**, **atomic JSON persistence**, **invoice HTML/PDF export**, and an **append-only audit log**.

## Run

```bash
cp .env.example .env
npm install
npm run dev        # http://localhost:8787
npm test
npm run build
```

Set `KOBO_API_KEY` in `.env` for production. Default dev key: `kobo_dev_key_change_me`

```bash
curl -H "Authorization: Bearer kobo_dev_key_change_me" \
  -H "Content-Type: application/json" \
  -d '{"name":"Amaka","email":"amaka@example.com"}' \
  http://localhost:8787/api/customers
```

## API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | — | Health check |
| GET | `/api/invoices` | Bearer | List invoices |
| GET | `/api/invoices/:id` | Bearer | Get invoice |
| GET | `/api/invoices/:id/pdf` | Bearer | Print-ready HTML invoice |
| POST | `/api/invoices/:id/send` | Bearer | Mark sent + email customer |
| POST | `/webhooks/paystack` | HMAC | Idempotent payment webhook |

## Architecture

```text
API client / dashboard
        │
        ▼
   Hono server (Bearer auth)
        │
        ├── Invoice state machine (draft → sent → paid | void)
        ├── Paystack HMAC verification (raw body)
        ├── Idempotent webhook dedupe table
        ├── Console email provider (swap for Resend/SendGrid)
        └── Append-only audit events
        │
        ▼
   PersistentStore (atomic JSON) / MemoryStore (tests)
```

## Senior signals

- Money in **kobo** (integers only)
- Webhook **idempotency** via `x-idempotency-key`
- **Amount mismatch** rejects payment
- **Atomic file writes** for crash-safe persistence
- Pluggable email provider

## Deploy

Node 20+ on Railway, Render, Fly.io, or any VPS. Set env vars from `.env.example`. Expose `/webhooks/paystack` to Paystack dashboard.
