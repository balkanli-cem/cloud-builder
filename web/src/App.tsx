import { useState, useCallback } from 'react';
import type { ProjectConfig, NetworkConfig, AzureService, ServiceEntry } from './types';
import { StepProject } from './steps/StepProject';
import { StepNetwork } from './steps/StepNetwork';
import { StepServices } from './steps/StepServices';
import { StepSummary } from './steps/StepSummary';

const REGIONS: { value: ProjectConfig['region']; label: string }[] = [
  { value: 'westeurope', label: 'West Europe' },
  { value: 'swedencentral', label: 'Sweden Central' },
  { value: 'belgiumcentral', label: 'Belgium Central' },
];

export default function App() {
  const [step, setStep] = useState(1);
  const [projectName, setProjectName] = useState('');
  const [resourceGroupName, setResourceGroupName] = useState('');
  const [region, setRegion] = useState<ProjectConfig['region']>('westeurope');
  const [network, setNetwork] = useState<NetworkConfig | null>(null);
  const [services, setServices] = useState<AzureService[]>([]);
  const [catalog, setCatalog] = useState<ServiceEntry[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadedFormats, setDownloadedFormats] = useState<('bicep' | 'terraform')[]>([]);

  const fetchCatalog = useCallback(async () => {
    if (catalog.length > 0) return;
    const res = await fetch('/api/catalog');
    const data = await res.json();
    setCatalog(data.services || []);
  }, [catalog.length]);

  const config: ProjectConfig | null =
    projectName && network && services.length > 0
      ? {
          projectName,
          resourceGroupName: resourceGroupName || `${projectName}-rg`,
          region,
          network,
          services,
        }
      : null;

  return (
    <>
      <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>Cloud Builder</h1>
        <p style={{ color: '#94a3b8', marginTop: '0.25rem' }}>Azure infrastructure wizard</p>
      </header>

      {step === 1 && (
        <StepProject
          projectName={projectName}
          setProjectName={setProjectName}
          resourceGroupName={resourceGroupName}
          setResourceGroupName={setResourceGroupName}
          region={region}
          setRegion={setRegion}
          regions={REGIONS}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <StepNetwork
          projectName={projectName}
          network={network}
          setNetwork={setNetwork}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && (
        <StepServices
          projectName={projectName}
          network={network!}
          services={services}
          setServices={setServices}
          catalog={catalog}
          fetchCatalog={fetchCatalog}
          onNext={() => setStep(4)}
          onBack={() => setStep(2)}
        />
      )}
      {step === 4 && config && (
        <StepSummary
          config={config}
          generating={generating}
          error={error}
          downloadedFormats={downloadedFormats}
          onGenerate={async (format: 'bicep' | 'terraform') => {
            setError(null);
            setGenerating(true);
            try {
              const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config, format }),
              });
              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || res.statusText);
              }
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${config.projectName}-${format}.zip`;
              a.click();
              URL.revokeObjectURL(url);
              setDownloadedFormats((prev) => (prev.includes(format) ? prev : [...prev, format]));
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Download failed');
            } finally {
              setGenerating(false);
            }
          }}
          onBack={() => {
            setStep(3);
            setDownloadedFormats([]);
          }}
          onBackToStart={() => {
            setStep(1);
            setProjectName('');
            setResourceGroupName('');
            setRegion('westeurope');
            setNetwork(null);
            setServices([]);
            setError(null);
            setDownloadedFormats([]);
          }}
        />
      )}

      {error && (
        <p style={{ color: '#f87171', marginTop: '1rem', fontSize: '0.875rem' }}>{error}</p>
      )}
    </>
  );
}
