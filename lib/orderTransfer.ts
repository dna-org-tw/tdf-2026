import { supabaseServer } from './supabaseServer';
import type { Order } from './types/order';
import {
  sendOrderTransferredFromEmail,
  sendOrderTransferredToEmail,
} from './sendOrderTransferEmail';

export class OrderTransferError extends Error {
  constructor(
    message: string,
    public httpStatus: number = 400,
    public code?: string,
  ) {
    super(message);
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEADLINE_KEY = 'order_transfer_deadline';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function getTransferDeadline(): Promise<Date | null> {
  if (!supabaseServer) return null;
  const { data } = await supabaseServer
    .from('app_settings')
    .select('value')
    .eq('key', DEADLINE_KEY)
    .maybeSingle();
  if (!data?.value) return null;
  const d = new Date(data.value as string);
  return isNaN(d.getTime()) ? null : d;
}

export async function getTransferDeadlineRaw(): Promise<string | null> {
  if (!supabaseServer) return null;
  const { data } = await supabaseServer
    .from('app_settings')
    .select('value')
    .eq('key', DEADLINE_KEY)
    .maybeSingle();
  return (data?.value as string | undefined) ?? null;
}

export async function setTransferDeadline(iso: string, adminEmail: string): Promise<string> {
  if (!supabaseServer) throw new OrderTransferError('DB not configured', 500);
  const parsed = new Date(iso);
  if (isNaN(parsed.getTime())) throw new OrderTransferError('Invalid ISO 8601 timestamp');
  const value = parsed.toISOString();
  const { error } = await supabaseServer
    .from('app_settings')
    .upsert(
      {
        key: DEADLINE_KEY,
        value,
        updated_by: adminEmail,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    );
  if (error) throw new OrderTransferError(error.message, 500);
  return value;
}

export interface TransferInput {
  orderId: string;
  newEmail: string;
  initiator: 'user' | 'admin';
  actorUserId?: string | null;
  actorAdminEmail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  notes?: string | null;
  sessionEmail?: string | null;
}

export interface TransferResult {
  parent: Order;
  children: Order[];
  fromEmail: string;
  toEmail: string;
  transferredAt: string;
  transferId: string | null;
  deadlinePassed: boolean;
}

async function getOrder(orderId: string): Promise<Order> {
  if (!supabaseServer) throw new OrderTransferError('DB not configured', 500);
  const { data, error } = await supabaseServer
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();
  if (error || !data) throw new OrderTransferError('Order not found', 404);
  return data as Order;
}

async function getChildren(parentId: string): Promise<Order[]> {
  if (!supabaseServer) return [];
  const { data } = await supabaseServer
    .from('orders')
    .select('*')
    .eq('parent_order_id', parentId);
  return (data ?? []) as Order[];
}

export async function transferOrder(input: TransferInput): Promise<TransferResult> {
  if (!supabaseServer) throw new OrderTransferError('DB not configured', 500);

  const newEmail = normalizeEmail(input.newEmail);
  if (!EMAIL_REGEX.test(newEmail)) {
    throw new OrderTransferError('Invalid email format');
  }

  const parent = await getOrder(input.orderId);
  if (parent.parent_order_id) {
    throw new OrderTransferError(
      'Child (upgrade) orders cannot be transferred alone. Transfer the parent order — its upgrade follows automatically.',
    );
  }
  if (parent.status !== 'paid') {
    throw new OrderTransferError(
      `Only paid orders can be transferred (current status: ${parent.status}).`,
    );
  }
  if (!parent.customer_email) {
    throw new OrderTransferError('Order has no customer email');
  }

  const fromEmail = normalizeEmail(parent.customer_email);
  if (fromEmail === newEmail) {
    throw new OrderTransferError('New email must be different from the current owner.');
  }

  let deadlinePassed = false;
  if (input.initiator === 'user') {
    if (!input.sessionEmail || normalizeEmail(input.sessionEmail) !== fromEmail) {
      throw new OrderTransferError('You can only transfer your own orders.', 403);
    }
    const deadline = await getTransferDeadline();
    if (deadline && Date.now() > deadline.getTime()) {
      throw new OrderTransferError(
        `Self-service transfer closed as of ${deadline.toISOString()}. Please contact support.`,
        403,
      );
    }
  } else if (input.initiator === 'admin') {
    const deadline = await getTransferDeadline();
    deadlinePassed = !!deadline && Date.now() > deadline.getTime();
  }

  const children = await getChildren(parent.id);
  for (const child of children) {
    if (child.status !== 'paid') {
      throw new OrderTransferError(
        `Cannot transfer: upgrade order ${child.id.slice(0, 8)} has status '${child.status}' — resolve it first (must be paid).`,
      );
    }
  }

  const now = new Date().toISOString();
  const appendNote = (prev: string | null) => {
    const entry = `[${now}] Transferred ${fromEmail} → ${newEmail} (${input.initiator})`;
    return prev && prev.length > 0 ? `${prev}\n${entry}` : entry;
  };

  // 1. Update parent order email + note
  const { data: updatedParentRaw, error: parentErr } = await supabaseServer
    .from('orders')
    .update({
      customer_email: newEmail,
      internal_notes: appendNote(parent.internal_notes),
    })
    .eq('id', parent.id)
    .select()
    .single();
  if (parentErr || !updatedParentRaw) {
    throw new OrderTransferError(parentErr?.message ?? 'Failed to update parent order', 500);
  }
  const updatedParent = updatedParentRaw as Order;

  // 2. Update each child order
  const updatedChildren: Order[] = [];
  for (const child of children) {
    const { data: updChild, error: childErr } = await supabaseServer
      .from('orders')
      .update({
        customer_email: newEmail,
        internal_notes: appendNote(child.internal_notes),
      })
      .eq('id', child.id)
      .select()
      .single();
    if (childErr || !updChild) {
      console.error(`[transferOrder] Failed to update child ${child.id}:`, childErr);
      continue;
    }
    updatedChildren.push(updChild as Order);
  }

  // 3. Insert parent order_transfers row
  const { data: parentTransfer, error: tErr } = await supabaseServer
    .from('order_transfers')
    .insert({
      order_id: parent.id,
      parent_transfer_id: null,
      from_email: fromEmail,
      to_email: newEmail,
      initiated_by: input.initiator,
      actor_user_id: input.actorUserId ?? null,
      actor_admin_email: input.actorAdminEmail ?? null,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (tErr) console.error('[transferOrder] Failed to log parent transfer:', tErr);

  // 4. Insert child order_transfers rows (linked to parent transfer)
  if (parentTransfer) {
    for (const child of updatedChildren) {
      const { error: cTErr } = await supabaseServer.from('order_transfers').insert({
        order_id: child.id,
        parent_transfer_id: parentTransfer.id,
        from_email: fromEmail,
        to_email: newEmail,
        initiated_by: input.initiator,
        actor_user_id: input.actorUserId ?? null,
        actor_admin_email: input.actorAdminEmail ?? null,
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
        notes: null,
      });
      if (cTErr) console.error(`[transferOrder] Failed to log child transfer ${child.id}:`, cTErr);
    }
  }

  // 5. Admin audit: also log to order_actions so it shows in the admin timeline
  if (input.initiator === 'admin' && input.actorAdminEmail) {
    await supabaseServer.from('order_actions').insert({
      order_id: parent.id,
      admin_email: input.actorAdminEmail,
      action: 'transfer',
      payload: {
        from_email: fromEmail,
        to_email: newEmail,
        child_order_ids: updatedChildren.map((c) => c.id),
        notes: input.notes ?? null,
        transfer_id: parentTransfer?.id ?? null,
        deadline_passed: deadlinePassed,
      },
      stripe_response: null,
      status: 'success',
    });
  }

  // 6. Invalidate Luma guest paid status for the old email so the next sync re-judges
  const { error: lumaErr } = await supabaseServer
    .from('luma_guests')
    .update({ paid: false })
    .eq('email', fromEmail);
  if (lumaErr) console.error('[transferOrder] Failed to reset luma_guests:', lumaErr);

  // 7. Fire notification emails (logged inside, errors swallowed so the transfer itself is not rolled back)
  await sendOrderTransferredFromEmail(fromEmail, updatedParent, newEmail).catch((err) =>
    console.error('[transferOrder] from-email send failed:', err),
  );
  await sendOrderTransferredToEmail(newEmail, updatedParent, fromEmail).catch((err) =>
    console.error('[transferOrder] to-email send failed:', err),
  );

  return {
    parent: updatedParent,
    children: updatedChildren,
    fromEmail,
    toEmail: newEmail,
    transferredAt: now,
    transferId: parentTransfer?.id ?? null,
    deadlinePassed,
  };
}

/**
 * Pre-flight check: is a given order eligible for user-initiated self-service transfer?
 * Returns { canTransfer, reasonCode } — reasons align with UI messaging.
 */
export interface TransferEligibility {
  canTransfer: boolean;
  reasonCode:
    | 'ok'
    | 'not_paid'
    | 'is_child_order'
    | 'no_email'
    | 'deadline_passed'
    | 'pending_child';
  deadline: string | null;
}

export async function checkUserTransferEligibility(
  order: Pick<Order, 'id' | 'status' | 'parent_order_id' | 'customer_email'>,
): Promise<TransferEligibility> {
  const deadline = await getTransferDeadlineRaw();
  if (order.parent_order_id) {
    return { canTransfer: false, reasonCode: 'is_child_order', deadline };
  }
  if (order.status !== 'paid') {
    return { canTransfer: false, reasonCode: 'not_paid', deadline };
  }
  if (!order.customer_email) {
    return { canTransfer: false, reasonCode: 'no_email', deadline };
  }
  if (deadline) {
    const d = new Date(deadline);
    if (!isNaN(d.getTime()) && Date.now() > d.getTime()) {
      return { canTransfer: false, reasonCode: 'deadline_passed', deadline };
    }
  }
  if (supabaseServer) {
    const { data: children } = await supabaseServer
      .from('orders')
      .select('id, status')
      .eq('parent_order_id', order.id);
    if ((children ?? []).some((c) => c.status !== 'paid')) {
      return { canTransfer: false, reasonCode: 'pending_child', deadline };
    }
  }
  return { canTransfer: true, reasonCode: 'ok', deadline };
}
