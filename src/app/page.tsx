import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { Candidate, Role } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function getCandidatesWithTotals(role: Role) {
  const admin = supabaseAdmin();
  const { data: candidates, error } = await admin
    .from('candidates')
    .select('*')
    .eq('role_applied', role)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rows = (candidates ?? []) as unknown as Candidate[];

  const totals = await Promise.all(
    rows.map(async (c) => {
      const [own, other] = await Promise.all([
        admin
          .from('candidate_totals')
          .select('total_score')
          .eq('candidate_id', c.id)
          .eq('rubric_role', role)
          .maybeSingle(),
        admin
          .from('candidate_totals')
          .select('total_score')
          .eq('candidate_id', c.id)
          .eq('rubric_role', role === 'PM' ? 'SPM' : 'PM')
          .maybeSingle(),
      ]);
      return {
        candidate: c,
        ownScore: (own.data as { total_score: number } | null)?.total_score ?? null,
        otherScore: (other.data as { total_score: number } | null)?.total_score ?? null,
      };
    })
  );

  totals.sort((a, b) => (b.ownScore ?? -1) - (a.ownScore ?? -1));
  return totals;
}

function StatusBadge({ status, error }: { status: string; error: string | null }) {
  if (error) {
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-bad">
        error
      </span>
    );
  }
  const map: Record<string, string> = {
    uploaded: 'bg-gray-100 text-muted',
    scoring: 'bg-yellow-100 text-warn',
    scored: 'bg-yellow-100 text-warn',
    briefing: 'bg-yellow-100 text-warn',
    drafting: 'bg-yellow-100 text-warn',
    ready_for_review: 'bg-blue-100 text-blue-700',
    sent: 'bg-green-100 text-good',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] || ''}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { role?: string };
}) {
  const role: Role = searchParams.role === 'SPM' ? 'SPM' : 'PM';
  const rows = await getCandidatesWithTotals(role);

  return (
    <main>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-ink">Candidates</h1>
        <Link
          href="/upload"
          className="bg-ink text-white rounded-md px-3 py-1.5 text-sm font-medium"
        >
          Upload CV
        </Link>
      </div>

      <div className="flex gap-2 mb-4 border-b border-line">
        {(['PM', 'SPM'] as Role[]).map((r) => (
          <Link
            key={r}
            href={`/?role=${r}`}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              role === r ? 'border-ink text-ink' : 'border-transparent text-muted'
            }`}
          >
            {r === 'PM' ? 'Product Manager' : 'Senior Product Manager'}
          </Link>
        ))}
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-muted border-b border-line">
            <th className="py-2 pr-4">#</th>
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Score ({role})</th>
            <th className="py-2 pr-4">Score ({role === 'PM' ? 'SPM' : 'PM'})</th>
            <th className="py-2 pr-4">Shortlisted</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4" />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ candidate, ownScore, otherScore }, i) => (
            <tr key={candidate.id} className="border-b border-line last:border-0">
              <td className="py-2 pr-4 text-muted">{i + 1}</td>
              <td className="py-2 pr-4 font-medium text-ink">{candidate.full_name}</td>
              <td className="py-2 pr-4">{ownScore != null ? ownScore.toFixed(1) : '—'}</td>
              <td className="py-2 pr-4 text-muted">
                {otherScore != null ? otherScore.toFixed(1) : '—'}
              </td>
              <td className="py-2 pr-4">
                {candidate.shortlisted ? (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-good">
                    yes
                  </span>
                ) : (
                  <span className="text-xs text-muted">no</span>
                )}
              </td>
              <td className="py-2 pr-4">
                <StatusBadge status={candidate.status} error={candidate.error} />
              </td>
              <td className="py-2 pr-4">
                <Link href={`/candidates/${candidate.id}`} className="text-sm underline">
                  Open
                </Link>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="py-8 text-center text-muted">
                No candidates yet for this role.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
