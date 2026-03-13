import { useState, useEffect } from 'react';

export interface Generation {
  id: number;
  projectName: string;
  resourceGroupName: string;
  region: string;
  format: string;
  createdAt: string;
}

type Props = {
  token: string;
  onGenerateNew: () => void;
};

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { dateStyle: 'medium' }) + ' ' + d.toLocaleTimeString(undefined, { timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function Dashboard({ token, onGenerateNew }: Props) {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch('/api/generations', { headers: authHeaders(token) })
      .then((res) => {
        if (res.status === 401) return null;
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data?.generations) setGenerations(data.generations);
        else setGenerations([]);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load your generations.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [token]);

  return (
    <section style={{ maxWidth: '36rem', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h2 style={{ fontSize: '1.125rem', margin: 0 }}>My generations</h2>
        <button
          type="button"
          onClick={onGenerateNew}
          style={{
            padding: '0.5rem 1rem',
            background: '#3b82f6',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Generate new
        </button>
      </div>

      {error && (
        <p style={{ color: '#f87171', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>
      )}

      {loading ? (
        <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Loading…</p>
      ) : generations.length === 0 ? (
        <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', color: '#94a3b8', fontSize: '0.875rem' }}>
          <p style={{ margin: 0 }}>You haven’t generated any architectures yet.</p>
          <p style={{ margin: '0.5rem 0 0 0' }}>Click <strong style={{ color: '#e2e8f0' }}>Generate new</strong> to create your first Bicep or Terraform setup.</p>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {generations.map((g) => (
            <li
              key={g.id}
              style={{
                background: '#1e293b',
                padding: '1rem',
                borderRadius: '8px',
                marginBottom: '0.5rem',
                border: '1px solid #334155',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <strong style={{ color: '#e2e8f0' }}>{g.projectName}</strong>
                  <span style={{ marginLeft: '0.5rem', color: '#64748b', fontSize: '0.8125rem' }}>
                    {g.format === 'bicep' ? 'Bicep' : 'Terraform'}
                  </span>
                </div>
                <span style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>{formatDate(g.createdAt)}</span>
              </div>
              <div style={{ marginTop: '0.25rem', fontSize: '0.8125rem', color: '#94a3b8' }}>
                {g.resourceGroupName} · {g.region}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
