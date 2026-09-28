import { supabaseAdmin } from './supabaseAdmin';
import { generateJson, generateText } from './gemini';
import { getRubric, getJdText } from './rubric';
import type { Candidate, CandidateScore, Role, RubricCriterion } from './types';

// ───────────────────────────────────────────────────────────────────────
// Step 1: score a candidate against one rubric (PM or SPM).
// Every candidate is scored against BOTH rubrics regardless of the role
// they applied for — this gives the founder a comparison point (e.g. an
// SPM applicant who actually scores best on the PM bar).
// ───────────────────────────────────────────────────────────────────────

interface RawScoreItem {
  criterion_name: string;
  score: number;
  reason: string;
}

function buildScoringPrompt(cvText: string, criteria: RubricCriterion[]): string {
  const criteriaBlock = criteria
    .map(
      (c, i) => `
${i + 1}. ${c.name} (weight ${c.weight}%)
   What a strong candidate looks like: ${c.description}
   Score 5: ${c.anchor_5}
   Score 3: ${c.anchor_3}
   Score 1: ${c.anchor_1}`
    )
    .join('\n');

  return `You are scoring a job candidate's CV against a fixed hiring rubric.

RULES
- Score ONLY what is explicitly written in the CV text below.
- Do not infer intent, motivation, or things the CV doesn't state.
- Do not give credit for years of experience, job titles, or seniority
  language on its own — score the specific behavior described.
- Use whole-number scores 1-5. Use 2 or 4 for evidence that falls between
  the anchors given for 1/3/5.
- "reason" must be one sentence (max 25 words) citing the specific line or
  fact from the CV that drove the score.

RUBRIC CRITERIA
${criteriaBlock}

CANDIDATE CV TEXT (personal details already removed)
"""
${cvText}
"""

Return ONLY a JSON array with exactly ${criteria.length} objects, one per
criterion, in the same order as listed above, in this exact shape:
[{"criterion_name": string, "score": number, "reason": string}, ...]`;
}

export async function scoreCandidateAgainstRubric(
  candidateId: string,
  cvText: string,
  rubricRole: Role
): Promise<CandidateScore[]> {
  const criteria = await getRubric(rubricRole);
  const prompt = buildScoringPrompt(cvText, criteria);
  const raw = await generateJson<RawScoreItem[]>(prompt);

  const byName = new Map(criteria.map((c) => [c.name, c]));
  const rows = raw.map((item) => {
    const criterion = byName.get(item.criterion_name);
    if (!criterion) {
      throw new Error(
        `Gemini returned unknown criterion "${item.criterion_name}" for ${rubricRole}`
      );
    }
    const score = Math.max(1, Math.min(5, Math.round(item.score)));
    const weighted_points = Number(((score / 5) * criterion.weight).toFixed(3));
    return {
      candidate_id: candidateId,
      rubric_role: rubricRole,
      criterion_name: criterion.name,
      weight: criterion.weight,
      score,
      reason: item.reason,
      weighted_points,
    };
  });

  const { error } = await supabaseAdmin()
    .from('candidate_scores')
    .upsert(rows, { onConflict: 'candidate_id,rubric_role,criterion_name' });
  if (error) throw error;

  return rows as unknown as CandidateScore[];
}

export async function scoreCandidateBothRubrics(candidate: Candidate) {
  await Promise.all([
    scoreCandidateAgainstRubric(candidate.id, candidate.cv_text, 'PM'),
    scoreCandidateAgainstRubric(candidate.id, candidate.cv_text, 'SPM'),
  ]);
}

export async function getTotal(candidateId: string, rubricRole: Role): Promise<number> {
  const { data, error } = await supabaseAdmin()
    .from('candidate_totals')
    .select('total_score')
    .eq('candidate_id', candidateId)
    .eq('rubric_role', rubricRole)
    .maybeSingle();
  if (error) throw error;
  return (data as { total_score: number } | null)?.total_score ?? 0;
}

// ───────────────────────────────────────────────────────────────────────
// Step 2: recompute the shortlist for a role (relative ranking, not a
// fixed threshold) and keep briefs/drafts in sync with who's currently
// above the line. Candidates who have already been emailed are never
// touched again, even if the ranking shifts under them later.
// ───────────────────────────────────────────────────────────────────────

