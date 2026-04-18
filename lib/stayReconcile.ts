import { supabaseServer } from '@/lib/supabaseServer';
import { getWeekOccupancy, getPendingWaitlistHoldCount } from '@/lib/stayQueries';
import { sendStayEmail } from '@/lib/stayEmail';

function requireSupabase() {
  if (!supabaseServer) throw new Error('db_not_configured');
  return supabaseServer;
}

export async function expirePendingTransfers() {
  const sb = requireSupabase();
  const now = new Date().toISOString();

  const { data: expired, error } = await sb
    .from('stay_transfers')
    .update({ status: 'expired' })
    .eq('status', 'pending_acceptance')
    .lt('expires_at', now)
    .select('booking_week_id');
  if (error) throw error;

  const ids = (expired ?? []).map((row) => row.booking_week_id);
  if (ids.length === 0) return { expired: 0 };

  const { error: revertErr } = await sb
    .from('stay_booking_weeks')
    .update({ status: 'confirmed', hold_expires_at: null })
    .in('id', ids)
    .eq('status', 'pending_transfer');
  if (revertErr) throw revertErr;

  return { expired: ids.length };
}

export async function expireOfferedWaitlistEntries() {
  const sb = requireSupabase();
  const now = new Date().toISOString();

  const { data, error } = await sb
    .from('stay_waitlist_entries')
    .update({ status: 'expired' })
    .eq('status', 'offered')
    .lt('offer_expires_at', now)
    .select('id');
  if (error) throw error;

  return { expired: (data ?? []).length };
}

export async function issueNextWaitlistOffers() {
  const sb = requireSupabase();

  const { data: weeks, error: weeksErr } = await sb
    .from('stay_weeks')
    .select('id, code, starts_on, room_capacity, waitlist_offer_expires_in_minutes')
    .eq('status', 'active');
  if (weeksErr) throw weeksErr;

  let issued = 0;

  for (const week of weeks ?? []) {
    const [occupancy, holds] = await Promise.all([
      getWeekOccupancy(week.id),
      getPendingWaitlistHoldCount(week.id),
    ]);
    const free = week.room_capacity - occupancy - holds;
    if (free <= 0) continue;

    const { data: candidates, error: candErr } = await sb
      .from('stay_waitlist_entries')
      .select('id, member_id, position, members:member_id(email)')
      .eq('week_id', week.id)
      .eq('status', 'active')
      .order('position', { ascending: true })
      .limit(free);
    if (candErr) throw candErr;
    if (!candidates || candidates.length === 0) continue;

    const offerExpiresAt = new Date(
      Date.now() + (week.waitlist_offer_expires_in_minutes ?? 120) * 60 * 1000,
    ).toISOString();

    for (const candidate of candidates) {
      const { error: offerErr } = await sb
        .from('stay_waitlist_entries')
        .update({
          status: 'offered',
          offered_at: new Date().toISOString(),
          offer_expires_at: offerExpiresAt,
        })
        .eq('id', candidate.id);
      if (offerErr) throw offerErr;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const email = (candidate as any).members?.email;
      if (email && process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
        try {
          await sendStayEmail({
            to: email,
            subject: `Your stay waitlist offer for ${week.code}`,
            html: `<p>A room is available for week ${week.code} (starts ${week.starts_on}). Offer expires at ${offerExpiresAt}.</p>`,
            text: `A room is available for week ${week.code} (starts ${week.starts_on}). Offer expires at ${offerExpiresAt}.`,
            emailType: 'stay_waitlist_offer',
          });
        } catch (err) {
          console.error('[stay] waitlist offer email failed', err);
        }
      }
      issued += 1;
    }
  }

  return { issued };
}

export async function runStayReconcile() {
  const transfers = await expirePendingTransfers();
  const waitlist = await expireOfferedWaitlistEntries();
  const offers = await issueNextWaitlistOffers();
  return { transfers, waitlist, offers };
}
