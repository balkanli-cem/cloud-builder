import { useState, useEffect } from 'react';
import type { NetworkConfig, AzureService, ServiceEntry } from '../types';

type Props = {
  projectName: string;
  network: NetworkConfig;
  services: AzureService[];
  setServices: (s: AzureService[]) => void;
  catalog: ServiceEntry[];
  fetchCatalog: () => Promise<void>;
  onNext: () => void;
  onBack: () => void;
};

export function StepServices({
  projectName,
  network,
  services: _services,
  setServices,
  catalog,
  fetchCatalog,
  onNext,
  onBack,
}: Props) {
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [names, setNames] = useState<Record<string, string>>({});
  const [subnets, setSubnets] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const subnetNames = network.subnets.map((s) => s.name);

  const toggleService = (type: string) => {
    const next = new Set(selectedTypes);
    const entry = catalog.find((c) => c.type === type);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
      if (!names[type]) setNames((n) => ({ ...n, [type]: `${projectName}-${type}` }));
      if (!subnets[type] && entry) {
        const defaultSub = subnetNames.includes(entry.defaultSubnet) ? entry.defaultSubnet : subnetNames[0];
        setSubnets((s) => ({ ...s, [type]: defaultSub }));
      }
    }
    setSelectedTypes(next);
  };

  const buildServices = (): AzureService[] =>
    Array.from(selectedTypes).map((type) => ({
      type: type as AzureService['type'],
      name: names[type] || `${projectName}-${type}`,
      subnetPlacement: subnets[type] || subnetNames[0],
      config: {},
    }));

  const handleNext = () => {
    setServices(buildServices());
    onNext();
  };

  const canNext = selectedTypes.size > 0;

  return (
    <section>
      <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Services</h2>
      <p style={{ color: '#94a3b8', marginBottom: '1rem', fontSize: '0.875rem' }}>
        Select Azure services. Each gets a resource name and subnet.
      </p>
      <div style={{ marginBottom: '1rem' }}>
        {catalog.map((entry) => (
          <label key={entry.type} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input
              type="checkbox"
              checked={selectedTypes.has(entry.type)}
              onChange={() => toggleService(entry.type)}
            />
            <span>{entry.label}</span>
            <span style={{ color: '#64748b', fontSize: '0.8125rem' }}>{entry.description}</span>
          </label>
        ))}
      </div>
      {selectedTypes.size > 0 && (
        <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
          <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Configure each</strong>
          {Array.from(selectedTypes).map((type) => {
            const entry = catalog.find((c) => c.type === type);
            return (
              <div key={type} style={{ marginBottom: '0.75rem' }}>
                <div style={{ marginBottom: '0.25rem' }}>{entry?.label ?? type}</div>
                <input
                  type="text"
                  value={names[type] ?? ''}
                  onChange={(e) => setNames((n) => ({ ...n, [type]: e.target.value }))}
                  placeholder="Resource name"
                  style={inputStyle}
                />
                <select
                  value={subnets[type] ?? ''}
                  onChange={(e) => setSubnets((s) => ({ ...s, [type]: e.target.value }))}
                  style={{ ...inputStyle, marginTop: '0.25rem' }}
                >
                  {subnetNames.map((sn) => (
                    <option key={sn} value={sn}>{sn}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
        <button type="button" onClick={onBack} style={secondaryButton}>Back</button>
        <button type="button" onClick={handleNext} disabled={!canNext} style={primaryButton}>
          Next: Summary
        </button>
      </div>
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '6px',
  color: '#e2e8f0',
  fontSize: '0.875rem',
};
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