async function getShortlistSize(role: Role): Promise<number> {
  const key = role === 'PM' ? 'shortlist_size_pm' : 'shortlist_size_spm';
  const { data, error } = await supabaseAdmin()
    .from('settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  const value = (data as { value: number } | null)?.value;
  return typeof value === 'number' ? value : 5;
}

export async function recomputeShortlist(role: Role): Promise<void> {
  const size = await getShortlistSize(role);

  const { data: candidates, error } = await supabaseAdmin()
    .from('candidates')
    .select('id, status, shortlisted')
    .eq('role_applied', role)
    .in('status', ['scored', 'briefing', 'drafting', 'ready_for_review', 'sent']);
  if (error) throw error;
  if (!candidates || candidates.length === 0) return;

  const withTotals = await Promise.all(
    (candidates as Array<{ id: string; status: string; shortlisted: boolean }>).map(
      async (c) => ({ ...c, total: await getTotal(c.id, role) })
    )
  );

  withTotals.sort((a, b) => b.total - a.total);
  const shortlistIds = new Set(withTotals.slice(0, size).map((c) => c.id));

  for (const c of withTotals) {
    const shouldBeShortlisted = shortlistIds.has(c.id);
    if (shouldBeShortlisted === c.shortlisted) continue;

    // Already sent? Leave it exactly as it was communicated — don't
    // retroactively contradict an email that already went out.
    if (c.status === 'sent') continue;

    await supabaseAdmin()
      .from('candidates')
      .update({ shortlisted: shouldBeShortlisted, updated_at: new Date().toISOString() })
      .eq('id', c.id);

    // Ranking moved — clear any stale brief/draft so the next pipeline
    // pass regenerates the correct one (invite vs reject).
    await supabaseAdmin().from('briefs').delete().eq('candidate_id', c.id);
    await supabaseAdmin().from('email_drafts').delete().eq('candidate_id', c.id);
  }
}

// ───────────────────────────────────────────────────────────────────────
// Step 3: three-sentence interview brief (shortlisted candidates only).
// ───────────────────────────────────────────────────────────────────────

export async function generateBrief(candidate: Candidate): Promise<string> {
  const jdText = await getJdText(candidate.role_applied);
  const scores = await getScores(candidate.id, candidate.role_applied);

  const scoreSummary = scores
    .map((s) => `- ${s.criterion_name}: ${s.score}/5 — ${s.reason}`)
    .join('\n');

  const prompt = `Write a 3-sentence interview brief for a founder who is about
to interview this candidate for the ${roleLabel(candidate.role_applied)} role.
He has 45 minutes between meetings — be concrete, not generic.

Sentence 1: who this candidate is, in CV terms (what they've actually done).
Sentence 2: why the system ranked them here — reference the strongest 1-2
rubric scores below, specifically.
Sentence 3: the single most important thing to probe or verify if he moves
forward with them, grounded in a gap or unproven claim in their CV.

Do not use the candidate's name — refer to them as "this candidate" or "they".

RUBRIC SCORES (${candidate.role_applied})
${scoreSummary}

ROLE CONTEXT (for probe ideas only — do not use this to score)
${jdText ?? '(not provided)'}

CANDIDATE CV TEXT (personal details already removed)
"""
${candidate.cv_text}
"""

Return plain text only: exactly 3 sentences, no bullets, no preamble.`;

  const briefText = await generateText(prompt);

  const { error } = await supabaseAdmin()
    .from('briefs')
    .upsert({ candidate_id: candidate.id, brief_text: briefText }, { onConflict: 'candidate_id' });
  if (error) throw error;

  return briefText;
}

async function getScores(candidateId: string, rubricRole: Role): Promise<CandidateScore[]> {
  const { data, error } = await supabaseAdmin()
    .from('candidate_scores')
    .select('*')
    .eq('candidate_id', candidateId)
    .eq('rubric_role', rubricRole);
  if (error) throw error;
  return (data ?? []) as unknown as CandidateScore[];
}

function roleLabel(role: Role) {
  return role === 'PM' ? 'Product Manager' : 'Senior Product Manager';
}

// ───────────────────────────────────────────────────────────────────────
// Step 4: personalised email draft — invite (shortlisted) or warm
// rejection (not shortlisted). Gemini never sees the candidate's real
// name: it writes to a "[NAME]" placeholder, which is substituted with
// the real name (pulled from the private candidates row, not from any
// AI output) after generation.
// ───────────────────────────────────────────────────────────────────────

export async function generateEmailDraft(candidate: Candidate): Promise<void> {
  const type = candidate.shortlisted ? 'invite' : 'reject';

  let prompt: string;
  if (type === 'invite') {
    const brief = await supabaseAdmin()
      .from('briefs')
      .select('brief_text')
      .eq('candidate_id', candidate.id)
      .maybeSingle();

    prompt = `Draft a short, warm interview-invite email from a founder named
Arjun to a job candidate for the ${roleLabel(candidate.role_applied)} role at
Kargo, a Series A logistics SaaS company.

Address the candidate as "[NAME]" (a literal placeholder — do not invent a
name). Reference one specific, real thing from their CV below so it reads as
genuinely read, not templated. Keep it under 120 words. Sign off as "Arjun".

Interview brief context (why they're being invited):
${(brief.data as { brief_text: string } | null)?.brief_text ?? ''}

CANDIDATE CV TEXT (personal details already removed)
"""
${candidate.cv_text}
"""

Return ONLY a JSON object: {"subject": string, "body": string}`;
  } else {
    prompt = `Draft a short, warm, respectful rejection email from a founder
named Arjun to a job candidate who applied for the
${roleLabel(candidate.role_applied)} role at Kargo, a Series A logistics SaaS
company.

Address the candidate as "[NAME]" (a literal placeholder — do not invent a
name). Reference one specific, genuine thing from their CV below so it does
not read as a form rejection. Do not give false hope of a future role unless
warranted. Keep it under 100 words. Sign off as "Arjun".

CANDIDATE CV TEXT (personal details already removed)
"""
${candidate.cv_text}
"""

Return ONLY a JSON object: {"subject": string, "body": string}`;
  }

  const draft = await generateJson<{ subject: string; body: string }>(prompt);

  const subject = draft.subject.replace(/\[NAME\]/g, candidate.full_name);
  const body = draft.body.replace(/\[NAME\]/g, candidate.full_name);

  const { error } = await supabaseAdmin().from('email_drafts').upsert(
    {
      candidate_id: candidate.id,
      email_type: type,
      subject,
      body,
      edited: false,
    },
    { onConflict: 'candidate_id' }
  );
  if (error) throw error;
}

// ───────────────────────────────────────────────────────────────────────
// Orchestration: run the full pipeline for one newly uploaded candidate.
// ───────────────────────────────────────────────────────────────────────

export async function runPipelineForCandidate(candidateId: string): Promise<void> {
  const admin = supabaseAdmin();

  const setStatus = (status: string, error: string | null = null) =>
    admin
      .from('candidates')
      .update({ status, error, updated_at: new Date().toISOString() })
      .eq('id', candidateId);

  try {
    const { data: candidateRow, error: fetchErr } = await admin
      .from('candidates')
      .select('*')
      .eq('id', candidateId)
      .single();
    if (fetchErr) throw fetchErr;
    const candidate = candidateRow as unknown as Candidate;

    await setStatus('scoring');
    await scoreCandidateBothRubrics(candidate);
    await setStatus('scored');

    // Re-rank the whole cohort for the role this candidate applied to —
    // a new entrant can bump someone else off the shortlist.
    await recomputeShortlist(candidate.role_applied);

    // Re-fetch: recomputeShortlist may have just updated this candidate's
    // own `shortlisted` flag.
    const { data: refreshedRow, error: refetchErr } = await admin
      .from('candidates')
      .select('*')
      .eq('id', candidateId)
      .single();
    if (refetchErr) throw refetchErr;
    const refreshed = refreshedRow as unknown as Candidate;

    if (refreshed.shortlisted) {
      await setStatus('briefing');
      await generateBrief(refreshed);
    }

    await setStatus('drafting');
    await generateEmailDraft(refreshed);

    // Backfill drafts/briefs for anyone else in the same role whose
    // shortlist status just changed because of this new candidate.
    await syncCohortDrafts(refreshed.role_applied);

    await setStatus('ready_for_review');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setStatus('uploaded', message);
    throw err;
  }
}

/**
 * After recomputeShortlist() may have flipped other candidates' shortlist
 * flag and cleared their brief/draft, regenerate whatever is missing for
 * anyone in this role cohort who has already been scored.
 */
async function syncCohortDrafts(role: Role): Promise<void> {
  const admin = supabaseAdmin();
  const { data: rows, error } = await admin
    .from('candidates')
    .select('*')
    .eq('role_applied', role)
    .in('status', ['scored', 'briefing', 'drafting', 'ready_for_review']);
  if (error) throw error;

  for (const row of (rows ?? []) as unknown as Candidate[]) {
    const { data: existingDraft } = await admin
      .from('email_drafts')
      .select('id')
      .eq('candidate_id', row.id)
      .maybeSingle();
    if (existingDraft) continue;

    if (row.shortlisted) {
      const { data: existingBrief } = await admin
        .from('briefs')
        .select('candidate_id')
        .eq('candidate_id', row.id)
        .maybeSingle();
      if (!existingBrief) await generateBrief(row);
    }
    await generateEmailDraft(row);
    await admin
      .from('candidates')
      .update({ status: 'ready_for_review', updated_at: new Date().toISOString() })
      .eq('id', row.id);
  }
}
