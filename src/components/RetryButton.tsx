'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RetryButton({ candidateId }: { candidateId: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function retry() {
    setBusy(true);
    await fetch(`/api/candidates/${candidateId}/process`, { method: 'POST' });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={retry}
      disabled={busy}
      className="border border-bad text-bad rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-40"
    >
      {busy ? 'Retrying…' : 'Retry pipeline'}
    </button>
  );
}
