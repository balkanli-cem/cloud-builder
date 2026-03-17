import type { ProjectConfig } from '../types';
import { InfoIcon } from '../components/InfoIcon';

const REGION_LABELS: Record<ProjectConfig['region'], string> = {
  westeurope: 'West Europe',
  swedencentral: 'Sweden Central',
  belgiumcentral: 'Belgium Central',
};

type Props = {
  config: ProjectConfig;
  generating: boolean;
  error: string | null;
  downloadedFormats: ('bicep' | 'terraform')[];
  onGenerate: (format: 'bicep' | 'terraform') => void;
  onBack: () => void;
  onBackToStart: () => void;
};

export function StepSummary({
  config,
  generating,
  downloadedFormats,
  onGenerate,
  onBack,
  onBackToStart,
}: Props) {
  const bicepDownloaded = downloadedFormats.includes('bicep');
  const terraformDownloaded = downloadedFormats.includes('terraform');
  const otherFormat: 'bicep' | 'terraform' = bicepDownloaded ? 'terraform' : 'bicep';
  const showDownloadOtherPrompt = downloadedFormats.length === 1;

  const downloadButtonStyle = (downloaded: boolean): React.CSSProperties =>
    downloaded
      ? { ...primaryButton, opacity: 0.5, cursor: 'default', position: 'relative' as const }
      : primaryButton;

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
      <p style={{ color: '#94a3b8', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
        Choose output format and generate:
        <InfoIcon text="Bicep: Azure's native language; deploys with Azure CLI (az deployment sub create) or deployment stacks. Terraform: use with Terraform CLI and your chosen backend (e.g. Azure). You can download both for the same design." placement="below" />
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
          <button
            type="button"
            onClick={bicepDownloaded ? undefined : () => onGenerate('bicep')}
            disabled={generating || bicepDownloaded}
            style={downloadButtonStyle(bicepDownloaded)}
          >
            {bicepDownloaded ? 'Downloaded Bicep' : generating ? '…' : 'Download Bicep'}
          </button>
          <InfoIcon text="Generates main.bicep and modules. Deploy with Azure CLI or Bicep deployment stacks." placement="below" />
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
          <button
            type="button"
            onClick={terraformDownloaded ? undefined : () => onGenerate('terraform')}
            disabled={generating || terraformDownloaded}
            style={downloadButtonStyle(terraformDownloaded)}
          >
            {terraformDownloaded ? 'Downloaded Terraform' : generating ? '…' : 'Download Terraform'}
          </button>
          <InfoIcon text="Generates .tf files for Azure provider. Run terraform init and terraform apply in the downloaded folder." placement="below" />
        </span>
      </div>

      {showDownloadOtherPrompt && (
        <div style={{ background: '#334155', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.75rem 0', color: '#e2e8f0' }}>Download the other format as well?</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => onGenerate(otherFormat)}
              disabled={generating}
              style={primaryButton}
            >
              {generating ? '…' : `Yes, download ${otherFormat}`}
            </button>
            <button type="button" onClick={onBackToStart} style={secondaryButton}>
              No, back to start
            </button>
          </div>
        </div>
      )}

      {downloadedFormats.length === 2 && (
        <p style={{ color: '#94a3b8', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
          Both formats downloaded.
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
        <button type="button" onClick={onBack} style={secondaryButton}>Back</button>
        {(downloadedFormats.length > 0) && (
          <button type="button" onClick={onBackToStart} style={secondaryButton}>
            Back to start
          </button>
        )}
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
