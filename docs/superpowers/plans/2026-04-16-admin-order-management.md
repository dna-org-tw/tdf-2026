# Admin Order Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins refund, cancel, edit, resend receipts, add internal notes, and create manual (offline-paid) orders at `/admin/orders`, with every action round-tripping through Stripe and recorded in an `order_actions` audit log.

**Architecture:** New DB migration extends `orders` and adds `order_actions`. Business logic lives in `lib/orderActions.ts`; thin API routes under `app/api/admin/orders/` handle HTTP. A detail page at `/admin/orders/[id]` renders info + action buttons + timeline; `/admin/orders/new` handles manual create via Stripe Invoice `paid_out_of_band`. Webhook gains refund reconciliation.

**Tech Stack:** Next.js 16 App Router, Supabase (service role), Stripe Node SDK (`stripe@^17`), Tailwind 4, TypeScript strict.

**Testing note:** Repo has no test framework. Each task ends with **manual verification** (curl, SQL, or browser) plus a commit.

**Reference spec:** `docs/superpowers/specs/2026-04-16-admin-order-management-design.md`

---

## File Structure

**Create:**
- `supabase/migrations/add_order_management.sql`
- `lib/orderActions.ts`
- `app/api/admin/orders/[id]/route.ts` (GET + PATCH)
- `app/api/admin/orders/[id]/refund/route.ts`
- `app/api/admin/orders/[id]/cancel/route.ts`
- `app/api/admin/orders/[id]/resend-receipt/route.ts`
- `app/api/admin/orders/[id]/notes/route.ts`
- `app/admin/orders/[id]/page.tsx`
- `app/admin/orders/new/page.tsx`

**Modify:**
- `lib/types/order.ts` — add new fields + `OrderAction` type
- `app/api/admin/orders/route.ts` — add POST (manual create)
- `app/api/webhooks/stripe/route.ts` — handle `charge.refunded`, `charge.refund.updated`
- `app/admin/orders/page.tsx` — row "查看" link, "手動建單" button, `partially_refunded` label/style

---

## Task 1: DB migration

**Files:**
- Create: `supabase/migrations/add_order_management.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Extend orders table + add order_actions audit table for admin management.

-- 1. Widen status CHECK constraint (add 'partially_refunded')
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'expired', 'refunded', 'partially_refunded'));

-- 2. New columns
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS amount_refunded BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'stripe_checkout',
  ADD COLUMN IF NOT EXISTS internal_notes TEXT;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_source_check;
ALTER TABLE orders ADD CONSTRAINT orders_source_check
  CHECK (source IN ('stripe_checkout', 'stripe_invoice_offline'));

-- 3. Make stripe_session_id nullable; replace unique constraint with partial index
ALTER TABLE orders ALTER COLUMN stripe_session_id DROP NOT NULL;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_stripe_session_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_session_id_key
  ON orders(stripe_session_id) WHERE stripe_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_stripe_invoice_id ON orders(stripe_invoice_id);

COMMENT ON COLUMN orders.amount_refunded IS '已退款總額（以分為單位）';
COMMENT ON COLUMN orders.stripe_invoice_id IS '手動建單用的 Stripe Invoice ID';
COMMENT ON COLUMN orders.source IS '訂單來源：stripe_checkout | stripe_invoice_offline';
COMMENT ON COLUMN orders.internal_notes IS 'admin 內部備註';

-- 4. order_actions audit table
CREATE TABLE IF NOT EXISTS order_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'refund', 'cancel', 'edit', 'resend_receipt', 'note', 'manual_create'
  )),
  payload JSONB,
  stripe_response JSONB,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS order_actions_order_id_created_at_idx
  ON order_actions(order_id, created_at DESC);

COMMENT ON TABLE order_actions IS 'Admin 對訂單執行的操作稽核記錄';
```

- [ ] **Step 2: Apply the migration**

Run against the dev database:
```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/add_order_management.sql
```
Expected: no errors. If Supabase is managed via MCP, use `mcp__claude_ai_Supabase__apply_migration` with `name=add_order_management` and the SQL above.

- [ ] **Step 3: Verify schema**

```bash
psql "$SUPABASE_DB_URL" -c "\d orders" -c "\d order_actions"
```
Expected: `orders` shows `amount_refunded`, `stripe_invoice_id`, `source`, `internal_notes`, `stripe_session_id` nullable. `order_actions` table exists.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/add_order_management.sql
git commit -m "feat(db): add order management columns and order_actions audit table"
```

---

## Task 2: Update order types

**Files:**
- Modify: `lib/types/order.ts`

- [ ] **Step 1: Extend types**

Replace the existing `OrderStatus` and `Order` definitions with:

```typescript
export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'refunded'
  | 'partially_refunded';

export type OrderSource = 'stripe_checkout' | 'stripe_invoice_offline';

export type OrderActionType =
  | 'refund'
  | 'cancel'
  | 'edit'
  | 'resend_receipt'
  | 'note'
  | 'manual_create';

