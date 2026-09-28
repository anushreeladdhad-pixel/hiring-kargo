'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function UploadPage() {
  const [role, setRole] = useState<'PM' | 'SPM'>('PM');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError('');
    setDone(false);

    const form = new FormData();
    form.append('file', file);
    form.append('role_applied', role);

    const res = await fetch('/api/upload', { method: 'POST', body: form });
    const json = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(json.error || 'Upload failed.');
      return;
    }

    setDone(true);
    setFile(null);
    router.push(`/candidates/${json.candidate_id}`);
  }

  return (
    <main className="max-w-lg">
      <h1 className="text-lg font-semibold text-ink mb-1">Upload a CV</h1>
      <p className="text-sm text-muted mb-6">
        Personal details are separated on upload and never sent to the scoring
        model. Scoring, the interview brief, and an email draft run
        automatically once you submit.
      </p>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1">
            Role applied for
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'PM' | 'SPM')}
            className="border border-line rounded-md px-3 py-2 text-sm w-full"
          >
            <option value="PM">Product Manager</option>
            <option value="SPM">Senior Product Manager</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">CV file</label>
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </div>

        {error && <p className="text-sm text-bad">{error}</p>}

        <button
          type="submit"
          disabled={!file || busy}
          className="bg-ink text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-40 w-fit"
        >
          {busy ? 'Processing (scoring + brief + draft)…' : 'Upload & Process'}
        </button>

        {done && (
          <p className="text-sm text-good">Done — redirecting to the candidate…</p>
        )}
      </form>
    </main>
  );
}
