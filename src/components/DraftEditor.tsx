'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DraftEditor({
  candidateId,
  emailType,
  initialSubject,
  initialBody,
  sentAt,
}: {
  candidateId: string;
  emailType: 'invite' | 'reject';
  initialSubject: string;
  initialBody: string;
  sentAt: string | null;
}) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const router = useRouter();

  const locked = !!sentAt;

  async function save() {
    setSaving(true);
    setError('');
    setSavedNote('');
    const res = await fetch(`/api/candidates/${candidateId}/draft`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, body }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error || 'Could not save.');
      return;
    }
    setSavedNote('Saved.');
  }

  async function send() {
    if (!confirm('Send this email now? This cannot be undone.')) return;
    setSending(true);
    setError('');
    const res = await fetch(`/api/candidates/${candidateId}/send`, { method: 'POST' });
    setSending(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error || 'Could not send.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="border border-line rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-ink text-sm">
          {emailType === 'invite' ? 'Interview invite' : 'Rejection'} email
        </h3>
        {locked && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-good">
            sent {new Date(sentAt!).toLocaleString()}
          </span>
        )}
      </div>

      <label className="block text-xs font-medium text-muted mb-1">Subject</label>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        disabled={locked}
        className="w-full border border-line rounded-md px-3 py-2 text-sm mb-3 disabled:opacity-60"
      />

      <label className="block text-xs font-medium text-muted mb-1">Body</label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={locked}
        rows={8}
        className="w-full border border-line rounded-md px-3 py-2 text-sm mb-3 disabled:opacity-60"
      />

      {error && <p className="text-sm text-bad mb-2">{error}</p>}
      {savedNote && !error && <p className="text-sm text-good mb-2">{savedNote}</p>}

      {!locked && (
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="border border-line rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save edits'}
          </button>
          <button
            onClick={send}
            disabled={sending}
            className="bg-ink text-white rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-40"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      )}
    </div>
  );
}
