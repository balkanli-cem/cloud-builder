import { useState, useEffect, useCallback } from 'react';
import type { NetworkConfig, SubnetConfig } from '../types';

const CIDR_REGEX = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/;
const NAME_REGEX = /^[a-z0-9-]+$/;

function validateCIDR(value: string): boolean {
  return CIDR_REGEX.test(value);
}

/** Derive subnet /24 prefixes from a VNet CIDR (e.g. 10.80.0.0/16 → 10.80.1.0/24, 10.80.2.0/24, ...). */
function deriveSubnetPrefixesFromVnet(vnetCidr: string, count: number): string[] {
  const trimmed = vnetCidr.trim();
  if (!trimmed || !validateCIDR(trimmed)) return [];
  const [ip] = trimmed.split('/');
  const octets = ip.split('.').map((s) => parseInt(s, 10));
  if (octets.length < 2 || octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return [];
  const base = `${octets[0]}.${octets[1]}`;
  const prefixes: string[] = [];
  for (let i = 1; i <= count; i++) {
    prefixes.push(`${base}.${i}.0/24`);
  }
  return prefixes;
}
function validateName(value: string): boolean {
  return NAME_REGEX.test(value) && value.trim().length > 0;
}

type Props = {
  projectName: string;
  network: NetworkConfig | null;
  setNetwork: (n: NetworkConfig) => void;
  authToken?: string | null;
  onNext: () => void;
  onBack: () => void;
};

const DEFAULT_SUBNETS: SubnetConfig[] = [
  { name: 'Frontend', addressPrefix: '10.50.1.0/24' },
  { name: 'Backend', addressPrefix: '10.50.2.0/24' },
  { name: 'DB', addressPrefix: '10.50.3.0/24' },
];

export function StepNetwork({ projectName, network, setNetwork, authToken, onNext, onBack }: Props) {
  const [useDefaults, setUseDefaults] = useState(true);
  const [loaded, setLoaded] = useState<NetworkConfig | null>(null);
  const [editing, setEditing] = useState<NetworkConfig>({
    vnetName: '',
    addressSpace: '',
    subnets: [],
  });
  const [errors, setErrors] = useState<{ vnetName?: string; addressSpace?: string; prefixes?: Record<number, string> }>({});

  useEffect(() => {
    if (!projectName) return;
    const headers: HeadersInit = authToken ? { Authorization: `Bearer ${authToken}` } : {};
    fetch(`/api/default-network/${encodeURIComponent(projectName)}`, { headers })
      .then((r) => r.json())
      .then((data: NetworkConfig) => {
        setLoaded(data);
        if (!network) setNetwork(data);
        setEditing(data);
      })
      .catch(() => {
        const fallback: NetworkConfig = {
          vnetName: `${projectName}-vnet`,
          addressSpace: '10.50.0.0/16',
          subnets: [...DEFAULT_SUBNETS],
        };
        setLoaded(fallback);
        if (!network) setNetwork(fallback);
        setEditing(fallback);
      });
  }, [projectName]);

  const syncEditingFromNetwork = useCallback((config: NetworkConfig) => {
    setEditing({
      vnetName: config.vnetName,
      addressSpace: config.addressSpace,
      subnets: config.subnets.map((s) => ({ name: s.name, addressPrefix: s.addressPrefix })),
    });
  }, []);

  useEffect(() => {
    if (network && !useDefaults) syncEditingFromNetwork(network);
  }, [useDefaults, network, syncEditingFromNetwork]);

  const current = network ?? loaded;
  if (!current) return <p style={{ color: '#94a3b8' }}>Loading…</p>;

  const validateCustomNetwork = (): boolean => {
    const newErrors: { vnetName?: string; addressSpace?: string; prefixes?: Record<number, string> } = {};
    if (!validateName(editing.vnetName)) newErrors.vnetName = 'Lowercase letters, numbers, hyphens only.';
    if (!validateCIDR(editing.addressSpace)) newErrors.addressSpace = 'Valid CIDR required (e.g. 10.50.0.0/16).';
    const prefixes: Record<number, string> = {};
    editing.subnets.forEach((s, i) => {
      if (!validateCIDR(s.addressPrefix)) prefixes[i] = 'Valid CIDR required (e.g. 10.50.1.0/24).';
    });
    if (Object.keys(prefixes).length) newErrors.prefixes = prefixes;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const updateSubnetPrefix = (index: number, addressPrefix: string) => {
    setEditing((prev) => ({
      ...prev,
      subnets: prev.subnets.map((s, i) => (i === index ? { ...s, addressPrefix } : s)),
    }));
    if (errors.prefixes?.[index]) {
      setErrors((e) => {
        const next = { ...e.prefixes };
        delete next[index];
        return { ...e, prefixes: Object.keys(next).length ? next : undefined };
      });
    }
  };
  const updateVnetName = (vnetName: string) => {
    setEditing((prev) => ({ ...prev, vnetName }));
    if (errors.vnetName) setErrors((e) => ({ ...e, vnetName: undefined }));
  };
  const updateAddressSpace = (addressSpace: string) => {
    setEditing((prev) => {
      const next = { ...prev, addressSpace };
      const derived = deriveSubnetPrefixesFromVnet(addressSpace, prev.subnets.length);
      if (derived.length === prev.subnets.length) {
        next.subnets = prev.subnets.map((s, i) => ({ ...s, addressPrefix: derived[i] }));
      }
      return next;
    });
    if (errors.addressSpace) setErrors((e) => ({ ...e, addressSpace: undefined }));
  };

  const handleNext = () => {
    if (useDefaults) {
      onNext();
      return;
    }
    if (!validateCustomNetwork()) return;
    setNetwork({
      vnetName: editing.vnetName.trim(),
      addressSpace: editing.addressSpace.trim(),
      subnets: editing.subnets.map((s) => ({ name: s.name, addressPrefix: s.addressPrefix.trim() })),
    });
    onNext();
  };

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
            if (!e.target.checked && current) syncEditingFromNetwork(current);
          }}
        />
        Use default layout
      </label>
      {!useDefaults && (
        <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', color: '#94a3b8', fontSize: '0.875rem' }}>VNet name</label>
            <input
              type="text"
              value={editing.vnetName}
              onChange={(e) => updateVnetName(e.target.value)}
              placeholder="e.g. my-app-vnet"
              style={{ ...inputStyle, borderColor: errors.vnetName ? '#f87171' : undefined }}
            />
            {errors.vnetName && <span style={{ color: '#f87171', fontSize: '0.75rem' }}>{errors.vnetName}</span>}
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', color: '#94a3b8', fontSize: '0.875rem' }}>Address space (CIDR)</label>
            <input
              type="text"
              value={editing.addressSpace}
              onChange={(e) => updateAddressSpace(e.target.value)}
              placeholder="e.g. 10.50.0.0/16"
              style={{ ...inputStyle, borderColor: errors.addressSpace ? '#f87171' : undefined }}
            />
            {errors.addressSpace && <span style={{ color: '#f87171', fontSize: '0.75rem' }}>{errors.addressSpace}</span>}
          </div>
          <div style={{ marginTop: '1rem' }}>
            <span style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.875rem' }}>Subnet address prefixes</span>
            {editing.subnets.map((s, i) => (
              <div key={s.name} style={{ marginBottom: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>{s.name}</label>
                <input
                  type="text"
                  value={s.addressPrefix}
                  onChange={(e) => updateSubnetPrefix(i, e.target.value)}
                  placeholder="e.g. 10.50.1.0/24"
                  style={{ ...inputStyle, borderColor: errors.prefixes?.[i] ? '#f87171' : undefined }}
                />
                {errors.prefixes?.[i] && <span style={{ color: '#f87171', fontSize: '0.75rem' }}>{errors.prefixes[i]}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
        <button type="button" onClick={onBack} style={secondaryButton}>Back</button>
        <button type="button" onClick={handleNext} style={primaryButton}>Next: Services</button>
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
