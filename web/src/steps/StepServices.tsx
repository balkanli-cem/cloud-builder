import { useState, useEffect } from 'react';
import type { NetworkConfig, AzureService, ServiceEntry, ServiceUiCategory, VMConfig, VMSSConfig } from '../types';

type CategoryVisual = {
  border: string;
  surface: string;
  badgeBg: string;
  badgeText: string;
  label: string;
};

const CATEGORY_UI: Record<ServiceUiCategory, CategoryVisual> = {
  compute: {
    label: 'Compute',
    border: '#ea580c',
    surface: 'linear-gradient(160deg, rgba(234, 88, 12, 0.14) 0%, rgba(15, 23, 42, 0.92) 55%)',
    badgeBg: 'rgba(234, 88, 12, 0.28)',
    badgeText: '#fdba74',
  },
  containers: {
    label: 'Containers',
    border: '#7c3aed',
    surface: 'linear-gradient(160deg, rgba(124, 58, 237, 0.14) 0%, rgba(15, 23, 42, 0.92) 55%)',
    badgeBg: 'rgba(124, 58, 237, 0.28)',
    badgeText: '#c4b5fd',
  },
  data: {
    label: 'Data',
    border: '#ca8a04',
    surface: 'linear-gradient(160deg, rgba(202, 138, 4, 0.1) 0%, rgba(15, 23, 42, 0.92) 55%)',
    badgeBg: 'rgba(202, 138, 4, 0.22)',
    badgeText: '#fde047',
  },
  web: {
    label: 'Web & app',
    border: '#0284c7',
    surface: 'linear-gradient(160deg, rgba(2, 132, 199, 0.12) 0%, rgba(15, 23, 42, 0.92) 55%)',
    badgeBg: 'rgba(2, 132, 199, 0.22)',
    badgeText: '#7dd3fc',
  },
  integration: {
    label: 'Integration',
    border: '#db2777',
    surface: 'linear-gradient(160deg, rgba(219, 39, 119, 0.1) 0%, rgba(15, 23, 42, 0.92) 55%)',
    badgeBg: 'rgba(219, 39, 119, 0.22)',
    badgeText: '#f9a8d4',
  },
  security: {
    label: 'Security',
    border: '#059669',
    surface: 'linear-gradient(160deg, rgba(5, 150, 105, 0.1) 0%, rgba(15, 23, 42, 0.92) 55%)',
    badgeBg: 'rgba(5, 150, 105, 0.22)',
    badgeText: '#6ee7b7',
  },
  ai: {
    label: 'AI & ML',
    border: '#0891b2',
    surface: 'linear-gradient(160deg, rgba(8, 145, 178, 0.12) 0%, rgba(15, 23, 42, 0.92) 55%)',
    badgeBg: 'rgba(56, 189, 248, 0.22)',
    badgeText: '#7dd3fc',
  },
};

