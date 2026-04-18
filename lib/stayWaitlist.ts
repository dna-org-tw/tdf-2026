import { supabaseServer } from '@/lib/supabaseServer';
import { isStayBookable } from '@/lib/stayTime';
import { getStayWeekByCode, getNextWaitlistPosition } from '@/lib/stayQueries';

export async function joinStayWaitlist(input: { weekCode: string; memberId: number }) {
  if (!supabaseServer) throw new Error('db_not_configured');

  const week = await getStayWeekByCode(input.weekCode);
  if (!week) throw new Error('week_not_found');
  if (!isStayBookable(week.starts_on)) throw new Error('booking_closed');

  const nextPosition = await getNextWaitlistPosition(week.id);
  const { data, error } = await supabaseServer
    .from('stay_waitlist_entries')
    .insert({
      week_id: week.id,
      member_id: input.memberId,
      status: 'active',
      position: nextPosition,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function leaveStayWaitlist(entryId: string, memberId: number) {
  if (!supabaseServer) throw new Error('db_not_configured');

  const { error } = await supabaseServer
    .from('stay_waitlist_entries')
    .update({ status: 'removed', updated_at: new Date().toISOString() })
    .eq('id', entryId)
    .eq('member_id', memberId);
  if (error) throw error;
}
