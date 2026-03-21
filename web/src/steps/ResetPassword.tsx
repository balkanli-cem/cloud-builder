import { useState } from 'react';
import { errorMessageFromApi } from '../rateLimitMessage';

const formStyle: React.CSSProperties = {
  maxWidth: '20rem',
  margin: '0 auto',
  background: '#1e293b',
  padding: '1.5rem',
  borderRadius: '8px',
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '6px',
  color: '#e2e8f0',
  fontSize: '0.875rem',
  marginBottom: '0.5rem',
  boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '0.25rem',
  fontSize: '0.875rem',
  color: '#94a3b8',
};
const primaryButton: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 1rem',
  background: '#3b82f6',
  border: 'none',
  borderRadius: '6px',
  color: 'white',
  fontWeight: 600,
  cursor: 'pointer',
  marginTop: '0.5rem',
};
const linkStyle: React.CSSProperties = {
  color: '#60a5fa',
  cursor: 'pointer',
  fontSize: '0.875rem',
  marginTop: '0.75rem',
  display: 'inline-block',
};

type Props = {
  token: string;
  onSuccess: () => void;
  onBackToLogin: () => void;
};

export function ResetPassword({ token, onSuccess, onBackToLogin }: Props) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(errorMessageFromApi(res, data, 'Reset failed.'));
        return;
      }
      setDone(true);
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div style={formStyle}>
        <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem', textAlign: 'center' }}>Password updated</h2>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1rem' }}>
          You can sign in with your new password.
        </p>
        <button type="button" onClick={onSuccess} style={primaryButton}>
          Sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem', textAlign: 'center' }}>Set new password</h2>
      <label style={labelStyle}>New password</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        required
        minLength={8}
        style={inputStyle}
        autoComplete="new-password"
      />
      <label style={labelStyle}>Confirm password</label>
      <input
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="••••••••"
        required
        minLength={8}
        style={inputStyle}
        autoComplete="new-password"
      />
      {error && <p style={{ color: '#f87171', fontSize: '0.875rem', marginBottom: '0.5rem' }}>{error}</p>}
      <button type="submit" disabled={loading} style={primaryButton}>
        {loading ? '…' : 'Update password'}
      </button>
      <button type="button" onClick={onBackToLogin} style={{ ...linkStyle, background: 'none', border: 'none', padding: 0 }}>
        Back to sign in
      </button>
    </form>
  );
}