function WhatCreatesPanel({ entry }: { entry: ServiceEntry }) {
  const w = entry.whatCreates;
  if (!w) return null;
  return (
    <details
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      style={{
        marginTop: '0.5rem',
        marginLeft: 0,
        maxWidth: '100%',
        borderLeft: '2px solid rgba(148, 163, 184, 0.35)',
        paddingLeft: '0.65rem',
      }}
    >
      <summary style={{ cursor: 'pointer', color: '#94a3b8', fontSize: '0.8125rem', userSelect: 'none' }}>
        What this creates
      </summary>
      <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: '#cbd5e1', lineHeight: 1.5 }}>
        <p style={{ margin: '0 0 0.5rem 0' }}>{w.createsSummary}</p>
        <p style={{ margin: '0 0 0.25rem 0', color: '#94a3b8', fontSize: '0.75rem' }}>Cost levers</p>
        <ul style={{ margin: '0 0 0.5rem 0', paddingLeft: '1.25rem', color: '#e2e8f0' }}>
          {w.costLevers.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p style={{ margin: '0 0 0.5rem 0', color: '#94a3b8', fontSize: '0.75rem' }}>Destroy order (suggested)</p>
        <p style={{ margin: '0 0 0.5rem 0' }}>{w.destroyOrder}</p>
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
          Estimates are not guarantees—use Azure Pricing Calculator for your region and SKUs.
        </p>
        <div
          style={{ marginTop: '0.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}
          onClick={(e) => e.stopPropagation()}
        >
          <a href={w.pricingUrl} target="_blank" rel="noopener noreferrer" style={linkStyle}>
            Azure pricing
          </a>
          <a href={w.docsUrl} target="_blank" rel="noopener noreferrer" style={linkStyle}>
            Product docs
          </a>
        </div>
      </div>
    </details>
  );
}

const linkStyle: React.CSSProperties = {
  color: '#60a5fa',
  fontSize: '0.8125rem',
  textDecoration: 'none',
  borderBottom: '1px solid transparent',
};

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
  /** For subnet_optional services: managed = omit subnetPlacement (e.g. AKS Kubenet). */
  const [networkChoices, setNetworkChoices] = useState<Record<string, 'managed' | 'shared'>>({});
  const [configs, setConfigs] = useState<Record<string, Record<string, unknown>>>({});

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const subnetNames = network.subnets.map((s) => s.name);

  const toggleService = (type: string) => {
    const next = new Set(selectedTypes);
    const entry = catalog.find((c) => c.type === type);
    if (next.has(type)) {
      next.delete(type);
      setNetworkChoices((c) => {
        const copy = { ...c };
        delete copy[type];
        return copy;
      });
    } else {
      next.add(type);
      if (!names[type]) setNames((n) => ({ ...n, [type]: `${projectName}-${type}` }));
      if (entry?.networkMode === 'subnet_optional') {
        setNetworkChoices((c) => ({ ...c, [type]: 'managed' }));
      }
      if (!subnets[type] && entry) {
        const defaultSub = subnetNames.includes(entry.defaultSubnet) ? entry.defaultSubnet : subnetNames[0];
        setSubnets((s) => ({ ...s, [type]: defaultSub }));
      }
      if (type === 'vm' && !configs[type]) {
        setConfigs((c) => ({ ...c, [type]: defaultVMConfig(`${projectName}-vm`) as Record<string, unknown> }));
      }
      if (type === 'vmss' && !configs[type]) {
        setConfigs((c) => ({ ...c, [type]: defaultVMSSConfig(`${projectName}-vmss`) as Record<string, unknown> }));
      }
    }
    setSelectedTypes(next);
  };

  const buildServices = (): AzureService[] =>
    Array.from(selectedTypes).map((type) => {
      const name = names[type] || `${projectName}-${type}`;
      const entry = catalog.find((c) => c.type === type);
      const config: Record<string, unknown> =
        type === 'vm' ? ((configs[type] as VMConfig) || defaultVMConfig(name)) as Record<string, unknown>
        : type === 'vmss' ? ((configs[type] as VMSSConfig) || defaultVMSSConfig(name)) as Record<string, unknown>
        : {};
      const optionalManaged =
        entry?.networkMode === 'subnet_optional' && (networkChoices[type] ?? 'managed') === 'managed';
      const base: AzureService = {
        type: type as AzureService['type'],
        name,
        config,
      };
      if (!optionalManaged) {
        base.subnetPlacement = subnets[type] || subnetNames[0];
      }
      return base;
    });

  const handleNext = () => {
    setServices(buildServices());
    onNext();
  };

  const canNext = selectedTypes.size > 0;

  return (
    <section>
      <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Services</h2>
      <p style={{ color: '#94a3b8', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
        Click a card to include that service in your generation. Colors group services by Azure family (compute, containers, data, etc.).
      </p>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem 1rem',
          marginBottom: '1rem',
          fontSize: '0.75rem',
          color: '#94a3b8',
          alignItems: 'center',
        }}
      >
        <span style={{ color: '#64748b' }}>Legend:</span>
        {(Object.keys(CATEGORY_UI) as ServiceUiCategory[]).map((key) => {
          const c = CATEGORY_UI[key];
          return (
            <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '2px',
                  background: c.border,
                  boxShadow: `0 0 0 1px ${c.border}`,
                }}
              />
              {c.label}
            </span>
          );
        })}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        {catalog.map((entry) => {
          const selected = selectedTypes.has(entry.type);
          const cat = CATEGORY_UI[entry.uiCategory];
          return (
            <div
              key={entry.type}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              aria-label={
                selected
                  ? `${entry.label} selected. Activate to remove from generation.`
                  : `${entry.label} not selected. Activate to add to generation.`
              }
              onClick={() => toggleService(entry.type)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleService(entry.type);
                }
              }}
              style={{
                position: 'relative',
                borderRadius: '10px',
                border: `2px solid ${cat.border}`,
                background: cat.surface,
                padding: '0.85rem 0.9rem',
                cursor: 'pointer',
                outline: 'none',
                boxShadow: selected
                  ? '0 0 0 2px rgba(96, 165, 250, 0.55), 0 8px 24px rgba(0, 0, 0, 0.35)'
                  : '0 4px 16px rgba(0, 0, 0, 0.2)',
                transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div style={{ minWidth: 0 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: cat.badgeText,
                      background: cat.badgeBg,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                      marginBottom: '0.35rem',
                    }}
                  >
                    {cat.label}
                  </span>
                  <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.95rem', lineHeight: 1.3 }}>{entry.label}</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.8125rem', marginTop: '0.35rem', lineHeight: 1.45 }}>
                    {entry.description}
                  </div>
                </div>
                <span
                  aria-hidden="true"
                  style={{
                    flexShrink: 0,
                    width: '1.35rem',
                    height: '1.35rem',
                    borderRadius: '6px',
                    border: selected ? '2px solid #60a5fa' : '2px solid #475569',
                    background: selected ? 'rgba(96, 165, 250, 0.2)' : 'rgba(15, 23, 42, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: selected ? '#93c5fd' : 'transparent',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                  }}
                >
                  {selected ? '✓' : ''}
                </span>
              </div>
              {entry.integrationNotes && (
                <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: '#64748b', lineHeight: 1.45 }}>
                  {entry.integrationNotes}
                </div>
              )}
              <WhatCreatesPanel entry={entry} />
            </div>
          );
        })}
      </div>
      {selectedTypes.size > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <strong style={{ display: 'block', marginBottom: '0.75rem', color: '#e2e8f0', fontSize: '0.9375rem' }}>
            Configure each
          </strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {Array.from(selectedTypes).map((type) => {
            const entry = catalog.find((c) => c.type === type);
            const cat = entry ? CATEGORY_UI[entry.uiCategory] : CATEGORY_UI.web;
            const name = names[type] ?? `${projectName}-${type}`;
            return (
              <div
                key={type}
                style={{
                  borderRadius: '10px',
                  border: `2px solid ${cat.border}`,
                  background: cat.surface,
                  padding: '1rem',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: cat.badgeText,
                      background: cat.badgeBg,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                    }}
                  >
                    {cat.label}
                  </span>
                  <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.95rem' }}>{entry?.label ?? type}</span>
                </div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', color: '#94a3b8' }}>
                  Resource name
                </label>
                <input
                  type="text"
                  value={names[type] ?? ''}
                  onChange={(e) => setNames((n) => ({ ...n, [type]: e.target.value }))}
                  placeholder="e.g. my-app-vmss"
                  style={inputStyle}
                />
                {entry?.networkMode === 'subnet_optional' && (
                  <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.8125rem', color: '#94a3b8', marginBottom: '0.35rem' }}>Networking</div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <input
                        type="radio"
                        name={`net-${type}`}
                        checked={(networkChoices[type] ?? 'managed') === 'managed'}
                        onChange={() => setNetworkChoices((c) => ({ ...c, [type]: 'managed' }))}
                      />
                      <span style={{ fontSize: '0.875rem' }}>Managed — cluster creates its own networking (Kubenet; wizard VNet not used for this cluster)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="radio"
                        name={`net-${type}`}
                        checked={(networkChoices[type] ?? 'managed') === 'shared'}
                        onChange={() => setNetworkChoices((c) => ({ ...c, [type]: 'shared' }))}
                      />
                      <span style={{ fontSize: '0.875rem' }}>Use shared VNet subnet (Azure CNI)</span>
                    </label>
                  </div>
                )}
                {((entry?.networkMode !== 'subnet_optional') || (networkChoices[type] ?? 'managed') === 'shared') && (
                  <>
                    <label style={{ display: 'block', marginTop: '0.5rem', marginBottom: '0.25rem', fontSize: '0.875rem', color: '#94a3b8' }}>
                      Subnet
                    </label>
                    <select
                      value={subnets[type] ?? ''}
                      onChange={(e) => setSubnets((s) => ({ ...s, [type]: e.target.value }))}
                      style={{ ...inputStyle }}
                    >
                      {subnetNames.map((sn) => (
                        <option key={sn} value={sn}>{sn}</option>
                      ))}
                    </select>
                  </>
                )}
                {type === 'vm' && (
                  <VMConfigForm
                    config={(configs[type] as VMConfig) || defaultVMConfig(name)}
                    name={name}
                    onChange={(updates) => setConfigs((c) => ({ ...c, [type]: { ...(c[type] as VMConfig), ...updates } }))}
                  />
                )}
                {type === 'vmss' && (
                  <VMSSConfigForm
                    config={(configs[type] as VMSSConfig) || defaultVMSSConfig(name)}
                    name={name}
                    onChange={(updates) => setConfigs((c) => ({ ...c, [type]: { ...(c[type] as VMSSConfig), ...updates } }))}
                  />
                )}
                {entry && <WhatCreatesPanel entry={entry} />}
              </div>
            );
          })}
          </div>
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

function defaultVMConfig(name: string): VMConfig {
  return {
    enablePublicIp: true,
    nicName: `${name}-nic`,
    vmSize: 'Standard_B2s',
    osType: 'Linux',
    adminUsername: 'azureuser',
    osDiskSizeGb: 30,
  };
}

function defaultVMSSConfig(name: string): VMSSConfig {
  return {
    nicName: `${name}-nic`,
    vmSize: 'Standard_B2s',
    osType: 'Linux',
    instanceCountMin: 1,
    instanceCountMax: 10,
    scaleOutCpuPercent: 70,
    scaleInCpuPercent: 30,
  };
}

const VM_SIZES = ['Standard_B1s', 'Standard_B2s', 'Standard_D2s_v3', 'Standard_D4s_v3', 'Standard_DS2_v2'];

function VMConfigForm({
  config,
  name,
  onChange,
}: {
  config: VMConfig;
  name: string;
  onChange: (u: Partial<VMConfig>) => void;
}) {
  const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', color: '#94a3b8' };
  return (
    <div style={{ marginTop: '0.75rem', paddingLeft: '0.5rem', borderLeft: '2px solid #475569' }}>
      <div style={{ fontSize: '0.8125rem', color: '#94a3b8', marginBottom: '0.5rem' }}>VM options</div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <input
          type="checkbox"
          checked={config.enablePublicIp !== false}
          onChange={(e) => onChange({ enablePublicIp: e.target.checked })}
        />
        <span>Assign public IP</span>
      </label>
      <label style={labelStyle}>NIC name</label>
      <input
        type="text"
        value={config.nicName ?? `${name}-nic`}
        onChange={(e) => onChange({ nicName: e.target.value })}
        placeholder="e.g. my-vm-nic"
        style={{ ...inputStyle, marginBottom: '0.5rem' }}
      />
      <label style={labelStyle}>VM size (SKU)</label>
      <select
        value={config.vmSize ?? 'Standard_B2s'}
        onChange={(e) => onChange({ vmSize: e.target.value })}
        style={{ ...inputStyle, marginBottom: '0.5rem' }}
      >
        {VM_SIZES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <label style={labelStyle}>Operating system</label>
      <select
        value={config.osType ?? 'Linux'}
        onChange={(e) => onChange({ osType: e.target.value as 'Linux' | 'Windows' })}
        style={{ ...inputStyle, marginBottom: '0.5rem' }}
      >
        <option value="Linux">Linux</option>
        <option value="Windows">Windows</option>
      </select>
      <label style={labelStyle}>Admin username</label>
      <input
        type="text"
        value={config.adminUsername ?? 'azureuser'}
        onChange={(e) => onChange({ adminUsername: e.target.value })}
        placeholder="e.g. azureuser"
        style={{ ...inputStyle, marginBottom: '0.5rem' }}
      />
      <label style={labelStyle}>OS disk size (GB)</label>
      <input
        type="number"
        min={1}
        max={4096}
        value={config.osDiskSizeGb ?? 30}
        onChange={(e) => onChange({ osDiskSizeGb: parseInt(e.target.value, 10) || 30 })}
        placeholder="30"
        style={inputStyle}
      />
    </div>
  );
}

function VMSSConfigForm({
  config,
  name,
  onChange,
}: {
  config: VMSSConfig;
  name: string;
  onChange: (u: Partial<VMSSConfig>) => void;
}) {
  const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', color: '#94a3b8' };
  return (
    <div style={{ marginTop: '0.75rem', paddingLeft: '0.5rem', borderLeft: '2px solid #475569' }}>
      <div style={{ fontSize: '0.8125rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Scale set &amp; autoscale</div>
      <label style={labelStyle}>NIC name (prefix)</label>
      <input
        type="text"
        value={config.nicName ?? `${name}-nic`}
        onChange={(e) => onChange({ nicName: e.target.value })}
        placeholder="e.g. my-vmss-nic"
        style={{ ...inputStyle, marginBottom: '0.5rem' }}
      />
      <label style={labelStyle}>VM size (SKU)</label>
      <select
        value={config.vmSize ?? 'Standard_B2s'}
        onChange={(e) => onChange({ vmSize: e.target.value })}
        style={{ ...inputStyle, marginBottom: '0.5rem' }}
      >
        {VM_SIZES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <label style={labelStyle}>Operating system</label>
      <select
        value={config.osType ?? 'Linux'}
        onChange={(e) => onChange({ osType: e.target.value as 'Linux' | 'Windows' })}
        style={{ ...inputStyle, marginBottom: '0.5rem' }}
      >
        <option value="Linux">Linux</option>
        <option value="Windows">Windows</option>
      </select>
      <label style={labelStyle}>Minimum instances</label>
      <input
        type="number"
        min={0}
        value={config.instanceCountMin ?? 1}
        onChange={(e) => onChange({ instanceCountMin: parseInt(e.target.value, 10) || 0 })}
        placeholder="1"
        style={{ ...inputStyle, marginBottom: '0.5rem' }}
      />
      <label style={labelStyle}>Maximum instances</label>
      <input
        type="number"
        min={1}
        value={config.instanceCountMax ?? 10}
        onChange={(e) => onChange({ instanceCountMax: parseInt(e.target.value, 10) || 1 })}
        placeholder="10"
        style={{ ...inputStyle, marginBottom: '0.5rem' }}
      />
      <label style={{ ...labelStyle, marginTop: '0.5rem' }}>Scale out when CPU % above</label>
      <input
        type="number"
        min={1}
        max={100}
        value={config.scaleOutCpuPercent ?? 70}
        onChange={(e) => onChange({ scaleOutCpuPercent: parseInt(e.target.value, 10) || 70 })}
        style={{ ...inputStyle, marginBottom: '0.5rem' }}
      />
      <label style={labelStyle}>Scale in when CPU % below</label>
      <input
        type="number"
        min={0}
        max={100}
        value={config.scaleInCpuPercent ?? 30}
        onChange={(e) => onChange({ scaleInCpuPercent: parseInt(e.target.value, 10) || 30 })}
        style={inputStyle}
      />
    </div>
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