export interface Order {
  id: string;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_invoice_id: string | null;
  ticket_tier: 'explore' | 'contribute' | 'weekly_backer' | 'backer';
  status: OrderStatus;
  source: OrderSource;
  amount_subtotal: number;
  amount_total: number;
  amount_tax: number;
  amount_discount: number;
  amount_refunded: number;
  currency: string;
  customer_email: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
  } | null;
  payment_method_brand: string | null;
  payment_method_last4: string | null;
  payment_method_type: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderAction {
  id: string;
  order_id: string;
  admin_email: string;
  action: OrderActionType;
  payload: Record<string, unknown> | null;
  stripe_response: Record<string, unknown> | null;
  status: 'success' | 'failed';
  error_message: string | null;
  created_at: string;
}
```

Update `UpdateOrderInput` to include the new optional fields:

```typescript
export interface UpdateOrderInput {
  stripe_payment_intent_id?: string | null;
  stripe_invoice_id?: string | null;
  status?: OrderStatus;
  source?: OrderSource;
  amount_subtotal?: number;
  amount_total?: number;
  amount_tax?: number;
  amount_discount?: number;
  amount_refunded?: number;
  customer_email?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: Order['customer_address'];
  payment_method_brand?: string | null;
  payment_method_last4?: string | null;
  payment_method_type?: string | null;
  internal_notes?: string | null;
}
```

Update `CreateOrderInput` to allow null session_id and optional source:

```typescript
export interface CreateOrderInput {
  stripe_session_id: string | null;
  stripe_invoice_id?: string | null;
  ticket_tier: 'explore' | 'contribute' | 'weekly_backer' | 'backer';
  amount_subtotal: number;
  amount_total: number;
  amount_tax: number;
  amount_discount: number;
  currency: string;
  source?: OrderSource;
  visitor_fingerprint?: string | null;
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors specific to this file. Existing callers of `createOrder` pass `stripe_session_id: string` which still satisfies `string | null`; `updateOrder` callers unchanged. If errors surface in `lib/orders.ts` or webhook, fix them minimally — `orders.ts` should pass through the new optional fields in `updateOrder` (mirror the existing `if (input.x !== undefined) updateData.x = input.x` pattern for `stripe_invoice_id`, `source`, `amount_refunded`, `internal_notes`).

- [ ] **Step 3: Extend `lib/orders.ts` updateOrder**

In the `updateOrder` function, add the missing fields to the conditional assignment block:

```typescript
if (input.stripe_invoice_id !== undefined) {
  updateData.stripe_invoice_id = input.stripe_invoice_id;
}
if (input.source !== undefined) {
  updateData.source = input.source;
}
if (input.amount_refunded !== undefined) {
  updateData.amount_refunded = input.amount_refunded;
}
if (input.internal_notes !== undefined) {
  updateData.internal_notes = input.internal_notes;
}
```

Also in `createOrder`, change `stripe_session_id: input.stripe_session_id` pass-through to allow null (it already does since value can be `null`), and thread through the new optional columns:

```typescript
if (input.stripe_invoice_id) insertData.stripe_invoice_id = input.stripe_invoice_id;
if (input.source) insertData.source = input.source;
```

- [ ] **Step 4: Typecheck again**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add lib/types/order.ts lib/orders.ts
git commit -m "feat(types): extend Order type with refund/source/notes + add OrderAction"
```

---

## Task 3: Core order action library

**Files:**
- Create: `lib/orderActions.ts`

This file owns Stripe calls, DB updates, and audit inserts for every admin action.

- [ ] **Step 1: Write the library**

```typescript
import Stripe from 'stripe';
import { supabaseServer } from './supabaseServer';
import type { Order, OrderActionType } from './types/order';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2025-12-15.clover' })
  : null;

const PRICE_IDS: Record<Order['ticket_tier'], string | undefined> = {
  explore: process.env.STRIPE_PRICE_EXPLORE,
  contribute: process.env.STRIPE_PRICE_CONTRIBUTE,
  weekly_backer: process.env.STRIPE_PRICE_WEEKLY_BACKER,
  backer: process.env.STRIPE_PRICE_BACKER,
};

export class OrderActionError extends Error {
  constructor(
    message: string,
    public stripeCode?: string,
    public httpStatus: number = 400,
  ) {
    super(message);
  }
}

async function writeAction(
  orderId: string,
  adminEmail: string,
  action: OrderActionType,
  payload: Record<string, unknown> | null,
  stripeResponse: Record<string, unknown> | null,
  status: 'success' | 'failed',
  errorMessage: string | null = null,
): Promise<void> {
  if (!supabaseServer) return;
  await supabaseServer.from('order_actions').insert({
    order_id: orderId,
    admin_email: adminEmail,
    action,
    payload,
    stripe_response: stripeResponse,
    status,
    error_message: errorMessage,
  });
}

async function getOrder(orderId: string): Promise<Order> {
  if (!supabaseServer) throw new OrderActionError('DB not configured', undefined, 500);
  const { data, error } = await supabaseServer
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();
  if (error || !data) throw new OrderActionError('Order not found', undefined, 404);
  return data as Order;
}

function requireStripe(): Stripe {
  if (!stripe) throw new OrderActionError('Stripe not configured', undefined, 500);
  return stripe;
}

// ---------- Refund ----------

export interface RefundInput {
  amount?: number; // cents; omit = full remaining
  reason: 'requested_by_customer' | 'duplicate' | 'fraudulent';
  note?: string;
}

export async function refundOrder(
  orderId: string,
  input: RefundInput,
  adminEmail: string,
): Promise<Order> {
  const order = await getOrder(orderId);

  if (order.status !== 'paid' && order.status !== 'partially_refunded') {
    throw new OrderActionError(`Cannot refund order with status ${order.status}`);
  }

  const remaining = order.amount_total - order.amount_refunded;
  const amount = input.amount ?? remaining;
  if (amount <= 0 || amount > remaining) {
    throw new OrderActionError(`Invalid refund amount. Remaining: ${remaining}`);
  }

  // Offline manual orders: DB-only refund (no Stripe charge exists).
  if (order.source === 'stripe_invoice_offline') {
    const newRefunded = order.amount_refunded + amount;
    const newStatus = newRefunded >= order.amount_total ? 'refunded' : 'partially_refunded';
    const { data, error } = await supabaseServer!
      .from('orders')
      .update({ amount_refunded: newRefunded, status: newStatus })
      .eq('id', orderId)
      .select()
      .single();
    if (error) throw new OrderActionError(error.message, undefined, 500);
    await writeAction(orderId, adminEmail, 'refund', { ...input, amount, external_refund: true }, null, 'success');
    return data as Order;
  }

  if (!order.stripe_payment_intent_id) {
    throw new OrderActionError('Order has no payment intent to refund');
  }

  const s = requireStripe();
  try {
    const refund = await s.refunds.create({
      payment_intent: order.stripe_payment_intent_id,
      amount,
      reason: input.reason,
      metadata: { admin_email: adminEmail, note: input.note ?? '' },
    });

    const newRefunded = order.amount_refunded + amount;
    const newStatus = newRefunded >= order.amount_total ? 'refunded' : 'partially_refunded';
    const { data, error } = await supabaseServer!
      .from('orders')
      .update({ amount_refunded: newRefunded, status: newStatus })
      .eq('id', orderId)
      .select()
      .single();
    if (error) throw new OrderActionError(error.message, undefined, 500);

    await writeAction(
      orderId,
      adminEmail,
      'refund',
      { ...input, amount },
      { refund_id: refund.id, refund_status: refund.status },
      'success',
    );
    return data as Order;
  } catch (err) {
    const stripeErr = err as Stripe.errors.StripeError;
    await writeAction(orderId, adminEmail, 'refund', { ...input, amount }, null, 'failed', stripeErr.message);
    throw new OrderActionError(stripeErr.message, stripeErr.code, 400);
  }
}

// ---------- Cancel ----------

export async function cancelOrder(orderId: string, adminEmail: string): Promise<Order> {
  const order = await getOrder(orderId);

  if (order.status !== 'pending') {
    throw new OrderActionError(`Cannot cancel order with status ${order.status}`);
  }
  if (!order.stripe_session_id) {
    throw new OrderActionError('Order has no Stripe session');
  }

  const s = requireStripe();
  try {
    const expired = await s.checkout.sessions.expire(order.stripe_session_id);
    const { data, error } = await supabaseServer!
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId)
      .select()
      .single();
    if (error) throw new OrderActionError(error.message, undefined, 500);
    await writeAction(orderId, adminEmail, 'cancel', {}, { session_status: expired.status }, 'success');
    return data as Order;
  } catch (err) {
    const stripeErr = err as Stripe.errors.StripeError;
    await writeAction(orderId, adminEmail, 'cancel', {}, null, 'failed', stripeErr.message);
    throw new OrderActionError(stripeErr.message, stripeErr.code, 400);
  }
}

