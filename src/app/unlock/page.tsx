'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function UnlockForm() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const params = useSearchParams();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, next: params.get('next') || '/' }),
    });
    if (!res.ok) {
      setError('Wrong code.');
      return;
    }
    const { next } = await res.json();
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <input
        type="password"
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="border border-line rounded-md px-3 py-2 text-sm"
        placeholder="Access code"
      />
      {error && <p className="text-sm text-bad">{error}</p>}
      <button
        type="submit"
        className="bg-ink text-white rounded-md px-3 py-2 text-sm font-medium"
      >
        Continue
      </button>
    </form>
  );
}

export default function UnlockPage() {
  return (
    <main className="mx-auto max-w-sm mt-24 px-4">
      <h1 className="text-lg font-semibold text-ink mb-1">Kargo Hiring</h1>
      <p className="text-sm text-muted mb-6">Enter the access code to continue.</p>
      <Suspense fallback={null}>
        <UnlockForm />
      </Suspense>
    </main>
  );
}
