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
  amount?: number;
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
  amount_cents?: number;
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

  const hasCustomAmount = typeof input.amount_cents === 'number';
  if (hasCustomAmount && (!Number.isInteger(input.amount_cents) || input.amount_cents! < 0)) {
    throw new OrderActionError('amount_cents must be a non-negative integer');
  }
  const priceId = PRICE_IDS[input.ticket_tier];
  if (!hasCustomAmount && !priceId) {
    throw new OrderActionError(`No price configured for ${input.ticket_tier}`);
  }

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
      ...(hasCustomAmount
        ? { amount: input.amount_cents!, currency: 'usd' }
        : { pricing: { price: priceId! } }),
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
    // Zero-amount invoices (and those brought to $0 by a 100%-off coupon) are
    // auto-paid by Stripe at finalize time, so calling .pay() again would throw
    // `invoice_not_open` / "Invoice is already paid".
    invoice = finalized.status === 'paid'
      ? finalized
      : await s.invoices.pay(finalized.id, { paid_out_of_band: true });
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
      amount_tax: invoice.total_taxes?.reduce((s, t) => s + (t.amount ?? 0), 0) ?? 0,
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

// ---------- Upgrade ----------

export interface UpgradeOrderInput {
  target_tier: Order['ticket_tier'];
  target_week?: 'week1' | 'week2' | 'week3' | 'week4';
  mode: 'comp' | 'invoice';
  amount_cents?: number;
  description?: string;
  note?: string;
}

export interface UpgradeOrderResult {
  order: Order;
  hosted_invoice_url: string | null;
}

export async function upgradeOrder(
  orderId: string,
  input: UpgradeOrderInput,
  adminEmail: string,
): Promise<UpgradeOrderResult> {
  if (!supabaseServer) throw new OrderActionError('DB not configured', undefined, 500);

  const parent = await getOrder(orderId);

  if (parent.parent_order_id) {
    throw new OrderActionError('Cannot upgrade an upgrade order; upgrade the original instead');
  }
  if (parent.status !== 'paid' && parent.status !== 'partially_refunded') {
    throw new OrderActionError(`Cannot upgrade order with status ${parent.status}`);
  }
  if (!parent.customer_email) {
    throw new OrderActionError('Original order has no customer email');
  }
  if (input.target_tier === 'weekly_backer' && !input.target_week) {
    throw new OrderActionError('target_week required for weekly_backer');
  }
  if (input.mode === 'invoice' && (input.amount_cents == null || input.amount_cents <= 0)) {
    throw new OrderActionError('amount_cents > 0 required for invoice mode');
  }

  const amount = input.mode === 'comp' ? 0 : input.amount_cents!;
  const currency = parent.currency || 'usd';
  const description =
    input.description?.trim() ||
    `Upgrade: ${parent.ticket_tier} → ${input.target_tier}${input.target_week ? ` (${input.target_week})` : ''}`;

  const s = requireStripe();

  let customer: Stripe.Customer;
  let invoice: Stripe.Invoice;
  try {
    const existing = await s.customers.list({ email: parent.customer_email, limit: 1 });
    customer = existing.data[0] ?? await s.customers.create({
      email: parent.customer_email,
      name: parent.customer_name ?? undefined,
    });

    await s.invoiceItems.create({
      customer: customer.id,
      currency,
      amount,
      description,
    });

    const draft = await s.invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: 0,
      metadata: {
        admin_email: adminEmail,
        source: 'upgrade',
        parent_order_id: parent.id,
        from_tier: parent.ticket_tier,
        to_tier: input.target_tier,
        ...(input.target_week ? { week: input.target_week } : {}),
        mode: input.mode,
        note: input.note ?? '',
      },
    });
    if (!draft.id) throw new OrderActionError('Invoice has no ID');

    const finalized = await s.invoices.finalizeInvoice(draft.id);
    if (!finalized.id) throw new OrderActionError('Finalized invoice has no ID');

    if (input.mode === 'comp') {
      invoice = finalized.status === 'paid'
        ? finalized
        : await s.invoices.pay(finalized.id, { paid_out_of_band: true });
    } else {
      invoice = finalized;
    }
  } catch (err) {
    const stripeErr = err as Stripe.errors.StripeError;
    await writeAction(parent.id, adminEmail, 'upgrade', { ...input }, null, 'failed', stripeErr.message);
    throw new OrderActionError(stripeErr.message, stripeErr.code, 400);
  }

  const isPaid = input.mode === 'comp' || invoice.status === 'paid';
  const hostedInvoiceUrl = invoice.hosted_invoice_url ?? null;

  const { data: created, error: createErr } = await supabaseServer
    .from('orders')
    .insert({
      stripe_session_id: null,
      stripe_invoice_id: invoice.id,
      ticket_tier: input.target_tier,
      status: isPaid ? 'paid' : 'pending',
      source: 'stripe_invoice_upgrade',
      amount_subtotal: invoice.subtotal ?? amount,
      amount_total: invoice.total ?? amount,
      amount_tax: invoice.total_taxes?.reduce((sum, t) => sum + (t.amount ?? 0), 0) ?? 0,
      amount_discount: 0,
      currency: invoice.currency ?? currency,
      customer_email: parent.customer_email,
      customer_name: parent.customer_name,
      parent_order_id: parent.id,
      internal_notes: input.note ?? null,
    })
    .select()
    .single();
  if (createErr || !created) throw new OrderActionError(createErr?.message ?? 'Insert failed', undefined, 500);

  await writeAction(
    parent.id,
    adminEmail,
    'upgrade',
    { ...input, upgrade_order_id: created.id },
    { invoice_id: invoice.id, customer_id: customer.id, hosted_invoice_url: hostedInvoiceUrl, status: invoice.status },
    'success',
  );

  return { order: created as Order, hosted_invoice_url: hostedInvoiceUrl };
}
