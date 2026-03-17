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
  onRegistered: () => void;
  onGoLogin: () => void;
};

export function Register({ onRegistered, onGoLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          displayName: displayName.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Registration failed.');
        return;
      }
      onRegistered();
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      <h2 style={{ fontSize: '1.125rem', marginBottom: '0.25rem', textAlign: 'center' }}>Create account</h2>
      <p style={{ color: '#94a3b8', fontSize: '0.8125rem', marginBottom: '1rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
        Save and manage your generations
        <InfoIcon text="Register to store your Bicep and Terraform generations under your account. You can revisit them anytime, download again in either format, or delete them." />
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
      <label style={labelStyle}>Password (min 8 characters)</label>
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
      <label style={labelStyle}>Display name (optional)</label>
      <input
        type="text"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Your name"
        style={inputStyle}
        autoComplete="name"
      />
      {error && <p style={{ color: '#f87171', fontSize: '0.875rem', marginBottom: '0.5rem' }}>{error}</p>}
      <button type="submit" disabled={loading} style={primaryButton}>
        {loading ? '…' : 'Register'}
      </button>
      <button type="button" onClick={onGoLogin} style={{ ...linkStyle, background: 'none', border: 'none', padding: 0 }}>
        Already have an account? Sign in
      </button>
    </form>
  );
}
