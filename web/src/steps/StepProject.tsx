import { useState } from 'react';
import type { ProjectConfig } from '../types';
import { errorMessageFromApi } from '../rateLimitMessage';

export type ClientOption = { id: number; name: string };

type Props = {
  projectName: string;
  setProjectName: (s: string) => void;
  resourceGroupName: string;
  setResourceGroupName: (s: string) => void;
  /** Called when the user types in the resource group field (stops auto-sync from project name). */
  onResourceGroupManualEdit: () => void;
  /** If the field is cleared, auto-sync can resume on the next project name change. */
  onResourceGroupBlur: () => void;
  region: ProjectConfig['region'];
  setRegion: (r: ProjectConfig['region']) => void;
  environment: ProjectConfig['environment'];
  setEnvironment: (e: ProjectConfig['environment']) => void;
  regions: { value: ProjectConfig['region']; label: string }[];
  authToken: string;
  clients: ClientOption[];
  selectedClientId: number | null;
  setSelectedClientId: (id: number | null) => void;
  onClientsChanged: () => void;
  onNext: () => void;
};

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export function StepProject({
  projectName,
  setProjectName,
  resourceGroupName,
  setResourceGroupName,
  onResourceGroupManualEdit,
  onResourceGroupBlur,
  region,
  setRegion,
  environment,
  setEnvironment,
  regions,
  authToken,
  clients,
  selectedClientId,
  setSelectedClientId,
  onClientsChanged,
  onNext,
}: Props) {
  // Azure naming is lowercase; accept any casing in the fields and normalize on Continue.
  const projectNorm = projectName.trim().toLowerCase();
  const resourceGroupNorm = resourceGroupName.trim().toLowerCase();
  const valid =
    projectNorm.length > 0 &&
    /^[a-z0-9-]+$/.test(projectNorm) &&
    /^[a-z0-9-]*$/.test(resourceGroupNorm);
  const [newClientName, setNewClientName] = useState('');
  const [clientBusy, setClientBusy] = useState(false);
  const [clientMsg, setClientMsg] = useState<string | null>(null);

  return (
    <section>
      <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Project</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label>
          <span style={{ display: 'block', marginBottom: '0.25rem', color: '#94a3b8' }}>
            Project name (lowercase, hyphens allowed)
          </span>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="my-app"
            style={inputStyle}
          />
        </label>
        <label>
          <span style={{ display: 'block', marginBottom: '0.25rem', color: '#94a3b8' }}>
            Resource group name
          </span>
          <input
            type="text"
            value={resourceGroupName}
            onChange={(e) => {
              onResourceGroupManualEdit();
              setResourceGroupName(e.target.value);
            }}
            onBlur={onResourceGroupBlur}
            placeholder={projectName ? `rg-${projectName}` : 'rg-my-app'}
            style={inputStyle}
          />
        </label>
        <label>
          <span style={{ display: 'block', marginBottom: '0.25rem', color: '#94a3b8' }}>
            Azure region
          </span>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value as ProjectConfig['region'])}
            style={inputStyle}
          >
            {regions.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span style={{ display: 'block', marginBottom: '0.25rem', color: '#94a3b8' }}>
            Environment (tag + IaC parameters)
          </span>
          <select
            value={environment ?? 'dev'}
            onChange={(e) => setEnvironment(e.target.value as NonNullable<ProjectConfig['environment']>)}
            style={inputStyle}
          >
            <option value="dev">Development</option>
            <option value="stage">Staging</option>
            <option value="prod">Production</option>
          </select>
        </label>

        <div
          style={{
            padding: '0.75rem',
            borderRadius: '8px',
            border: '1px solid #334155',
            background: 'rgba(15, 23, 42, 0.6)',
          }}
        >
          <span style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.875rem' }}>
            Client (optional)
          </span>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8125rem', color: '#64748b', lineHeight: 1.45 }}>
            Tag this generation for your own organization. Only you see clients you create. Requires the database migration{' '}
            <code style={{ color: '#94a3b8' }}>schema-clients.sql</code> on the server.
          </p>
          <select
            value={selectedClientId === null ? '' : String(selectedClientId)}
            onChange={(e) => {
              const v = e.target.value;
              setSelectedClientId(v === '' ? null : parseInt(v, 10));
            }}
            style={inputStyle}
          >
            <option value="">— No client —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              placeholder="New client name"
              style={{ ...inputStyle, flex: '1 1 10rem', minWidth: 0 }}
              disabled={clientBusy}
            />
            <button
              type="button"
              disabled={clientBusy || !newClientName.trim()}
              onClick={async () => {
                setClientMsg(null);
                setClientBusy(true);
                try {
                  const res = await fetch('/api/clients', {
                    method: 'POST',
                    headers: { ...authHeaders(authToken), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newClientName.trim() }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (res.status === 503) {
                    setClientMsg('Client registry is not available (database not configured).');
                    return;
                  }
                  if (res.status === 409) {
                    setClientMsg(data.error || 'A client with that name already exists.');
                    return;
                  }
                  if (!res.ok) {
                    throw new Error(errorMessageFromApi(res, data, res.statusText));
                  }
                  const id = (data as { id?: number }).id;
                  setNewClientName('');
                  await onClientsChanged();
                  if (typeof id === 'number') setSelectedClientId(id);
                } catch (e) {
                  setClientMsg(e instanceof Error ? e.message : 'Could not add client.');
                } finally {
                  setClientBusy(false);
                }
              }}
              style={{
                padding: '0.5rem 0.75rem',
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
          {clientMsg && (
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8125rem', color: '#f87171' }}>{clientMsg}</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setProjectName(projectNorm);
            setResourceGroupName(resourceGroupNorm);
            onNext();
          }}
          disabled={!valid}
          style={{ ...buttonStyle, ...(!valid && { cursor: 'not-allowed', opacity: 0.6 }) }}
        >
          Next: Network
        </button>
      </div>
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '6px',
  color: '#e2e8f0',
  fontSize: '1rem',
};
const buttonStyle: React.CSSProperties = {
  marginTop: '0.5rem',
  padding: '0.625rem 1rem',
  background: '#3b82f6',
  border: 'none',
  borderRadius: '6px',
  color: 'white',
  fontWeight: 600,
  cursor: 'pointer',
};
