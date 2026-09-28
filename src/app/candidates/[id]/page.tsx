import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import ScoreBreakdown from '@/components/ScoreBreakdown';
import DraftEditor from '@/components/DraftEditor';
import RetryButton from '@/components/RetryButton';
import type { Candidate, CandidateScore, EmailDraft, Role } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function getData(id: string) {
  const admin = supabaseAdmin();

  const { data: candidate } = await admin
    .from('candidates')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!candidate) return null;
  const c = candidate as unknown as Candidate;

  const [pmScores, spmScores, pmTotal, spmTotal, brief, draft] = await Promise.all([
    admin.from('candidate_scores').select('*').eq('candidate_id', id).eq('rubric_role', 'PM'),
    admin.from('candidate_scores').select('*').eq('candidate_id', id).eq('rubric_role', 'SPM'),
    admin.from('candidate_totals').select('total_score').eq('candidate_id', id).eq('rubric_role', 'PM').maybeSingle(),
    admin.from('candidate_totals').select('total_score').eq('candidate_id', id).eq('rubric_role', 'SPM').maybeSingle(),
    admin.from('briefs').select('brief_text').eq('candidate_id', id).maybeSingle(),
    admin.from('email_drafts').select('*').eq('candidate_id', id).maybeSingle(),
  ]);

  return {
    candidate: c,
    pmScores: (pmScores.data ?? []) as unknown as CandidateScore[],
    spmScores: (spmScores.data ?? []) as unknown as CandidateScore[],
    pmTotal: (pmTotal.data as { total_score: number } | null)?.total_score ?? null,
    spmTotal: (spmTotal.data as { total_score: number } | null)?.total_score ?? null,
    brief: (brief.data as { brief_text: string } | null)?.brief_text ?? null,
    draft: (draft.data as unknown as EmailDraft | null) ?? null,
  };
}

export default async function CandidatePage({ params }: { params: { id: string } }) {
  const data = await getData(params.id);
  if (!data) notFound();

  const { candidate, pmScores, spmScores, pmTotal, spmTotal, brief, draft } = data;
  const appliedRole: Role = candidate.role_applied;

  return (
    <main className="max-w-3xl">
      <Link href={`/?role=${appliedRole}`} className="text-sm text-muted underline">
        ← Back to {appliedRole} candidates
      </Link>

      <div className="flex items-start justify-between mt-3 mb-1">
        <h1 className="text-xl font-semibold text-ink">{candidate.full_name}</h1>
        {candidate.shortlisted && (
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-good">
            Shortlisted for {appliedRole}
          </span>
        )}
      </div>
      <p className="text-sm text-muted mb-1">
        Applied for: {appliedRole === 'PM' ? 'Product Manager' : 'Senior Product Manager'} ·{' '}
        {candidate.cv_filename}
      </p>
      <p className="text-sm text-muted mb-6">
        {candidate.email}
        {candidate.phone ? ` · ${candidate.phone}` : ''}
      </p>

      {candidate.error && (
        <div className="border border-bad/30 bg-red-50 rounded-lg p-4 mb-6 text-sm">
          <p className="text-bad font-medium mb-2">Pipeline error: {candidate.error}</p>
          <RetryButton candidateId={candidate.id} />
        </div>
      )}

      {brief && (
        <div className="border border-line rounded-lg p-4 mb-6">
          <h3 className="font-medium text-ink text-sm mb-2">Interview brief</h3>
          <p className="text-sm text-ink">{brief}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <ScoreBreakdown
          role="PM"
          scores={pmScores}
          total={pmTotal}
          highlight={appliedRole === 'PM'}
        />
        <ScoreBreakdown
          role="SPM"
          scores={spmScores}
          total={spmTotal}
          highlight={appliedRole === 'SPM'}
        />
      </div>

      {draft ? (
        <DraftEditor
          candidateId={candidate.id}
          emailType={draft.email_type}
          initialSubject={draft.subject}
          initialBody={draft.body}
          sentAt={draft.sent_at}
        />
      ) : (
        <p className="text-sm text-muted">No email draft yet — still processing.</p>
      )}
    </main>
  );
}
