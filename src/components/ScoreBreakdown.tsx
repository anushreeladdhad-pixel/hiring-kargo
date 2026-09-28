import type { CandidateScore, Role } from '@/lib/types';

export default function ScoreBreakdown({
  role,
  scores,
  total,
  highlight,
}: {
  role: Role;
  scores: CandidateScore[];
  total: number | null;
  highlight: boolean;
}) {
  return (
    <div
      className={`border rounded-lg p-4 ${
        highlight ? 'border-ink' : 'border-line'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-ink text-sm">
          {role === 'PM' ? 'Product Manager rubric' : 'Senior Product Manager rubric'}
        </h3>
        <span className="text-sm font-semibold text-ink">
          {total != null ? total.toFixed(1) : '—'} / 100
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {scores.map((s) => (
          <div key={s.criterion_name} className="text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-ink">{s.criterion_name}</span>
              <span className="text-muted">
                {s.score}/5 · {s.weight}%
              </span>
            </div>
            <p className="text-muted">{s.reason}</p>
          </div>
        ))}
        {scores.length === 0 && (
          <p className="text-sm text-muted">Not scored yet.</p>
        )}
      </div>
    </div>
  );
}
