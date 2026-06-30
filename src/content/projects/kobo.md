---
title: "Kobo"
tagline: "Invoicing and payments for African freelancers, done safely."
domain: "Full-Stack Web + Payments"
domains: ["Web", "Systems"]
status: "in-progress"
year: "2026"
stack: ["TypeScript", "Hono", "Paystack", "Atomic JSON", "PDF/HTML", "Audit log"]
skill: "Production full-stack with money: auth, idempotent webhooks, security"
seniorSignal: "Handles money correctly — idempotent webhooks, validated boundaries, least-privilege auth, audit logs."
summary: "A full-stack SaaS for freelancers to send invoices, collect payments via Paystack/Flutterwave, and reconcile income — with the boring-but-critical engineering money demands."
order: 3
featured: true
links: []
---

## The problem

Freelancers across the continent get paid in fragments across banks, transfers and apps, then fight to reconcile it. Invoicing tools built for Western markets ignore Paystack/Flutterwave flows, Naira formatting quirks, and the reality that **payment webhooks retry**.

Building this *correctly* is a senior test: anything touching money is unforgiving of sloppy engineering.

## Target users

- **Solo freelancers** (designers, developers, consultants) who invoice clients in Naira.
- **Micro-agencies** that need a lightweight ledger, not an ERP.
- **Future you** — the engineer who has to debug "why was this invoice marked paid twice?"

## What I built

A runnable reference implementation in `projects/kobo` — TypeScript + Hono, with a minimal dashboard and a REST API:

```text
Client / curl
     │
     ▼
Hono (auth on mutations)
     │
     ├── Customers
     ├── Invoice state machine (draft → sent → paid | void)
     ├── Webhook ingress (Paystack-style, idempotent)
     └── Append-only audit events
```

## Key engineering decisions

- **Money in kobo.** All amounts are integers; `formatNaira` is display-only — no float drift.
- **Idempotent webhooks.** `x-idempotency-key` is required; a dedupe table ensures provider retries never double-settle an invoice.
- **Fail closed on mismatch.** A webhook amount that does not match the invoice total is rejected; the invoice is not marked paid.
- **State machine, not flags.** Illegal transitions (`draft → paid`) throw — money objects do not "sort of" change state.
- **Append-only audit log.** Every customer creation, transition and webhook is recorded for support and reconciliation.

## Results

```bash
cd projects/kobo
npm install && npm test
```

Vitest covers money math, auth boundaries, invoice transitions, webhook idempotency and amount-mismatch rejection.

## Production path

Swap the in-memory store for Postgres, add Paystack signature verification, PDF/email delivery and row-level locking. The domain logic — state machine, idempotency, audit events — stays unchanged.

## Senior signal

This is the project that says **"I can be trusted with production and with money."** The visible feature set is small; the engineering discipline underneath is the point.