// ---------- Edit ----------

export interface EditInput {
  customer_name?: string;
  customer_email?: string;
}

export async function editOrder(
  orderId: string,
  input: EditInput,
  adminEmail: string,
): Promise<Order> {
  const order = await getOrder(orderId);
  const before = { customer_name: order.customer_name, customer_email: order.customer_email };
  const changes: Record<string, string> = {};
  if (input.customer_name !== undefined && input.customer_name !== order.customer_name) {
    changes.customer_name = input.customer_name;
  }
  if (input.customer_email !== undefined) {
    const email = input.customer_email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new OrderActionError('Invalid email format');
    }
    if (email !== order.customer_email) changes.customer_email = email;
  }
  if (Object.keys(changes).length === 0) return order;

  const s = requireStripe();
  let stripeResponse: Record<string, unknown> | null = null;

  if (order.stripe_payment_intent_id) {
    try {
      const pi = await s.paymentIntents.retrieve(order.stripe_payment_intent_id);
      const customerId = typeof pi.customer === 'string' ? pi.customer : pi.customer?.id;
      if (customerId) {
        const updated = await s.customers.update(customerId, {
          ...(changes.customer_name !== undefined ? { name: changes.customer_name } : {}),
          ...(changes.customer_email !== undefined ? { email: changes.customer_email } : {}),
        });
        stripeResponse = { customer_id: updated.id };
      } else {
        stripeResponse = { note: 'no customer on payment intent' };
      }
    } catch (err) {
      const stripeErr = err as Stripe.errors.StripeError;
      await writeAction(
        orderId, adminEmail, 'edit',
        { before, after: changes },
        null, 'failed', stripeErr.message,
      );
      throw new OrderActionError(stripeErr.message, stripeErr.code, 400);
    }
  }

  const { data, error } = await supabaseServer!
    .from('orders')
    .update(changes)
    .eq('id', orderId)
    .select()
    .single();
  if (error) throw new OrderActionError(error.message, undefined, 500);
  await writeAction(orderId, adminEmail, 'edit', { before, after: changes }, stripeResponse, 'success');
  return data as Order;
}

// ---------- Resend receipt ----------

export async function resendReceipt(orderId: string, adminEmail: string): Promise<void> {
  const order = await getOrder(orderId);
  if (order.status !== 'paid' && order.status !== 'partially_refunded') {
    throw new OrderActionError('Can only resend receipt for paid orders');
  }
  if (!order.customer_email) throw new OrderActionError('Order has no customer email');
  if (!order.stripe_payment_intent_id) throw new OrderActionError('Order has no payment intent');

  const s = requireStripe();
  try {
    const pi = await s.paymentIntents.retrieve(order.stripe_payment_intent_id, {
      expand: ['latest_charge'],
    });
    const chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id;
    if (!chargeId) throw new OrderActionError('No charge found on payment intent');
    const charge = await s.charges.update(chargeId, { receipt_email: order.customer_email });
    await writeAction(
      orderId, adminEmail, 'resend_receipt',
      { receipt_email: order.customer_email },
      { charge_id: charge.id, receipt_url: charge.receipt_url },
      'success',
    );
  } catch (err) {
    const stripeErr = err as Stripe.errors.StripeError;
    await writeAction(orderId, adminEmail, 'resend_receipt', {}, null, 'failed', stripeErr.message);
    throw new OrderActionError(stripeErr.message, stripeErr.code, 400);
  }
}

// ---------- Save note ----------

export async function saveNote(
  orderId: string,
  internalNotes: string,
  adminEmail: string,
): Promise<Order> {
  const order = await getOrder(orderId);
  const before = order.internal_notes;
  const { data, error } = await supabaseServer!
    .from('orders')
    .update({ internal_notes: internalNotes })
    .eq('id', orderId)
    .select()
    .single();
  if (error) throw new OrderActionError(error.message, undefined, 500);
  await writeAction(orderId, adminEmail, 'note', { before, after: internalNotes }, null, 'success');
  return data as Order;
}

// ---------- Manual create ----------

export interface ManualCreateInput {
  customer_email: string;
  customer_name: string;
  ticket_tier: Order['ticket_tier'];
  week?: 'week1' | 'week2' | 'week3' | 'week4';
  payment_reference?: string;
  note?: string;
}

