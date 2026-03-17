import { useState } from 'react';
import { InfoIcon } from '../components/InfoIcon';

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
  onBackToLogin: () => void;
};

export function ForgotPassword({ onBackToLogin }: Props) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Request failed.');
        return;
      }
      setSent(true);
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div style={formStyle}>
        <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem', textAlign: 'center' }}>Check your email</h2>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1rem' }}>
          If an account exists with that email, we sent a password reset link. Check your inbox and spam folder.
        </p>
        <button type="button" onClick={onBackToLogin} style={{ ...linkStyle, background: 'none', border: 'none', padding: 0 }}>
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem', textAlign: 'center' }}>Forgot password</h2>
      <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
        Enter your email and we’ll send you a link to reset your password.
        <InfoIcon text="We'll email you a secure link (valid for 1 hour) to set a new password. Check spam if you don't see it. We never reveal whether an account exists." placement="below" />
      </p>
      <label style={labelStyle}>Email</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
        style={inputStyle}
        autoComplete="email"
      />
      {error && <p style={{ color: '#f87171', fontSize: '0.875rem', marginBottom: '0.5rem' }}>{error}</p>}
      <button type="submit" disabled={loading} style={primaryButton}>
        {loading ? '…' : 'Send reset link'}
      </button>
      <button type="button" onClick={onBackToLogin} style={{ ...linkStyle, background: 'none', border: 'none', padding: 0 }}>
        Back to sign in
      </button>
    </form>
  );
}
