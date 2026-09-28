import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { extractCvText } from '@/lib/parseCv';
import { extractPii } from '@/lib/pii';
import { runPipelineForCandidate } from '@/lib/pipeline';
import type { Role } from '@/lib/types';

// CV parsing + a full scoring/brief/draft pass can take a while — give it
// room on Vercel (requires a plan that supports >10s functions; drop this
// or lower it if you're on the Hobby plan and hit the ceiling).
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const roleApplied = form.get('role_applied') as Role | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }
    if (roleApplied !== 'PM' && roleApplied !== 'SPM') {
      return NextResponse.json(
        { error: 'role_applied must be "PM" or "SPM".' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rawText = await extractCvText(buffer, file.name);

    if (!rawText || rawText.trim().length < 50) {
      return NextResponse.json(
        { error: 'Could not extract readable text from this file.' },
        { status: 422 }
      );
    }

    const { fullName, email, phone, sanitizedText } = extractPii(rawText, file.name);

    if (!email) {
      return NextResponse.json(
        {
          error:
            'No email address found in the CV. Personal details must include an email so the founder can be reached back — please check the file.',
        },
        { status: 422 }
      );
    }

    const { data: candidate, error: insertErr } = await supabaseAdmin()
      .from('candidates')
      .insert({
        role_applied: roleApplied,
        full_name: fullName || 'Unknown Candidate',
        email,
        phone,
        cv_filename: file.name,
        cv_text: sanitizedText,
        status: 'uploaded',
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    const candidateId = (candidate as { id: string }).id;

    // Run the full pipeline (score both rubrics -> shortlist -> brief ->
    // draft) before responding, so the dashboard shows a finished row.
    await runPipelineForCandidate(candidateId);

    return NextResponse.json({ ok: true, candidate_id: candidateId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Upload/pipeline error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
