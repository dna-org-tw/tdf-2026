export type SyncJobStatus = 'queued' | 'running' | 'succeeded' | 'partial' | 'failed' | 'cancelled';
export type SyncJobPhase = 'syncing' | 'reviewing' | 'done';
export type SyncEventStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface SyncJob {
  id: number;
  trigger: 'manual' | 'cron';
  status: SyncJobStatus;
  phase: SyncJobPhase;
  started_at: string | null;
  finished_at: string | null;
  total_events: number;
  processed_events: number;
  failed_events: number;
  total_guests_upserted: number;
  total_guests_removed: number;
  error_summary: string | null;
  triggered_by: string | null;
  cancel_requested_at: string | null;
  created_at: string;
  review_approved: number;
  review_declined: number;
  review_waitlisted: number;
  review_skipped: number;
}

export interface SyncEventResult {
  id: number;
  job_id: number;
  event_api_id: string;
  event_name: string | null;
  status: SyncEventStatus;
  guests_count: number;
  guests_removed: number;
  review_approved: number;
  review_waitlisted: number;
  review_skipped: number;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface SyncConfigPublic {
  cookieLast4: string | null;
  cookieInvalid: boolean;
  cronEnabled: boolean;
  cronSchedule: string;
  lastManualRunAt: string | null;
  updatedAt: string;
  updatedBy: string | null;
  hasCookie: boolean;
}

export interface Registration {
  eventApiId: string;
  eventName: string;
  startAt: string | null;
  endAt: string | null;
  url: string | null;
  activityStatus: string | null;
  paid: boolean;
  checkedInAt: string | null;
  registeredAt: string | null;
  ticketTypeName: string | null;
  amountCents: number | null;
  currency: string | null;
  stale: boolean;
  reviewReason: string | null;
}
