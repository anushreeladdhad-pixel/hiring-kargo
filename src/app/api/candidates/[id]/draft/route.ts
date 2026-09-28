import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Lets the founder edit the drafted subject/body before sending.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { subject, body } = await req.json();

    const { data: existing, error: fetchErr } = await supabaseAdmin()
      .from('email_drafts')
      .select('sent_at')
      .eq('candidate_id', params.id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if ((existing as { sent_at: string | null } | null)?.sent_at) {
      return NextResponse.json(
        { error: 'This email has already been sent and cannot be edited.' },
        { status: 409 }
      );
    }

    const { error } = await supabaseAdmin()
      .from('email_drafts')
      .update({
        subject,
        body,
        edited: true,
        updated_at: new Date().toISOString(),
      })
      .eq('candidate_id', params.id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
