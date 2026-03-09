import type { ProjectConfig } from '../types';

const REGION_LABELS: Record<ProjectConfig['region'], string> = {
  westeurope: 'West Europe',
  swedencentral: 'Sweden Central',
  belgiumcentral: 'Belgium Central',
};

type Props = {
  config: ProjectConfig;
  generating: boolean;
  error: string | null;
  onGenerate: (format: 'bicep' | 'terraform') => void;
  onBack: () => void;
};

export function StepSummary({ config, generating, onGenerate, onBack }: Props) {
  return (
    <section>
      <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Summary</h2>
      <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>
        <div><strong>Project</strong> {config.projectName}</div>
        <div><strong>Resource group</strong> {config.resourceGroupName}</div>
        <div><strong>Region</strong> {REGION_LABELS[config.region]}</div>
        <div style={{ marginTop: '0.5rem' }}><strong>VNet</strong> {config.network.vnetName} ({config.network.addressSpace})</div>
        <div style={{ marginTop: '0.5rem' }}><strong>Services</strong>
          {config.services.map((s) => (
            <div key={s.name} style={{ marginLeft: '1rem' }}>{s.name} ({s.type}) → {s.subnetPlacement}</div>
          ))}
        </div>
      </div>
      <p style={{ color: '#94a3b8', marginBottom: '0.75rem' }}>Choose output format and generate:</p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={() => onGenerate('bicep')}
          disabled={generating}
          style={primaryButton}
        >
          {generating ? '…' : 'Download Bicep'}
        </button>
        <button
          type="button"
          onClick={() => onGenerate('terraform')}
          disabled={generating}
          style={primaryButton}
        >
          {generating ? '…' : 'Download Terraform'}
        </button>
      </div>
      <button type="button" onClick={onBack} style={secondaryButton}>Back</button>
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