export async function createManualOrder(
  input: ManualCreateInput,
  adminEmail: string,
): Promise<Order> {
  if (!supabaseServer) throw new OrderActionError('DB not configured', undefined, 500);
  if (input.ticket_tier === 'weekly_backer' && !input.week) {
    throw new OrderActionError('week is required for weekly_backer');
  }
  const priceId = PRICE_IDS[input.ticket_tier];
  if (!priceId) throw new OrderActionError(`No price configured for ${input.ticket_tier}`);

  const s = requireStripe();

  let customer: Stripe.Customer;
  let invoice: Stripe.Invoice;
  try {
    const existing = await s.customers.list({ email: input.customer_email, limit: 1 });
    customer = existing.data[0] ?? await s.customers.create({
      email: input.customer_email,
      name: input.customer_name,
    });
    await s.invoiceItems.create({
      customer: customer.id,
      price: priceId,
    });
    const draft = await s.invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: 0,
      metadata: {
        admin_email: adminEmail,
        source: 'manual_offline',
        payment_reference: input.payment_reference ?? '',
        note: input.note ?? '',
        ...(input.week ? { week: input.week } : {}),
      },
    });
    if (!draft.id) throw new OrderActionError('Invoice has no ID');
    const finalized = await s.invoices.finalizeInvoice(draft.id);
    if (!finalized.id) throw new OrderActionError('Finalized invoice has no ID');
    invoice = await s.invoices.pay(finalized.id, { paid_out_of_band: true });
  } catch (err) {
    const stripeErr = err as Stripe.errors.StripeError;
    throw new OrderActionError(stripeErr.message, stripeErr.code, 400);
  }

  const { data: created, error: createErr } = await supabaseServer
    .from('orders')
    .insert({
      stripe_session_id: null,
      stripe_invoice_id: invoice.id,
      ticket_tier: input.ticket_tier,
      status: 'paid',
      source: 'stripe_invoice_offline',
      amount_subtotal: invoice.subtotal ?? 0,
      amount_total: invoice.total ?? 0,
      amount_tax: invoice.tax ?? 0,
      amount_discount: 0,
      currency: invoice.currency ?? 'usd',
      customer_email: input.customer_email,
      customer_name: input.customer_name,
    })
    .select()
    .single();
  if (createErr || !created) throw new OrderActionError(createErr?.message ?? 'Insert failed', undefined, 500);

  await writeAction(
    created.id as string,
    adminEmail,
    'manual_create',
    { ...input },
    { invoice_id: invoice.id, customer_id: customer.id },
    'success',
  );
  return created as Order;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/orderActions.ts
git commit -m "feat(lib): add orderActions with refund/cancel/edit/resend/note/manual-create"
```

---

## Task 4: Webhook refund reconciliation

**Files:**
- Modify: `app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Add refund event handling**

After the existing `checkout.session.expired` block (before the final `return NextResponse.json({ received: true })`), insert:

```typescript
    // charge.refunded: a refund was created (may be dashboard or our admin UI)
    else if (event.type === 'charge.refunded' || event.type === 'charge.refund.updated') {
      const object = event.data.object as Stripe.Charge | Stripe.Refund;
      const paymentIntentId = 'payment_intent' in object
        ? (typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id)
        : null;
      if (!paymentIntentId || !supabaseServer) {
        return NextResponse.json({ received: true });
      }

      // Look up order by payment intent
      const { data: order } = await supabaseServer
        .from('orders')
        .select('id, amount_total, amount_refunded')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .maybeSingle();

      if (!order) {
        console.warn('[Webhook] Refund event for unknown PI:', paymentIntentId);
        return NextResponse.json({ received: true });
      }

      // Re-fetch the charge to get authoritative amount_refunded
      try {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] });
        const chargeObj = pi.latest_charge && typeof pi.latest_charge !== 'string' ? pi.latest_charge : null;
        const stripeRefunded = chargeObj?.amount_refunded ?? 0;
        if (stripeRefunded !== order.amount_refunded) {
          const newStatus = stripeRefunded >= order.amount_total ? 'refunded' : 'partially_refunded';
          await supabaseServer
            .from('orders')
            .update({ amount_refunded: stripeRefunded, status: newStatus })
            .eq('id', order.id);
          console.log('[Webhook] Reconciled refund for order:', order.id, { stripeRefunded });
        }
      } catch (err) {
        console.error('[Webhook] Error reconciling refund:', err);
      }
    }
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Manual verification — Stripe CLI (optional)**

If Stripe CLI is available:
```bash
stripe trigger charge.refunded
```
Check logs: `[Webhook] Refund event for unknown PI:` for a synthetic PI is fine; confirms the branch runs.

- [ ] **Step 4: Commit**

```bash
git add app/api/webhooks/stripe/route.ts
git commit -m "feat(webhook): reconcile charge.refunded and charge.refund.updated events"
```

---

## Task 5: API — GET order detail + PATCH edit

**Files:**
- Create: `app/api/admin/orders/[id]/route.ts`

- [ ] **Step 1: Write the route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { editOrder, OrderActionError } from '@/lib/orderActions';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'DB not configured' }, { status: 500 });

  const { id } = await params;

  const [orderRes, actionsRes] = await Promise.all([
    supabaseServer.from('orders').select('*').eq('id', id).maybeSingle(),
    supabaseServer.from('order_actions').select('*').eq('order_id', id).order('created_at', { ascending: false }),
  ]);

  if (orderRes.error || !orderRes.data) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  return NextResponse.json({
    order: orderRes.data,
    actions: actionsRes.data ?? [],
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  try {
    const order = await editOrder(
      id,
      { customer_name: body.customer_name, customer_email: body.customer_email },
      session.email,
    );
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof OrderActionError) {
      return NextResponse.json({ error: err.message, stripe_code: err.stripeCode }, { status: err.httpStatus });
    }
    console.error('[PATCH order]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Manual verification**

Start dev server: `npm run dev` (if not already running).

Replace `<ORDER_ID>` with a real order UUID from the DB and `<COOKIE>` with a logged-in admin session cookie:
```bash
curl -s -H "Cookie: <COOKIE>" http://localhost:3000/api/admin/orders/<ORDER_ID> | jq
```
Expected: `{ order: {...}, actions: [] }`.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/orders/\[id\]/route.ts
git commit -m "feat(api): GET order detail with actions timeline + PATCH to edit customer"
```

---

## Task 6: API — refund

**Files:**
- Create: `app/api/admin/orders/[id]/refund/route.ts`

- [ ] **Step 1: Write the route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { refundOrder, OrderActionError } from '@/lib/orderActions';

