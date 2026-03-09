import { useState, useEffect } from 'react';
import type { NetworkConfig } from '../types';

type Props = {
  projectName: string;
  network: NetworkConfig | null;
  setNetwork: (n: NetworkConfig) => void;
  onNext: () => void;
  onBack: () => void;
};

const DEFAULT_SUBNETS = [
  { name: 'Frontend', addressPrefix: '10.50.1.0/24' },
  { name: 'Backend', addressPrefix: '10.50.2.0/24' },
  { name: 'DB', addressPrefix: '10.50.3.0/24' },
];

export function StepNetwork({ projectName, network, setNetwork, onNext, onBack }: Props) {
  const [useDefaults, setUseDefaults] = useState(true);
  const [loaded, setLoaded] = useState<NetworkConfig | null>(null);

  useEffect(() => {
    if (!projectName) return;
    fetch(`/api/default-network/${encodeURIComponent(projectName)}`)
      .then((r) => r.json())
      .then((data: NetworkConfig) => {
        setLoaded(data);
        if (!network) setNetwork(data);
      })
      .catch(() => {
        const fallback: NetworkConfig = {
          vnetName: `${projectName}-vnet`,
          addressSpace: '10.50.0.0/16',
          subnets: DEFAULT_SUBNETS,
        };
        setLoaded(fallback);
        if (!network) setNetwork(fallback);
      });
  }, [projectName]);

  const current = network ?? loaded;
  if (!current) return <p style={{ color: '#94a3b8' }}>Loading…</p>;

  return (
    <section>
      <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Network</h2>
      <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
        <div style={{ marginBottom: '0.5rem' }}><strong>VNet</strong> {current.vnetName}</div>
        <div style={{ marginBottom: '0.5rem' }}><strong>Address space</strong> {current.addressSpace}</div>
        <div><strong>Subnets</strong>
          {current.subnets.map((s) => (
            <div key={s.name} style={{ marginLeft: '1rem', color: '#94a3b8' }}>
              {s.name} {s.addressPrefix}
            </div>
          ))}
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          type="checkbox"
          checked={useDefaults}
          onChange={(e) => {
            setUseDefaults(e.target.checked);
            if (e.target.checked && loaded) setNetwork(loaded);
          }}
        />
        Use default layout
      </label>
      {!useDefaults && (
        <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
          Custom network editing can be added here. For now, use defaults and continue.
        </p>
      )}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
        <button type="button" onClick={onBack} style={secondaryButton}>Back</button>
        <button type="button" onClick={onNext} style={primaryButton}>Next: Services</button>
      </div>
    </section>
  );
}

const primaryButton: React.CSSProperties = {
  padding: '0.5rem 1rem',
  background: '#3b82f6',
  border: 'none',
  borderRadius: '6px',
  color: 'white',
  fontWeight: 600,
  cursor: 'pointer',
};
const secondaryButton: React.CSSProperties = {
  padding: '0.5rem 1rem',
  background: 'transparent',
  border: '1px solid #475569',
  borderRadius: '6px',
  color: '#e2e8f0',
  cursor: 'pointer',
};
