export type SyncJobStatus = 'queued' | 'running' | 'succeeded' | 'partial' | 'failed';
export type SyncEventStatus = 'pending' | 'running' | 'done' | 'failed';

export interface SyncJob {
  id: number;
  trigger: 'manual' | 'cron';
  status: SyncJobStatus;
  started_at: string | null;
  finished_at: string | null;
  total_events: number;
  processed_events: number;
  failed_events: number;
  total_guests_upserted: number;
  error_summary: string | null;
  triggered_by: string | null;
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