const VALID_REASONS = ['requested_by_customer', 'duplicate', 'fraudulent'] as const;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (!body?.reason || !VALID_REASONS.includes(body.reason)) {
    return NextResponse.json({ error: 'Invalid reason' }, { status: 400 });
  }
  if (body.amount !== undefined && (typeof body.amount !== 'number' || body.amount <= 0)) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }

  try {
    const order = await refundOrder(
      id,
      { amount: body.amount, reason: body.reason, note: body.note },
      session.email,
    );
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof OrderActionError) {
      return NextResponse.json({ error: err.message, stripe_code: err.stripeCode }, { status: err.httpStatus });
    }
    console.error('[POST refund]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Manual verification**

Use a Stripe test-mode order. Requires a recent test paid order in the DB:
```bash
curl -s -X POST -H "Cookie: <COOKIE>" -H "Content-Type: application/json" \
  -d '{"reason":"requested_by_customer","amount":100,"note":"test"}' \
  http://localhost:3000/api/admin/orders/<ORDER_ID>/refund | jq
```
Expected: `{ order: { ..., amount_refunded: 100, status: "partially_refunded" } }`.

Then in SQL:
```sql
SELECT action, status, stripe_response FROM order_actions WHERE order_id = '<ORDER_ID>' ORDER BY created_at DESC LIMIT 1;
```
Expected: `action=refund`, `status=success`, `stripe_response` contains `refund_id`.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/orders/\[id\]/refund/route.ts
git commit -m "feat(api): add admin refund endpoint"
```

---

## Task 7: API — cancel

**Files:**
- Create: `app/api/admin/orders/[id]/cancel/route.ts`

- [ ] **Step 1: Write the route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { cancelOrder, OrderActionError } from '@/lib/orderActions';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const order = await cancelOrder(id, session.email);
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof OrderActionError) {
      return NextResponse.json({ error: err.message, stripe_code: err.stripeCode }, { status: err.httpStatus });
    }
    console.error('[POST cancel]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Manual verification**

Needs a `pending` order:
```bash
curl -s -X POST -H "Cookie: <COOKIE>" http://localhost:3000/api/admin/orders/<PENDING_ORDER_ID>/cancel | jq
```
Expected: `{ order: { ..., status: "cancelled" } }`.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/orders/\[id\]/cancel/route.ts
git commit -m "feat(api): add admin cancel endpoint"
```

---

## Task 8: API — resend receipt

**Files:**
- Create: `app/api/admin/orders/[id]/resend-receipt/route.ts`

- [ ] **Step 1: Write the route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { resendReceipt, OrderActionError } from '@/lib/orderActions';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    await resendReceipt(id, session.email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof OrderActionError) {
      return NextResponse.json({ error: err.message, stripe_code: err.stripeCode }, { status: err.httpStatus });
    }
    console.error('[POST resend-receipt]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Manual verification**

```bash
curl -s -X POST -H "Cookie: <COOKIE>" http://localhost:3000/api/admin/orders/<PAID_ORDER_ID>/resend-receipt | jq
```
Expected: `{ ok: true }`. Stripe dashboard → the charge should show a newly-sent receipt email.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/orders/\[id\]/resend-receipt/route.ts
git commit -m "feat(api): add admin resend-receipt endpoint"
```

---

## Task 9: API — notes

**Files:**
- Create: `app/api/admin/orders/[id]/notes/route.ts`

- [ ] **Step 1: Write the route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { saveNote, OrderActionError } from '@/lib/orderActions';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (typeof body.internal_notes !== 'string') {
    return NextResponse.json({ error: 'internal_notes must be a string' }, { status: 400 });
  }

  try {
    const order = await saveNote(id, body.internal_notes, session.email);
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof OrderActionError) {
      return NextResponse.json({ error: err.message, stripe_code: err.stripeCode }, { status: err.httpStatus });
    }
    console.error('[POST notes]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Manual verification**

```bash
curl -s -X POST -H "Cookie: <COOKIE>" -H "Content-Type: application/json" \
  -d '{"internal_notes":"test note"}' \
  http://localhost:3000/api/admin/orders/<ORDER_ID>/notes | jq
```
Expected: `{ order: { ..., internal_notes: "test note" } }`.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/orders/\[id\]/notes/route.ts
git commit -m "feat(api): add admin internal-notes endpoint"
```

---

## Task 10: API — manual create (POST on existing route)

**Files:**
- Modify: `app/api/admin/orders/route.ts`

- [ ] **Step 1: Add POST handler**

At the bottom of the file, after the existing `GET`:

```typescript
import { createManualOrder, OrderActionError } from '@/lib/orderActions';

const VALID_TIERS = ['explore', 'contribute', 'weekly_backer', 'backer'] as const;
const VALID_WEEKS = ['week1', 'week2', 'week3', 'week4'] as const;

export async function POST(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  if (!body?.customer_email || typeof body.customer_email !== 'string') {
    return NextResponse.json({ error: 'customer_email required' }, { status: 400 });
  }
  if (!body?.customer_name || typeof body.customer_name !== 'string') {
    return NextResponse.json({ error: 'customer_name required' }, { status: 400 });
  }
  if (!VALID_TIERS.includes(body.ticket_tier)) {
    return NextResponse.json({ error: 'invalid ticket_tier' }, { status: 400 });
  }
  if (body.ticket_tier === 'weekly_backer' && !VALID_WEEKS.includes(body.week)) {
    return NextResponse.json({ error: 'week required for weekly_backer' }, { status: 400 });
  }

  try {
    const order = await createManualOrder(
      {
        customer_email: body.customer_email,
        customer_name: body.customer_name,
        ticket_tier: body.ticket_tier,
        week: body.week,
        payment_reference: body.payment_reference,
        note: body.note,
      },
      session.email,
    );
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof OrderActionError) {
      return NextResponse.json({ error: err.message, stripe_code: err.stripeCode }, { status: err.httpStatus });
    }
    console.error('[POST manual create]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Manual verification**

```bash
curl -s -X POST -H "Cookie: <COOKIE>" -H "Content-Type: application/json" \
  -d '{"customer_email":"test@example.com","customer_name":"Test","ticket_tier":"explore"}' \
  http://localhost:3000/api/admin/orders | jq
```
Expected: `{ order: { ..., source: "stripe_invoice_offline", status: "paid", stripe_invoice_id: "in_..." } }`.

Cross-check in Stripe Dashboard (test mode): invoice exists, marked paid out of band.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/orders/route.ts
git commit -m "feat(api): add POST for manual offline order creation"
```

---

## Task 11: UI — list page updates

**Files:**
- Modify: `app/admin/orders/page.tsx`

- [ ] **Step 1: Add `partially_refunded` label/style**

In the constants near the top:

```typescript
const STATUS_OPTIONS = [
  { value: '', label: '全部狀態' },
  { value: 'paid', label: '已付款' },
  { value: 'pending', label: '待處理' },
  { value: 'failed', label: '失敗' },
  { value: 'cancelled', label: '已取消' },
  { value: 'expired', label: '已過期' },
  { value: 'refunded', label: '已退款' },
  { value: 'partially_refunded', label: '部分退款' },
];

const STATUS_STYLES: Record<string, string> = {
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-600',
  expired: 'bg-orange-100 text-orange-700',
  refunded: 'bg-purple-100 text-purple-700',
  partially_refunded: 'bg-fuchsia-100 text-fuchsia-700',
};

const STATUS_LABELS: Record<string, string> = {
  paid: '已付款',
  pending: '待處理',
  failed: '失敗',
  cancelled: '已取消',
  expired: '已過期',
  refunded: '已退款',
  partially_refunded: '部分退款',
};
```

- [ ] **Step 2: Add "手動建單" button in header**

Replace `<h1 className="text-2xl font-bold text-slate-900 mb-6">訂單管理</h1>` with:

```tsx
<div className="flex items-center justify-between mb-6">
  <h1 className="text-2xl font-bold text-slate-900">訂單管理</h1>
  <a
    href="/admin/orders/new"
    className="px-4 py-2 text-sm font-medium text-white bg-[#10B8D9] rounded-lg hover:bg-[#0EA5C4] transition-colors"
  >
    手動建單
  </a>
</div>
```

- [ ] **Step 3: Add row click → detail page**

Wrap each `<tr>` body content so clicking a row navigates. Simplest: add an action cell. Inside the table header row, before `訂單編號`, add nothing; instead change `<th className="text-right px-4 py-3 font-medium text-slate-600">建立時間</th>` to keep as-is, then add a new `<th className="px-4 py-3"></th>` after it.

In the `<tbody>` row rendering, after the `建立時間` cell, add:

```tsx
<td className="px-4 py-3 text-right whitespace-nowrap">
  <a
    href={`/admin/orders/${o.id}`}
    className="text-[#10B8D9] hover:underline text-xs font-medium"
  >
    查看
  </a>
</td>
```

Update `colSpan` in the empty state from `7` to `8`, and the skeleton row's inner loop from `length: 7` to `length: 8`.

- [ ] **Step 4: Manual verification**

Run `npm run dev`, visit `http://localhost:3000/admin/orders`. Expected: "手動建單" button top-right, each row has "查看" link, `partially_refunded` shows with fuchsia pill if any exist.

- [ ] **Step 5: Commit**

```bash
git add app/admin/orders/page.tsx
git commit -m "feat(admin/ui): add manual-create button, view link, partially_refunded label"
```

---

## Task 12: UI — detail page

**Files:**
- Create: `app/admin/orders/[id]/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Order {
  id: string;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_invoice_id: string | null;
  ticket_tier: string;
  status: string;
  source: 'stripe_checkout' | 'stripe_invoice_offline';
  amount_subtotal: number;
  amount_total: number;
  amount_tax: number;
  amount_discount: number;
  amount_refunded: number;
  currency: string;
  customer_email: string | null;
  customer_name: string | null;
  internal_notes: string | null;
  created_at: string;
}

interface OrderAction {
  id: string;
  admin_email: string;
  action: string;
  payload: Record<string, unknown> | null;
  stripe_response: Record<string, unknown> | null;
  status: 'success' | 'failed';
  error_message: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-600',
  expired: 'bg-orange-100 text-orange-700',
  refunded: 'bg-purple-100 text-purple-700',
  partially_refunded: 'bg-fuchsia-100 text-fuchsia-700',
};

const STATUS_LABELS: Record<string, string> = {
  paid: '已付款', pending: '待處理', failed: '失敗', cancelled: '已取消',
  expired: '已過期', refunded: '已退款', partially_refunded: '部分退款',
};

const ACTION_LABELS: Record<string, string> = {
  refund: '退款', cancel: '取消', edit: '編輯顧客', resend_receipt: '重寄收據',
  note: '備註', manual_create: '手動建單',
};

function formatAmount(amount: number, currency: string) {
  return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

function formatDate(s: string) {
  return new Date(s).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Taipei',
  });
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [actions, setActions] = useState<OrderAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/orders/${params.id}`);
    if (res.ok) {
      const data = await res.json();
      setOrder(data.order);
      setActions(data.actions);
    } else if (res.status === 404) {
      router.replace('/admin/orders');
    }
    setLoading(false);
  }, [params.id, router]);

  useEffect(() => {
    load();
  }, [load]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // --- Customer edit ---
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const beginEdit = () => {
    if (!order) return;
    setEditName(order.customer_name ?? '');
    setEditEmail(order.customer_email ?? '');
    setEditing(true);
  };
  const saveEdit = async () => {
    const res = await fetch(`/api/admin/orders/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_name: editName, customer_email: editEmail }),
    });
    if (res.ok) {
      setEditing(false);
      showToast('已更新');
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(`失敗：${data.error ?? '未知錯誤'}`);
    }
  };

  // --- Refund modal ---
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundReason, setRefundReason] = useState<'requested_by_customer' | 'duplicate' | 'fraudulent'>('requested_by_customer');
  const [refundNote, setRefundNote] = useState('');
  const [refundConfirm, setRefundConfirm] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const openRefund = () => {
    if (!order) return;
    setRefundAmount(order.amount_total - order.amount_refunded);
    setRefundReason('requested_by_customer');
    setRefundNote('');
    setRefundConfirm('');
    setRefundOpen(true);
  };
  const submitRefund = async () => {
    setRefundSubmitting(true);
    const res = await fetch(`/api/admin/orders/${params.id}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: refundAmount, reason: refundReason, note: refundNote }),
    });
    setRefundSubmitting(false);
    if (res.ok) {
      setRefundOpen(false);
      showToast('已退款');
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(`退款失敗：${data.error ?? '未知錯誤'}`);
    }
  };

  // --- Cancel ---
  const doCancel = async () => {
    if (!confirm('確定取消此訂單？')) return;
    const res = await fetch(`/api/admin/orders/${params.id}/cancel`, { method: 'POST' });
    if (res.ok) { showToast('已取消'); load(); }
    else {
      const data = await res.json().catch(() => ({}));
      showToast(`失敗：${data.error ?? '未知錯誤'}`);
    }
  };

  // --- Resend receipt ---
  const doResend = async () => {
    const res = await fetch(`/api/admin/orders/${params.id}/resend-receipt`, { method: 'POST' });
    if (res.ok) showToast('收據已重寄');
    else {
      const data = await res.json().catch(() => ({}));
      showToast(`失敗：${data.error ?? '未知錯誤'}`);
    }
  };

  // --- Notes ---
  const [notes, setNotes] = useState('');
  useEffect(() => { if (order) setNotes(order.internal_notes ?? ''); }, [order]);
  const saveNotes = async () => {
    const res = await fetch(`/api/admin/orders/${params.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ internal_notes: notes }),
    });
    if (res.ok) { showToast('備註已儲存'); load(); }
    else {
      const data = await res.json().catch(() => ({}));
      showToast(`失敗：${data.error ?? '未知錯誤'}`);
    }
  };

  if (loading) return <div className="text-slate-500">載入中…</div>;
  if (!order) return <div className="text-slate-500">找不到訂單</div>;

  const canRefund = order.status === 'paid' || order.status === 'partially_refunded';
  const canCancel = order.status === 'pending';
  const canResend = (order.status === 'paid' || order.status === 'partially_refunded') && order.source === 'stripe_checkout';
  const remaining = order.amount_total - order.amount_refunded;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <a href="/admin/orders" className="text-sm text-slate-500 hover:text-slate-700">← 返回列表</a>
      </div>

      <h1 className="text-2xl font-bold text-slate-900">訂單 {order.id.slice(0, 8)}</h1>

      {/* Info card */}
      <div className="bg-white rounded-xl p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[order.status] ?? 'bg-slate-100'}`}>
            {STATUS_LABELS[order.status] ?? order.status}
          </span>
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
            {order.source === 'stripe_invoice_offline' ? '手動（線下付款）' : 'Stripe Checkout'}
          </span>
          <span className="text-sm text-slate-500 ml-auto">{formatDate(order.created_at)}</span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-slate-500">票種：</span><span className="text-slate-900">{order.ticket_tier}</span></div>
          <div><span className="text-slate-500">小計：</span><span className="text-slate-900 font-mono">{formatAmount(order.amount_subtotal, order.currency)}</span></div>
          <div><span className="text-slate-500">折扣：</span><span className="text-slate-900 font-mono">-{formatAmount(order.amount_discount, order.currency)}</span></div>
          <div><span className="text-slate-500">稅：</span><span className="text-slate-900 font-mono">{formatAmount(order.amount_tax, order.currency)}</span></div>
          <div><span className="text-slate-500">總計：</span><span className="text-slate-900 font-mono font-semibold">{formatAmount(order.amount_total, order.currency)}</span></div>
          <div><span className="text-slate-500">已退款：</span><span className="text-slate-900 font-mono">{formatAmount(order.amount_refunded, order.currency)}</span></div>
        </div>
        <div className="pt-3 border-t border-slate-100 text-xs space-y-1">
          {order.stripe_session_id && (
            <div><span className="text-slate-500">Session：</span><a className="font-mono text-[#10B8D9] hover:underline" href={`https://dashboard.stripe.com/test/payments/${order.stripe_payment_intent_id}`} target="_blank" rel="noreferrer">{order.stripe_session_id}</a></div>
          )}
          {order.stripe_payment_intent_id && (
            <div><span className="text-slate-500">PaymentIntent：</span><span className="font-mono text-slate-700">{order.stripe_payment_intent_id}</span></div>
          )}
          {order.stripe_invoice_id && (
            <div><span className="text-slate-500">Invoice：</span><span className="font-mono text-slate-700">{order.stripe_invoice_id}</span></div>
          )}
        </div>
      </div>

      {/* Customer card */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-900">顧客資訊</h2>
          {!editing ? (
            <button onClick={beginEdit} className="text-xs text-[#10B8D9] hover:underline">編輯</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={saveEdit} className="text-xs px-3 py-1 bg-[#10B8D9] text-white rounded">儲存</button>
              <button onClick={() => setEditing(false)} className="text-xs px-3 py-1 text-slate-600 border border-slate-300 rounded">取消</button>
            </div>
          )}
        </div>
        {!editing ? (
          <div className="space-y-1 text-sm">
            <div><span className="text-slate-500">姓名：</span><span className="text-slate-900">{order.customer_name ?? '-'}</span></div>
            <div><span className="text-slate-500">Email：</span><span className="text-slate-900">{order.customer_email ?? '-'}</span></div>
          </div>
        ) : (
          <div className="space-y-2">
            <input className="w-full px-3 py-2 border border-slate-300 rounded text-sm" placeholder="姓名" value={editName} onChange={(e) => setEditName(e.target.value)} />
            <input className="w-full px-3 py-2 border border-slate-300 rounded text-sm" placeholder="Email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
          </div>
        )}
      </div>

      {/* Actions card */}
      <div className="bg-white rounded-xl p-6 shadow-sm space-y-3">
        <h2 className="font-semibold text-slate-900">操作</h2>
        <div className="flex flex-wrap gap-2">
          {canRefund && <button onClick={openRefund} className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600">退款</button>}
          {canCancel && <button onClick={doCancel} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">取消訂單</button>}
          {canResend && <button onClick={doResend} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">重寄收據</button>}
        </div>
        <div className="pt-3 border-t border-slate-100">
          <label className="text-sm text-slate-700 font-medium">內部備註</label>
          <textarea className="w-full mt-2 px-3 py-2 border border-slate-300 rounded text-sm" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button onClick={saveNotes} className="mt-2 px-3 py-1 text-xs font-medium text-white bg-[#10B8D9] rounded">儲存備註</button>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-3">操作歷史</h2>
        {actions.length === 0 ? (
          <p className="text-sm text-slate-400">尚無記錄</p>
        ) : (
          <ul className="space-y-3">
            {actions.map((a) => (
              <li key={a.id} className="border-l-2 border-slate-200 pl-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-slate-900">{ACTION_LABELS[a.action] ?? a.action}</span>
                  <span className={`px-1.5 py-0.5 rounded ${a.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {a.status === 'success' ? '成功' : '失敗'}
                  </span>
                  <span className="text-slate-500">{a.admin_email}</span>
                  <span className="text-slate-400 ml-auto">{formatDate(a.created_at)}</span>
                </div>
                {a.error_message && <div className="mt-1 text-xs text-red-600">{a.error_message}</div>}
                {a.payload && <pre className="mt-1 text-xs text-slate-600 bg-slate-50 p-2 rounded overflow-x-auto">{JSON.stringify(a.payload, null, 2)}</pre>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Refund modal */}
      {refundOpen && order && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-3">
            <h3 className="font-semibold text-slate-900">退款</h3>
            {order.source === 'stripe_invoice_offline' && (
              <div className="text-xs bg-yellow-50 text-yellow-800 p-2 rounded">
                這是線下付款訂單，Stripe 沒有收款記錄。此操作只更新 DB — 請另外處理實際金流。
              </div>
            )}
            <label className="text-sm">
              金額（分）剩餘可退 {remaining}
              <input type="number" min={1} max={remaining} value={refundAmount}
                onChange={(e) => setRefundAmount(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded text-sm" />
            </label>
            <label className="text-sm">
              原因
              <select value={refundReason} onChange={(e) => setRefundReason(e.target.value as typeof refundReason)}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded text-sm">
                <option value="requested_by_customer">客戶要求</option>
                <option value="duplicate">重複付款</option>
                <option value="fraudulent">盜刷</option>
              </select>
            </label>
            <label className="text-sm">
              備註
              <textarea value={refundNote} onChange={(e) => setRefundNote(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded text-sm" rows={2} />
            </label>
            <label className="text-sm">
              輸入 <code className="text-red-600">REFUND</code> 確認
              <input value={refundConfirm} onChange={(e) => setRefundConfirm(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded text-sm" />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setRefundOpen(false)} className="px-3 py-1 text-sm text-slate-600 border border-slate-300 rounded">取消</button>
              <button onClick={submitRefund}
                disabled={refundConfirm !== 'REFUND' || refundSubmitting || refundAmount <= 0 || refundAmount > remaining}
                className="px-3 py-1 text-sm text-white bg-red-500 rounded disabled:opacity-50">
                {refundSubmitting ? '處理中…' : '確認退款'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Manual verification**

`npm run dev`, open `http://localhost:3000/admin/orders/<ORDER_ID>`. Verify: info card, customer edit (inline), refund modal with confirm gate, cancel/resend buttons conditional on status, notes save, timeline populates after each action.

- [ ] **Step 4: Commit**

```bash
git add app/admin/orders/\[id\]/page.tsx
git commit -m "feat(admin/ui): add order detail page with actions and timeline"
```

---

## Task 13: UI — manual create page

**Files:**
- Create: `app/admin/orders/new/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const TIERS = [
  { value: 'explore', label: 'Explore' },
  { value: 'contribute', label: 'Contribute' },
  { value: 'weekly_backer', label: 'Weekly Backer' },
  { value: 'backer', label: 'Backer' },
];

const WEEKS = [
  { value: 'week1', label: 'Week 1' },
  { value: 'week2', label: 'Week 2' },
  { value: 'week3', label: 'Week 3' },
  { value: 'week4', label: 'Week 4' },
];

export default function NewOrderPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [tier, setTier] = useState('explore');
  const [week, setWeek] = useState('week1');
  const [paymentReference, setPaymentReference] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const res = await fetch('/api/admin/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_email: email,
        customer_name: name,
        ticket_tier: tier,
        ...(tier === 'weekly_backer' ? { week } : {}),
        payment_reference: paymentReference,
        note,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      const data = await res.json();
      router.push(`/admin/orders/${data.order.id}`);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? '建立失敗');
    }
  };

  return (
    <div className="max-w-xl space-y-4">
      <a href="/admin/orders" className="text-sm text-slate-500 hover:text-slate-700">← 返回列表</a>
      <h1 className="text-2xl font-bold text-slate-900">手動建單</h1>
      <p className="text-sm text-slate-500">透過 Stripe Invoice 建立一筆線下付款的訂單（標記為 paid out of band）。</p>
      <form onSubmit={submit} className="bg-white rounded-xl p-6 shadow-sm space-y-3">
        <label className="block text-sm">
          Email<span className="text-red-500">*</span>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-slate-300 rounded text-sm" />
        </label>
        <label className="block text-sm">
          姓名<span className="text-red-500">*</span>
          <input required value={name} onChange={(e) => setName(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-slate-300 rounded text-sm" />
        </label>
        <label className="block text-sm">
          票種<span className="text-red-500">*</span>
          <select value={tier} onChange={(e) => setTier(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-slate-300 rounded text-sm">
            {TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        {tier === 'weekly_backer' && (
          <label className="block text-sm">
            週次<span className="text-red-500">*</span>
            <select value={week} onChange={(e) => setWeek(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-slate-300 rounded text-sm">
              {WEEKS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </label>
        )}
        <label className="block text-sm">
          付款參考（如銀行轉帳日期 / 末四碼）
          <input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-slate-300 rounded text-sm" />
        </label>
        <label className="block text-sm">
          備註
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
            className="w-full mt-1 px-3 py-2 border border-slate-300 rounded text-sm" />
        </label>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button type="submit" disabled={submitting}
          className="px-4 py-2 text-sm font-medium text-white bg-[#10B8D9] rounded-lg hover:bg-[#0EA5C4] disabled:opacity-50">
          {submitting ? '建立中…' : '建立訂單'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Manual verification**

Visit `/admin/orders/new`. Fill form, submit. Expected: redirect to new order's detail page with `source: 手動（線下付款）` badge, status `paid`. Verify Stripe Dashboard (test mode) shows the Invoice as paid out of band.

- [ ] **Step 4: Commit**

```bash
git add app/admin/orders/new/page.tsx
git commit -m "feat(admin/ui): add manual order creation page"
```

---

## Task 14: End-to-end sanity sweep

**Files:** none

- [ ] **Step 1: Lint + typecheck + build**

```bash
npm run lint && npx tsc --noEmit && npm run build
```
Expected: all clean.

- [ ] **Step 2: Browser smoke test**

Run `npm run dev`. From the admin orders list:
1. Click "手動建單" → create a manual order.
2. Open the new order → add a note, verify timeline.
3. Edit customer name/email inline → verify success toast + timeline entry.
4. From a Stripe-checkout paid order: refund partial → status → `partially_refunded`; refund again to full → status → `refunded`.
5. From a pending order (create one via normal checkout flow without paying): cancel → status → `cancelled`, verify Stripe session expired in Dashboard.
6. Resend receipt on a paid order → verify Stripe Dashboard sent receipt.

Log any failures; if none, proceed.

- [ ] **Step 3: Commit a final no-op tag (optional)**

If any small fixes emerged during smoke test, commit them individually with descriptive messages. Otherwise skip.

---

## Self-review (completed at plan-write time)

- **Spec coverage:** ✅ Data model (Task 1-2), lib (Task 3), webhook reconciliation (Task 4), all action APIs (Tasks 5-10), UI list updates (Task 11), detail page (Task 12), manual create page (Task 13), sanity (Task 14).
- **Placeholder scan:** no TBD / TODO / "similar to"; all code blocks present.
- **Type consistency:** `OrderActionError` used in all API routes; `Order` type extended once in Task 2 and reused; `refundOrder` / `cancelOrder` / `editOrder` / `resendReceipt` / `saveNote` / `createManualOrder` signatures match between lib and API routes.
- **Ambiguity:** Refund modal's `REFUND` confirm is enforced in UI only (server trusts admin session) — documented in spec and matches the decision during brainstorming.
