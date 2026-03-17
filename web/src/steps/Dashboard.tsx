import { useState, useEffect } from 'react';
import { InfoIcon } from '../components/InfoIcon';

export interface Generation {
  id: number;
  projectName: string;
  resourceGroupName: string;
  region: string;
  format: string;
  createdAt: string;
  validationStatus?: string | null;
  validationMessage?: string | null;
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
    throw new Error(data.error || res.statusText);
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

export function Dashboard({ token, onGenerateNew }: Props) {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null); // e.g. "123-bicep" or "123-terraform"
  const [deletingId, setDeletingId] = useState<number | null>(null);

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
        <h2 style={{ fontSize: '1.125rem', margin: 0, display: 'inline-flex', alignItems: 'center' }}>
          My generations
          <InfoIcon text="All architectures you generated while signed in. Each row can be downloaded again as Bicep or Terraform. Validation badges show whether the generated code passed bicep build or terraform validate (if the tools were available at generation time)." />
        </h2>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
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
          <InfoIcon text="Start the wizard to define a new project: name, resource group, region, virtual network, and Azure services. You can then download Bicep or Terraform for the same design." placement="below" />
        </span>
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
              </div>
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ color: '#64748b', fontSize: '0.8125rem', marginRight: '0.25rem', display: 'inline-flex', alignItems: 'center' }}>
                  Download:
                  <InfoIcon text="Bicep: Azure native DSL; use with Azure CLI or deployment stacks. Terraform: use with Terraform CLI and state. Same design, different format—pick the one that fits your pipeline. Delete removes this entry from your list only; it does not affect any resources in Azure." placement="below" />
                </span>
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
