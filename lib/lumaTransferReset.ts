import { supabaseServer } from '@/lib/supabaseServer';
import { getDecryptedCookie } from '@/lib/lumaSyncConfig';
import { updateGuestStatus, LumaAuthError } from '@/lib/lumaApi';

type GuestRow = {
  id: number;
  event_api_id: string;
  email: string;
  member_id: number | null;
  luma_guest_api_id: string | null;
  activity_status: string | null;
};

export interface LumaResetResult {
  attempted: number;
  updated: number;
  failed: number;
  skippedNoCookie: boolean;
}

/**
 * After a ticket transfer, the old email no longer has a paid ticket. Push
 * their currently-approved (or pending/waitlist) Luma registrations back to
 * `waitlist` — the Luma API accepts approved | declined | waitlist, and
 * `waitlist` is the closest non-destructive equivalent of "pending" that we
 * can express. The next Luma sync's auto-review will re-judge based on the
 * new (no-paid-ticket) membership state.
 *
 * Graceful degradation: if the Luma cookie is absent or invalid, we still
 * clear `luma_guests.paid` locally so the next sync re-evaluates; we log
 * but don't fail the caller.
 */
export async function resetLumaApprovalsForTransferredEmail(
  email: string,
): Promise<LumaResetResult> {
  const result: LumaResetResult = { attempted: 0, updated: 0, failed: 0, skippedNoCookie: false };
  if (!supabaseServer) return result;

  const normalizedEmail = email.trim().toLowerCase();

  const cookie = await getDecryptedCookie().catch(() => null);
  if (!cookie) {
    result.skippedNoCookie = true;
    console.warn('[lumaTransferReset] No Luma cookie configured; skipping remote reset');
    return result;
  }

  const { data, error } = await supabaseServer
    .from('luma_guests')
    .select('id, event_api_id, email, member_id, luma_guest_api_id, activity_status')
    .eq('email', normalizedEmail)
    .in('activity_status', ['approved', 'pending_approval', 'waitlist']);

  if (error) {
    console.error('[lumaTransferReset] Failed to list luma_guests:', error);
    return result;
  }

  const guests = (data ?? []) as GuestRow[];
  result.attempted = guests.length;
  if (guests.length === 0) return result;

  const targetStatus = 'waitlist' as const;

  for (const g of guests) {
    if (!g.luma_guest_api_id) {
      result.failed += 1;
      continue;
    }
    try {
      await updateGuestStatus(cookie, g.event_api_id, g.luma_guest_api_id, targetStatus);

      await supabaseServer
        .from('luma_guests')
        .update({ activity_status: targetStatus })
        .eq('id', g.id);

      await supabaseServer.from('luma_review_log').insert({
        job_id: null,
        event_api_id: g.event_api_id,
        email: normalizedEmail,
        member_id: g.member_id,
        luma_guest_api_id: g.luma_guest_api_id,
        previous_status: g.activity_status,
        new_status: targetStatus,
        reason: 'waitlist:ticket_transferred',
        consumed_no_show_event_api_id: null,
      });

      result.updated += 1;
    } catch (err) {
      if (err instanceof LumaAuthError) {
        console.error('[lumaTransferReset] Luma auth failed; aborting remaining updates');
        result.failed += guests.length - (result.updated + result.failed);
        break;
      }
      console.error(`[lumaTransferReset] Failed to reset guest ${g.luma_guest_api_id}:`, err);
      result.failed += 1;
    }
  }

  return result;
}
