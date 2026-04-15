# Admin Order Management with Stripe Sync — Design

Date: 2026-04-16
Status: Draft

## Goal

Extend the existing read-only admin orders view (`/admin/orders`) into a full management surface where admins can refund, cancel, edit, resend receipts, write internal notes, and create manual (offline-paid) orders. Every state-changing action must round-trip through Stripe so that Stripe remains the source of truth for money movement, and every action must be recorded in an audit log.

## Non-goals

- Role-based permissions. All admins (anyone passing `getAdminSession`) get full access.
- Editing `ticket_tier` or order amounts after creation. To change a tier, admin refunds and creates a new order.
- Bulk operations (refund many, export selection). Single-order actions only.
- Customer-facing "request refund" UI. Admin-initiated only.

## Decisions made during brainstorming

| Topic | Decision |
| --- | --- |
| Action surface | refund, cancel, edit, resend receipt, manual create, internal notes |
| Permissions | All admins, no roles |
| Audit | New `order_actions` table, every action writes a row (success or failed) |
| Refund | Partial allowed; Stripe `reason` enum + free-text note; modal requires typing `REFUND` to confirm; Stripe handles customer notification email |
| Cancel | Only valid on `pending` orders. Calls `stripe.checkout.sessions.expire()` then sets DB `cancelled` |
| Manual order | Stripe Invoice flow: create Customer → invoice items (existing price IDs) → finalize → `pay({ paid_out_of_band: true })`. Stays the source of truth for offline cash / bank transfer tickets. |
| Edit | `customer_name` and `customer_email` only. Synced to Stripe Customer via `customers.update` |
| Resend receipt | Trigger Stripe receipt via `charges.update({ receipt_email })`. We do not send via Mailgun for this action. |
| UI shape | Per-order detail page at `/admin/orders/[id]`, plus `/admin/orders/new` for manual create |

## Data model changes

New migration `supabase/migrations/add_order_management.sql`.

### `orders` table changes

- Add `partially_refunded` to the `status` CHECK constraint. Final value set: `pending, paid, failed, cancelled, expired, refunded, partially_refunded`.
- Add `amount_refunded BIGINT NOT NULL DEFAULT 0` (cents). Sum of all successful refunds for this order.
- Add `stripe_invoice_id TEXT` (used by manual orders).
- Add `source TEXT NOT NULL DEFAULT 'stripe_checkout'` with CHECK in (`stripe_checkout`, `stripe_invoice_offline`).
- Add `internal_notes TEXT`.
- Make `stripe_session_id` nullable. Drop the existing `UNIQUE` constraint and replace with a partial unique index `CREATE UNIQUE INDEX orders_stripe_session_id_key ON orders(stripe_session_id) WHERE stripe_session_id IS NOT NULL;`.

### New `order_actions` table

```sql
CREATE TABLE order_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'refund', 'cancel', 'edit', 'resend_receipt', 'note', 'manual_create'
  )),
  payload JSONB,            -- action inputs and before→after diff for edits
  stripe_response JSONB,    -- key fields from Stripe: refund.id, refund.status, charge.id, etc.
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX order_actions_order_id_created_at_idx
  ON order_actions(order_id, created_at DESC);
```

The `manual_create` action's `order_id` references the order that was just inserted; it gets written in the same handler.

## API surface

All routes live under `app/api/admin/orders/` and require `getAdminSession`. Each action handler follows the same shape:

1. Auth + input validation.
2. Call Stripe (or skip for note-only actions).
3. On Stripe success: update `orders` row.
4. Always insert one `order_actions` row (success or failed).
5. Return JSON `{ order, action }` or `{ error, stripe_code? }`.

If Stripe call fails, the `orders` row is **not** updated, but the audit row is written with `status='failed'` and `error_message`.

| Method | Path | Body | Stripe call | DB effect |
| --- | --- | --- | --- | --- |
| GET | `/api/admin/orders` | — | — | List (existing) |
| GET | `/api/admin/orders/[id]` | — | — | Order + action timeline |
| POST | `/api/admin/orders` | `{ customer_email, customer_name, ticket_tier, week?, payment_reference?, note? }` | `customers.create`, `invoiceItems.create`, `invoices.create`, `invoices.finalizeInvoice`, `invoices.pay({paid_out_of_band:true})` | Insert order with `source='stripe_invoice_offline'`, `status='paid'` |
| POST | `/api/admin/orders/[id]/refund` | `{ amount?, reason, note? }` | `refunds.create({ payment_intent, amount?, reason, metadata: { admin_email, note } })` | `amount_refunded += amount`; status → `refunded` if fully refunded else `partially_refunded` |
| POST | `/api/admin/orders/[id]/cancel` | — | `checkout.sessions.expire(stripe_session_id)` | status → `cancelled` |
| PATCH | `/api/admin/orders/[id]` | `{ customer_name?, customer_email? }` | `customers.update(...)` if a Stripe customer exists on the PaymentIntent | Update fields; payload records before/after diff |
| POST | `/api/admin/orders/[id]/resend-receipt` | — | `charges.update(charge_id, { receipt_email: customer_email })` | None (action row only) |
| POST | `/api/admin/orders/[id]/notes` | `{ internal_notes }` | — | Update `internal_notes` |

