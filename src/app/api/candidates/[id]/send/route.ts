import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/resend';

// The one button the founder clicks. Nothing goes out until this fires.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = supabaseAdmin();

    const { data: candidate, error: candErr } = await admin
      .from('candidates')
      .select('id, email, status')
      .eq('id', params.id)
      .single();
    if (candErr) throw candErr;
    const c = candidate as { id: string; email: string; status: string };

    const { data: draft, error: draftErr } = await admin
      .from('email_drafts')
      .select('*')
      .eq('candidate_id', params.id)
      .single();
    if (draftErr) throw draftErr;
    const d = draft as { subject: string; body: string; sent_at: string | null };

    if (d.sent_at) {
      return NextResponse.json({ error: 'Already sent.' }, { status: 409 });
    }

    const messageId = await sendEmail({
      to: c.email,
      subject: d.subject,
      body: d.body,
    });

    const now = new Date().toISOString();
    await admin
      .from('email_drafts')
      .update({ sent_at: now, resend_message_id: messageId })
      .eq('candidate_id', params.id);
    await admin
      .from('candidates')
      .update({ status: 'sent', updated_at: now })
      .eq('id', params.id);

    return NextResponse.json({ ok: true, resend_message_id: messageId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
