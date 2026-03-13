import { useState, useEffect } from 'react';
import type { NetworkConfig, AzureService, ServiceEntry, VMConfig, VMSSConfig } from '../types';

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
    } else {
      next.add(type);
      if (!names[type]) setNames((n) => ({ ...n, [type]: `${projectName}-${type}` }));
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
      const config: Record<string, unknown> =
        type === 'vm' ? ((configs[type] as VMConfig) || defaultVMConfig(name)) as Record<string, unknown>
        : type === 'vmss' ? ((configs[type] as VMSSConfig) || defaultVMSSConfig(name)) as Record<string, unknown>
        : {};
      return {
        type: type as AzureService['type'],
        name,
        subnetPlacement: subnets[type] || subnetNames[0],
        config,
      };
    });

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
            const name = names[type] ?? `${projectName}-${type}`;
            return (
              <div key={type} style={{ marginBottom: '1rem' }}>
                <div style={{ marginBottom: '0.5rem', fontWeight: 600 }}>{entry?.label ?? type}</div>
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
