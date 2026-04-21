export type AuditSource = 'order_action' | 'order_transfer' | 'visa_letter';
export type ActorType = 'admin' | 'user' | 'system';

export type UnifiedEvent = {
  id: string;
  at: string;
  source: AuditSource;
  actor: string;
  actorType: ActorType;
  action: string;
  resourceType: 'order' | 'visa_letter';
  resourceId: string;
  resourceLabel: string;
  resourceLink: string | null;
  status: 'success' | 'failed' | null;
  summary: string;
  payload: unknown;
};

export type OrderActionRow = {
  id: string;
  order_id: string;
  admin_email: string;
  action: string;
  payload: unknown;
  stripe_response: unknown;
  status: 'success' | 'failed';
  error_message: string | null;
  created_at: string;
};

export type OrderTransferRow = {
  id: string;
  order_id: string;
  parent_transfer_id: string | null;
  from_email: string;
  to_email: string;
  initiated_by: 'user' | 'admin';
  actor_user_id: string | null;
  actor_admin_email: string | null;
  ip_address: string | null;
  user_agent: string | null;
  notes: string | null;
  transferred_at: string;
};

export type VisaLetterIssuanceRow = {
  id: number;
  member_id: number;
  document_no: string;
  letter_type: string;
  has_paid_order: boolean;
  order_snapshot: unknown;
  profile_snapshot: unknown;
  pdf_checksum: string | null;
  issued_by: string;
  issued_at: string;
};

export function normalizeOrderAction(row: OrderActionRow): UnifiedEvent {
  const short = row.order_id.slice(0, 8);
  return {
    id: `oa:${row.id}`,
    at: row.created_at,
    source: 'order_action',
    actor: row.admin_email,
    actorType: 'admin',
    action: row.action,
    resourceType: 'order',
    resourceId: row.order_id,
    resourceLabel: `#${short}`,
    resourceLink: `/admin/orders/${row.order_id}`,
    status: row.status,
    summary: buildOrderActionSummary(row),
    payload: row,
  };
}

function buildOrderActionSummary(row: OrderActionRow): string {
  const base = `${row.admin_email} 對訂單 ${row.order_id.slice(0, 8)} 執行 ${row.action}`;
  if (row.status === 'failed') {
    return `${base}（失敗${row.error_message ? `：${row.error_message}` : ''}）`;
  }
  return base;
}

export function normalizeOrderTransfer(row: OrderTransferRow): UnifiedEvent {
  const isAdmin = row.initiated_by === 'admin';
  const actor = isAdmin
    ? (row.actor_admin_email ?? 'unknown-admin')
    : row.from_email;
  const short = row.order_id.slice(0, 8);
  return {
    id: `ot:${row.id}`,
    at: row.transferred_at,
    source: 'order_transfer',
    actor,
    actorType: isAdmin ? 'admin' : 'user',
    action: 'transfer',
    resourceType: 'order',
    resourceId: row.order_id,
    resourceLabel: `#${short}`,
    resourceLink: `/admin/orders/${row.order_id}`,
    status: 'success',
    summary: `${actor} 將訂單 ${short} 從 ${row.from_email} 轉讓給 ${row.to_email}`,
    payload: row,
  };
}

export function normalizeVisaLetterIssuance(row: VisaLetterIssuanceRow): UnifiedEvent {
  const isSystem = row.issued_by === 'system';
  return {
    id: `vl:${row.id}`,
    at: row.issued_at,
    source: 'visa_letter',
    actor: row.issued_by,
    actorType: isSystem ? 'system' : 'admin',
    action: 'visa_issue',
    resourceType: 'visa_letter',
    resourceId: row.document_no,
    resourceLabel: row.document_no,
    resourceLink: null,
    status: 'success',
    summary: `${row.issued_by} 為 member #${row.member_id} 開立簽證信 ${row.document_no}`,
    payload: row,
  };
}

export function mergeAndSort(events: UnifiedEvent[]): UnifiedEvent[] {
  return [...events].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