### Refund preconditions

- Order `status` must be `paid` or `partially_refunded`.
- Requested `amount` must be ≤ `amount_total - amount_refunded`. Server enforces.
- **Stripe-checkout orders** (`source='stripe_checkout'`): require `stripe_payment_intent_id`; call `refunds.create({ payment_intent, amount?, reason })`.
- **Manual offline orders** (`source='stripe_invoice_offline'`): no Stripe charge exists (invoice was `paid_out_of_band`), so refund is DB-only — admin handles the cash/transfer reversal separately. UI must show a warning in the refund modal making this explicit. Audit row payload includes `external_refund: true` to flag it.

### Cancel preconditions

- Order `status` must be `pending`.
- Order must have a `stripe_session_id` (cancel is meaningless for manual orders, which are already paid).

### Edit preconditions

- Email must be a valid format. No uniqueness check on email; the field is informational, not a login key.
- If a Stripe Customer exists on the PaymentIntent, sync to it. If not (rare for legacy orders), update DB only and note in payload.

## Stripe webhook updates

Existing `/api/webhooks/stripe` handler gets two new event types:

- `charge.refunded` — verify our `amount_refunded` matches Stripe's `amount_refunded`; reconcile if a refund happened in the Stripe Dashboard outside our admin UI. Update status accordingly.
- `charge.refund.updated` — handle refunds that move from `pending` → `succeeded` / `failed` (e.g. ACH refunds). Adjust DB on terminal state.

This keeps the system correct even if someone refunds directly in Stripe Dashboard.

## Lib layer

New file `lib/orderActions.ts` exporting one function per action:

```
refundOrder(orderId, { amount, reason, note }, adminEmail)
cancelOrder(orderId, adminEmail)
editOrder(orderId, { customer_name?, customer_email? }, adminEmail)
resendReceipt(orderId, adminEmail)
saveNote(orderId, internal_notes, adminEmail)
createManualOrder(input, adminEmail)
```

Each function owns the Stripe call, DB update, and audit insert. API route handlers are thin wrappers that handle auth and HTTP shaping. This keeps the business logic testable and isolated from request plumbing.

## UI

### `app/admin/orders/page.tsx` (existing)

- Add a "查看" link in each row → `/admin/orders/[id]`.
- Add a "手動建單" button in the page header → `/admin/orders/new`.
- Add `partially_refunded` to `STATUS_OPTIONS`, `STATUS_STYLES` (purple-ish), `STATUS_LABELS` (`部分退款`).

### `app/admin/orders/[id]/page.tsx` (new)

Single-column stacked cards:

1. **Order info card.** ID, source badge, ticket tier, status badge, totals (subtotal, discount, tax, total, refunded). Stripe IDs (session / payment intent / invoice) rendered as outbound links to the Stripe Dashboard.
2. **Customer card.** Name + email with inline edit (pencil → input → save / cancel). On save, calls `PATCH /api/admin/orders/[id]`.
3. **Actions card.** Buttons rendered conditionally:
   - `退款` if status ∈ {`paid`, `partially_refunded`} → opens modal with amount (default = remaining), reason dropdown, optional note, requires typing `REFUND` to enable submit.
   - `取消` if status = `pending` → confirm modal.
   - `重寄收據` if status = `paid` → fires immediately, shows toast.
   - `備註` always visible: textarea + save button calling `POST .../notes`.
4. **Timeline card.** `order_actions` rows newest-first. Each row: admin email, timestamp, action label, summary of payload (e.g. "退款 NT$500 — duplicate"), success/failed pill, expandable raw payload.

### `app/admin/orders/new/page.tsx` (new)

Form: email, name, ticket_tier dropdown (with `week` sub-select that appears when tier = `weekly_backer`), payment reference (free text, e.g. "bank transfer 4/14"), note. On submit, POST `/api/admin/orders` and redirect to the new order's detail page.

## Error handling

- All admin endpoints return `{ error, stripe_code? }` with a 4xx/5xx status.
- Network/Stripe failures: audit row is still written (`status='failed'`, `error_message`), DB orders unchanged.
- UI surfaces errors via toast, leaves form state intact for retry.
- Webhook reconciliation absorbs Dashboard-side mutations so the UI eventually matches Stripe even if our mutations diverge.

## Out of scope (called out so we don't add it)

- Email templates for refund / cancel notifications beyond Stripe's defaults.
- Refund authorization beyond `getAdminSession` (e.g. 2FA, manager approval).
- Editing addresses, phone, payment method, tax IDs.
- Reissuing tickets / sending new confirmation emails after edit.
