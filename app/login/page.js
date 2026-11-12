'use client';
import { useState } from 'react';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) window.location.href = '/';
    else {
      setError((await res.json().catch(() => ({}))).error || 'Login failed');
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form onSubmit={submit} className="card login-card">
        <div className="logo">£</div>
        <h1>Expenses</h1>
        <input
          type="password"
          autoFocus
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy || !password}>
          {busy ? 'Opening…' : 'Open'}
        </button>
      </form>
    </main>
  );
}
