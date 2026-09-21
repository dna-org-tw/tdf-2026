import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { getSessionFromRequest } from '@/lib/auth';
import {
  enforceVisaLetterRateLimit,
  formatIssueDate,
  getMemberByEmail,
  getPaidOrdersForEmail,
  getVisaProfile,
  pickBestPaidOrder,
  sha256,
  validateVisaProfileInput,
} from '@/lib/memberVisa';
import { renderVisaLetterPdf } from '@/lib/visaLetter';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    const member = await getMemberByEmail(session.email);
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

    await enforceVisaLetterRateLimit(member.member_no);

    const profile = await getVisaProfile(member.id);
    if (!profile) {
      return NextResponse.json({ error: 'Visa profile not found' }, { status: 400 });
    }
    const parsed = validateVisaProfileInput(profile);
    if (!parsed.data) {
      return NextResponse.json({ error: parsed.error ?? 'Invalid saved visa profile' }, { status: 400 });
    }

    const paidOrder = pickBestPaidOrder(await getPaidOrdersForEmail(member.email));

    const { data: issuance, error: insertError } = await supabaseServer
      .from('visa_letter_issuances')
      .insert({
        member_id: member.id,
        has_paid_order: !!paidOrder,
        order_snapshot: paidOrder,
        profile_snapshot: profile,
      })
      .select('id, document_no, issued_at')
      .single();
    if (insertError || !issuance) throw insertError ?? new Error('Failed to create issuance row');

    try {
      const pdfBuffer = await renderVisaLetterPdf({
        documentNo: issuance.document_no,
        issueDate: formatIssueDate(issuance.issued_at),
        destinationMission: parsed.data.destination_mission,
        profile: parsed.data,
        paidOrder,
      });

      const checksum = sha256(pdfBuffer);
      const { error: updateError } = await supabaseServer
        .from('visa_letter_issuances')
        .update({ pdf_checksum: checksum })
        .eq('id', issuance.id);
      if (updateError) throw updateError;

      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename=\"tdf-visa-support-letter-${issuance.document_no}.pdf\"`,
          'Cache-Control': 'no-store',
        },
      });
    } catch (renderError) {
      await supabaseServer.from('visa_letter_issuances').delete().eq('id', issuance.id);
      throw renderError;
    }
  } catch (error) {
    const retryAfter = (error as Error & { retryAfter?: number }).retryAfter;
    if (retryAfter) {
      return NextResponse.json({ error: 'Too many download attempts', retryAfter }, { status: 429 });
    }
    console.error('[Visa Letter POST]', error);
    return NextResponse.json({ error: 'Failed to generate visa letter' }, { status: 500 });
  }
}
