import { useState, useEffect, useCallback } from 'react';
import { errorMessageFromApi } from '../rateLimitMessage';

export interface Generation {
  id: number;
  projectName: string;
  resourceGroupName: string;
  region: string;
  format: string;
  createdAt: string;
  validationStatus?: string | null;
  validationMessage?: string | null;
  clientId?: number | null;
  clientName?: string | null;
}

type ClientRow = { id: number; name: string };

type Props = {
  token: string;
  onGenerateNew: () => void;
  /** Refresh client list in the wizard after dashboard changes. */
  onClientsMaybeChanged?: () => void;
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

function validationBadge(status: string | null, message: string | null): React.ReactNode {
  const label =
    status === 'success' ? 'Valid' :
    status === 'warning' ? 'Warnings' :
    status === 'error' ? 'Invalid' :
    status === 'skipped' ? 'Not validated' : null;
  if (!label) return null;
  const color =
    status === 'success' ? '#22c55e' :
    status === 'warning' ? '#eab308' :
    status === 'error' ? '#ef4444' : '#64748b';
  return (
    <span
      title={message || undefined}
      style={{
        marginLeft: '0.5rem',
        fontSize: '0.6875rem',
        fontWeight: 600,
        color,
        textTransform: 'uppercase',
        letterSpacing: '0.02em',
      }}
    >
      · {label}
    </span>
  );
}

type DownloadFormat = 'bicep' | 'terraform';

async function downloadGeneration(token: string, id: number, projectName: string, format: DownloadFormat): Promise<void> {
  const res = await fetch(`/api/generations/${id}/download?format=${format}`, { headers: authHeaders(token) });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(errorMessageFromApi(res, data, res.statusText));
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName}-${format}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

async function deleteGeneration(token: string, id: number): Promise<void> {
  const res = await fetch(`/api/generations/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || res.statusText);
  }
}

export function Dashboard({ token, onGenerateNew, onClientsMaybeChanged }: Props) {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null); // e.g. "123-bicep" or "123-terraform"
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [newClientName, setNewClientName] = useState('');
  const [clientBusy, setClientBusy] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const reloadAll = useCallback(async (): Promise<void> => {
    const [gr, cl] = await Promise.all([
      fetch('/api/generations', { headers: authHeaders(token) }),
      fetch('/api/clients', { headers: authHeaders(token) }),
    ]);
    if (gr.status === 401 || cl.status === 401) return;
    if (gr.ok) {
      const data = await gr.json();
      setGenerations(data.generations || []);
    } else {
      setGenerations([]);
    }
    if (cl.ok) {
      const cdata = await cl.json();
      setClients(cdata.clients || []);
    } else {
      setClients([]);
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        await reloadAll();
      } catch {
        if (!cancelled) setError('Failed to load your data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, reloadAll]);

  return (
    <section style={{ maxWidth: '36rem', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.125rem', margin: '0 0 0.75rem 0' }}>My clients</h2>
        <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8125rem', color: '#64748b', lineHeight: 1.5 }}>
          Clients are private to your account. Use them on the Project step to tag new generations.
        </p>
        {clients.length === 0 && !clientBusy ? (
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>No clients yet — add one below or from the generator wizard.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 0.75rem 0' }}>
            {clients.map((c) => (
              <li
                key={c.id}
                style={{
                  padding: '0.5rem 0.75rem',
                  marginBottom: '0.35rem',
                  background: '#1e293b',
                  borderRadius: '6px',
                  border: '1px solid #334155',
                  color: '#e2e8f0',
                  fontSize: '0.875rem',
                }}
              >
                {c.name}
              </li>
            ))}
          </ul>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
            placeholder="New client name"
            disabled={clientBusy}
            style={{
              flex: '1 1 12rem',
              minWidth: 0,
              padding: '0.5rem 0.75rem',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#e2e8f0',
              fontSize: '1rem',
            }}
          />
          <button
            type="button"
            disabled={clientBusy || !newClientName.trim()}
            onClick={async () => {
              setClientError(null);
              setClientBusy(true);
              try {
                const res = await fetch('/api/clients', {
                  method: 'POST',
                  headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: newClientName.trim() }),
                });
                const data = await res.json().catch(() => ({}));
                if (res.status === 503) {
                  setClientError('Database not configured for clients.');
                  return;
                }
                if (res.status === 409) {
                  setClientError((data as { error?: string }).error || 'Duplicate name.');
                  return;
                }
                if (!res.ok) {
                  setClientError((data as { error?: string }).error || 'Could not add client.');
                  return;
                }
                setNewClientName('');
                await reloadAll();
                onClientsMaybeChanged?.();
              } catch {
                setClientError('Could not add client.');
              } finally {
                setClientBusy(false);
              }
            }}
            style={{
              padding: '0.5rem 1rem',
              background: '#334155',
              border: 'none',
              borderRadius: '6px',
              color: '#e2e8f0',
              fontWeight: 600,
              cursor: clientBusy || !newClientName.trim() ? 'not-allowed' : 'pointer',
              opacity: clientBusy || !newClientName.trim() ? 0.6 : 1,
            }}
          >
            Add client
          </button>
        </div>
        {clientError && (
          <p style={{ color: '#f87171', fontSize: '0.8125rem', margin: '0.5rem 0 0 0' }}>{clientError}</p>
        )}
      </div>

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
                  {validationBadge(g.validationStatus ?? null, g.validationMessage ?? null)}
                </div>
                <span style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>{formatDate(g.createdAt)}</span>
              </div>
              <div style={{ marginTop: '0.25rem', fontSize: '0.8125rem', color: '#94a3b8' }}>
                {g.resourceGroupName} · {g.region}
                {g.clientName ? (
                  <span style={{ marginLeft: '0.5rem', color: '#64748b' }}>· Client: {g.clientName}</span>
                ) : null}
              </div>
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ color: '#64748b', fontSize: '0.8125rem', marginRight: '0.25rem' }}>Download:</span>
                <button
                  type="button"
                  disabled={!!downloading || deletingId === g.id}
                  onClick={async () => {
                    setDownloading(`${g.id}-bicep`);
                    try {
                      await downloadGeneration(token, g.id, g.projectName, 'bicep');
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Download failed');
                    } finally {
                      setDownloading(null);
                    }
                  }}
                  style={{
                    padding: '0.25rem 0.5rem',
                    background: downloading === `${g.id}-bicep` ? '#334155' : '#3b82f6',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    cursor: downloading ? 'wait' : 'pointer',
                  }}
                >
                  {downloading === `${g.id}-bicep` ? '…' : 'Bicep'}
                </button>
                <button
                  type="button"
                  disabled={!!downloading || deletingId === g.id}
                  onClick={async () => {
                    setDownloading(`${g.id}-terraform`);
                    try {
                      await downloadGeneration(token, g.id, g.projectName, 'terraform');
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Download failed');
                    } finally {
                      setDownloading(null);
                    }
                  }}
                  style={{
                    padding: '0.25rem 0.5rem',
                    background: downloading === `${g.id}-terraform` ? '#334155' : '#3b82f6',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    cursor: downloading ? 'wait' : 'pointer',
                  }}
                >
                  {downloading === `${g.id}-terraform` ? '…' : 'Terraform'}
                </button>
                <button
                  type="button"
                  disabled={!!downloading || deletingId === g.id}
                  onClick={async () => {
                    if (!window.confirm(`Delete "${g.projectName}" (${g.format})? This cannot be undone.`)) return;
                    setDeletingId(g.id);
                    setError(null);
                    try {
                      await deleteGeneration(token, g.id);
                      setGenerations((prev) => prev.filter((x) => x.id !== g.id));
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Delete failed');
                    } finally {
                      setDeletingId(null);
                    }
                  }}
                  style={{
                    padding: '0.25rem 0.5rem',
                    background: 'transparent',
                    border: '1px solid #64748b',
                    borderRadius: '4px',
                    color: '#f87171',
                    fontSize: '0.8125rem',
                    cursor: deletingId === g.id ? 'wait' : 'pointer',
                  }}
                >
                  {deletingId === g.id ? '…' : 'Delete'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
