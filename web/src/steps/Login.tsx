import { useState } from 'react';

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
  onLogin: (token: string) => void;
  onGoRegister: () => void;
  onForgotPassword: () => void;
};

export function Login({ onLogin, onGoRegister, onForgotPassword }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Login failed.');
        return;
      }
      if (data.token) onLogin(data.token);
      else setError('Invalid response.');
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem', textAlign: 'center' }}>Sign in</h2>
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
      <label style={labelStyle}>Password</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        required
        style={inputStyle}
        autoComplete="current-password"
      />
      <button type="button" onClick={onForgotPassword} style={{ ...linkStyle, background: 'none', border: 'none', padding: 0, marginBottom: '0.25rem' }}>
        Forgot password?
      </button>
      {error && <p style={{ color: '#f87171', fontSize: '0.875rem', marginBottom: '0.5rem' }}>{error}</p>}
      <button type="submit" disabled={loading} style={primaryButton}>
        {loading ? '…' : 'Sign in'}
      </button>
      <button type="button" onClick={onGoRegister} style={{ ...linkStyle, background: 'none', border: 'none', padding: 0 }}>
        Create an account
      </button>
    </form>
  );
}
