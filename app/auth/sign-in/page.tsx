'use client';

import { useState } from 'react';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');

  async function requestMagicLink(event: React.FormEvent) {
    event.preventDefault();

    const res = await fetch('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await res.json();
    if (res.ok) {
      setStatus(data.message);
    } else {
      setStatus('Unable to request magic link');
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-6">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="text-sm text-slate-300">Email magic link scaffold (placeholder, no delivery provider configured).</p>
      <form className="space-y-3" onSubmit={requestMagicLink}>
        <input
          className="w-full rounded bg-slate-800 p-2"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          required
        />
        <button className="w-full rounded bg-cyan-500 px-4 py-2 font-semibold text-slate-950" type="submit">
          Request magic link
        </button>
      </form>
      <p className="text-sm text-cyan-300">{status}</p>
    </div>
  );
}
