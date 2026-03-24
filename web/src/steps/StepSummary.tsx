import { useId } from 'react';
import type { ProjectConfig } from '../types';
import type { IacFormState } from '../iacForm';

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
  iacPanelOpen: boolean;
  setIacPanelOpen: (open: boolean) => void;
  iacForm: IacFormState;
  setIacForm: React.Dispatch<React.SetStateAction<IacFormState>>;
};

const labelStyle: React.CSSProperties = { display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' };
const inputStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '28rem',
  padding: '0.35rem 0.5rem',
  borderRadius: '4px',
  border: '1px solid #475569',
  background: '#0f172a',
  color: '#e2e8f0',
  fontSize: '0.8125rem',
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

export function StepSummary({
  config,
  generating,
  downloadedFormats,
  onGenerate,
  onBack,
  onBackToStart,
  iacPanelOpen,
  setIacPanelOpen,
  iacForm,
  setIacForm,
}: Props) {
  const iacDetailsId = useId();
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
        <div><strong>Environment</strong> {config.environment ?? 'dev'}</div>
        <div style={{ marginTop: '0.5rem' }}><strong>VNet</strong> {config.network.vnetName} ({config.network.addressSpace})</div>
        <div style={{ marginTop: '0.5rem' }}><strong>Services</strong>
          {config.services.map((s) => (
            <div key={s.name} style={{ marginLeft: '1rem' }}>{s.name} ({s.type}) → {s.subnetPlacement}</div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          aria-expanded={iacPanelOpen}
          aria-controls={iacDetailsId}
          onClick={() => setIacPanelOpen(!iacPanelOpen)}
          style={{
            ...secondaryButton,
            width: '100%',
            maxWidth: '28rem',
            textAlign: 'left' as const,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>Advanced IaC (tags, SKUs, diagnostics)</span>
          <span style={{ color: '#64748b' }}>{iacPanelOpen ? '▲' : '▼'}</span>
        </button>
        {iacPanelOpen && (
          <div
            id={iacDetailsId}
            style={{
              marginTop: '0.75rem',
              padding: '1rem',
              background: '#0f172a',
              borderRadius: '8px',
              border: '1px solid #334155',
              maxWidth: '32rem',
            }}
          >
            <p style={{ margin: '0 0 0.75rem 0', color: '#94a3b8', fontSize: '0.8125rem' }}>
              Optional naming and “prod-ready” switches. Merged into generated Bicep and Terraform (default tags include{' '}
              <code style={{ color: '#cbd5e1' }}>Project</code>).
            </p>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={labelStyle}>Name prefix / suffix (sanitized in output)</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input
                  style={{ ...inputStyle, maxWidth: '12rem' }}
                  placeholder="prefix"
                  value={iacForm.namePrefix}
                  onChange={(e) => setIacForm((f) => ({ ...f, namePrefix: e.target.value }))}
                />
                <input
                  style={{ ...inputStyle, maxWidth: '12rem' }}
                  placeholder="suffix"
                  value={iacForm.nameSuffix}
                  onChange={(e) => setIacForm((f) => ({ ...f, nameSuffix: e.target.value }))}
                />
              </div>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={labelStyle}>Extra tags (one key=value per line)</label>
              <textarea
                style={{ ...inputStyle, minHeight: '4rem', fontFamily: 'monospace' }}
                placeholder={'Env=dev\nOwner=team-a'}
                value={iacForm.tagsLines}
                onChange={(e) => setIacForm((f) => ({ ...f, tagsLines: e.target.value }))}
              />
            </div>
            <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#e2e8f0', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  checked={iacForm.enableDiagnostics}
                  onChange={(e) => setIacForm((f) => ({ ...f, enableDiagnostics: e.target.checked }))}
                />
                Enable diagnostics (Log Analytics + diagnostic settings; Terraform)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#e2e8f0', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  checked={iacForm.enablePrivateEndpoints}
                  onChange={(e) => setIacForm((f) => ({ ...f, enablePrivateEndpoints: e.target.checked }))}
                />
                Private endpoints (Storage blob + Key Vault where implemented)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#e2e8f0', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  checked={iacForm.sqlZoneRedundant}
                  onChange={(e) => setIacForm((f) => ({ ...f, sqlZoneRedundant: e.target.checked }))}
                />
                SQL database zone-redundant (if SKU supports it)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#e2e8f0', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  checked={iacForm.cosmosEnableFreeTier}
                  onChange={(e) => setIacForm((f) => ({ ...f, cosmosEnableFreeTier: e.target.checked }))}
                />
                Cosmos DB free tier (when available in region)
              </label>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={labelStyle}>VM / VMSS availability zone (empty = regional)</label>
              <select
                style={inputStyle}
                value={iacForm.vmAvailabilityZone}
                onChange={(e) =>
                  setIacForm((f) => ({ ...f, vmAvailabilityZone: e.target.value as IacFormState['vmAvailabilityZone'] }))
                }
              >
                <option value="">None</option>
                <option value="1">Zone 1</option>
                <option value="2">Zone 2</option>
                <option value="3">Zone 3</option>
              </select>
            </div>
            <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fill, minmax(11rem, 1fr))' }}>
              <div>
                <label style={labelStyle}>App Service plan SKU</label>
                <input
                  style={inputStyle}
                  value={iacForm.appServicePlanSku}
                  onChange={(e) => setIacForm((f) => ({ ...f, appServicePlanSku: e.target.value }))}
                />
              </div>
              <div>
                <label style={labelStyle}>AKS node size</label>
                <input
                  style={inputStyle}
                  value={iacForm.aksNodeVmSize}
                  onChange={(e) => setIacForm((f) => ({ ...f, aksNodeVmSize: e.target.value }))}
                />
              </div>
              <div>
                <label style={labelStyle}>AKS node count</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  style={inputStyle}
                  value={iacForm.aksNodeCount}
                  onChange={(e) => setIacForm((f) => ({ ...f, aksNodeCount: parseInt(e.target.value, 10) || 1 }))}
                />
              </div>
              <div>
                <label style={labelStyle}>Storage replication</label>
                <input
                  style={inputStyle}
                  placeholder="LRS, ZRS, GRS…"
                  value={iacForm.storageReplication}
                  onChange={(e) => setIacForm((f) => ({ ...f, storageReplication: e.target.value }))}
                />
              </div>
              <div>
                <label style={labelStyle}>APIM SKU (e.g. Developer_1)</label>
                <input
                  style={inputStyle}
                  value={iacForm.apimSku}
                  onChange={(e) => setIacForm((f) => ({ ...f, apimSku: e.target.value }))}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <p style={{ color: '#94a3b8', marginBottom: '0.75rem' }}>Choose output format and generate:</p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={bicepDownloaded ? undefined : () => onGenerate('bicep')}
          disabled={generating || bicepDownloaded}
          style={downloadButtonStyle(bicepDownloaded)}
        >
          {bicepDownloaded ? 'Downloaded Bicep' : generating ? '…' : 'Download Bicep'}
        </button>
        <button
          type="button"
          onClick={terraformDownloaded ? undefined : () => onGenerate('terraform')}
          disabled={generating || terraformDownloaded}
          style={downloadButtonStyle(terraformDownloaded)}
        >
          {terraformDownloaded ? 'Downloaded Terraform' : generating ? '…' : 'Download Terraform'}
        </button>
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
