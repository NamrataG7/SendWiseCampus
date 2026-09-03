'use client';

import { useState } from 'react';

/**
 * Aggregate-first drill-down request form.
 *
 * Submits {reason, target_user_id_hash} to /api/drill-down-requests.
 * The backing table is `drill_down_requests` in Supabase; actual approval
 * is a dual-control (co-approval) flow — implemented by Supabase co-approval — Lane C.
 */
export default function DrillDownRequestForm() {
  const [reason, setReason] = useState('');
  const [targetHash, setTargetHash] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'ok' | 'error'>(
    'idle',
  );
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanHash = targetHash.trim().toLowerCase();
    const cleanReason = reason.trim();

    if (!/^[a-f0-9]{64}$/.test(cleanHash)) {
      setError('Target student hash must be 64 hex characters (SHA-256).');
      return;
    }
    if (cleanReason.length < 10) {
      setError('Please provide a reason of at least 10 characters.');
      return;
    }

    setStatus('submitting');
    try {
      const res = await fetch('/api/drill-down-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: cleanReason,
          target_user_id_hash: cleanHash,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body?.error || 'Failed to submit request.');
        setStatus('error');
        return;
      }
      const body = (await res.json()) as { id?: string };
      setRequestId(body.id ?? null);
      setStatus('ok');
      setReason('');
      setTargetHash('');
    } catch {
      setError('Network error. Please try again.');
      setStatus('error');
    }
  }

  if (status === 'ok') {
    return (
      <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-4 py-3">
        Drill-down request submitted{requestId ? ` (id: ${requestId})` : ''}.
        Awaiting co-approval from a second wellbeing-team member.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="target_hash"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Target student hash
        </label>
        <input
          id="target_hash"
          type="text"
          value={targetHash}
          onChange={(e) => setTargetHash(e.target.value)}
          required
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6C3FE1] focus:border-transparent"
          placeholder="64-character SHA-256 hash"
        />
      </div>

      <div>
        <label
          htmlFor="reason"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Reason for drill-down
        </label>
        <textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          rows={3}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6C3FE1] focus:border-transparent"
          placeholder="Describe the wellbeing concern that justifies per-student review."
        />
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="rounded-lg bg-[#6C3FE1] hover:bg-[#5b34c7] disabled:bg-[#a58ce8] text-white text-sm font-semibold px-4 py-2.5 transition-colors"
      >
        {status === 'submitting' ? 'Submitting…' : 'Request drill-down'}
      </button>
    </form>
  );
}
