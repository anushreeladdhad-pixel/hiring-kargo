import { NextRequest, NextResponse } from 'next/server';
import { runPipelineForCandidate } from '@/lib/pipeline';

export const maxDuration = 60;

// Manual retry — used by the dashboard's "Retry" button on a candidate
// whose pipeline run previously errored out (see candidates.error).
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await runPipelineForCandidate(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
