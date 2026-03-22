import { useState, useCallback, useEffect } from 'react';
import type { ProjectConfig, NetworkConfig, AzureService, ServiceEntry } from './types';
import { StepProject } from './steps/StepProject';
import { StepNetwork } from './steps/StepNetwork';
import { StepServices } from './steps/StepServices';
import { StepSummary } from './steps/StepSummary';
import { Login } from './steps/Login';
import { Register } from './steps/Register';
import { ForgotPassword } from './steps/ForgotPassword';
import { ResetPassword } from './steps/ResetPassword';
import { Dashboard } from './steps/Dashboard';
import { HelpPage } from './steps/HelpPage';
import { errorMessageFromApi } from './rateLimitMessage';

const AUTH_TOKEN_KEY = 'cloud-builder-token';

const REGIONS: { value: ProjectConfig['region']; label: string }[] = [
  { value: 'westeurope', label: 'West Europe' },
  { value: 'swedencentral', label: 'Sweden Central' },
  { value: 'belgiumcentral', label: 'Belgium Central' },
];

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

const headerLinkStyle: React.CSSProperties = {
  padding: '0.25rem 0.5rem',
  background: 'transparent',
  border: '1px solid #475569',
  borderRadius: '4px',
  color: '#94a3b8',
  fontSize: '0.8125rem',
  cursor: 'pointer',
};

export default function App() {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem(AUTH_TOKEN_KEY));
  const [view, setView] = useState<'dashboard' | 'wizard'>('dashboard');
  const [showRegister, setShowRegister] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [resetTokenFromUrl, setResetTokenFromUrl] = useState<string | null>(() =>
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') : null
  );
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

  const setToken = useCallback((t: string) => {
    setTokenState(t);
    localStorage.setItem(AUTH_TOKEN_KEY, t);
  }, []);
  const logout = useCallback(async () => {
    const t = localStorage.getItem(AUTH_TOKEN_KEY);
    if (t) {
      try {
        await fetch('/api/logout', { method: 'POST', headers: { Authorization: `Bearer ${t}` } });
      } catch {
        /* ignore — still clear client session */
      }
    }
    setTokenState(null);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setView('dashboard');
  }, []);

  const goToDashboard = useCallback(() => {
    setView('dashboard');
    setStep(1);
    setProjectName('');
    setResourceGroupName('');
    setRegion('westeurope');
    setNetwork(null);
    setServices([]);
    setError(null);
    setDownloadedFormats([]);
  }, []);

  useEffect(() => {
    if (!token) setCatalog([]);
  }, [token]);

  const fetchCatalog = useCallback(async () => {
    if (!token || catalog.length > 0) return;
    const res = await fetch('/api/catalog', { headers: authHeaders(token) });
    if (res.status === 401) {
      logout();
      return;
    }
    const data = await res.json();
    setCatalog(data.services || []);
  }, [token, catalog.length, logout]);

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

  if (!token) {
    const clearResetUrl = () => {
      window.history.replaceState({}, '', window.location.pathname || '/');
      setResetTokenFromUrl(null);
    };
    if (showHelp) {
      return (
        <>
          <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>Cloud Builder</h1>
            <p style={{ color: '#94a3b8', marginTop: '0.25rem' }}>Azure infrastructure wizard</p>
          </header>
          <HelpPage onBack={() => setShowHelp(false)} />
        </>
      );
    }
    return (
      <>
        <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>Cloud Builder</h1>
          <p style={{ color: '#94a3b8', marginTop: '0.25rem' }}>Azure infrastructure wizard</p>
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            style={{
              marginTop: '0.5rem',
              padding: '0.25rem 0.5rem',
              background: 'transparent',
              border: '1px solid #475569',
              borderRadius: '4px',
              color: '#94a3b8',
              fontSize: '0.8125rem',
              cursor: 'pointer',
            }}
          >
            Help
          </button>
        </header>
        {resetTokenFromUrl ? (
          <ResetPassword
            token={resetTokenFromUrl}
            onSuccess={clearResetUrl}
            onBackToLogin={clearResetUrl}
          />
        ) : showForgotPassword ? (
          <ForgotPassword onBackToLogin={() => setShowForgotPassword(false)} />
        ) : showRegister ? (
          <Register
            onRegistered={() => setShowRegister(false)}
            onGoLogin={() => setShowRegister(false)}
          />
        ) : (
          <Login
            onLogin={setToken}
            onGoRegister={() => setShowRegister(true)}
            onForgotPassword={() => setShowForgotPassword(true)}
          />
        )}
      </>
    );
  }

  if (token && showHelp) {
    return (
      <>
        <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>Cloud Builder</h1>
          <p style={{ color: '#94a3b8', marginTop: '0.25rem' }}>Azure infrastructure wizard</p>
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setShowHelp(false)} style={headerLinkStyle}>← Back</button>
            <button type="button" onClick={() => { setShowHelp(false); setView('dashboard'); }} style={headerLinkStyle}>My generations</button>
            <button type="button" onClick={logout} style={headerLinkStyle}>Sign out</button>
          </div>
        </header>
        <HelpPage onBack={() => setShowHelp(false)} />
      </>
    );
  }
  if (token && view === 'dashboard') {
    return (
      <>
        <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>Cloud Builder</h1>
          <p style={{ color: '#94a3b8', marginTop: '0.25rem' }}>Azure infrastructure wizard</p>
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setShowHelp(true)} style={headerLinkStyle}>Help</button>
            <button type="button" onClick={logout} style={headerLinkStyle}>Sign out</button>
          </div>
        </header>
        <Dashboard token={token} onGenerateNew={() => setView('wizard')} />
      </>
    );
  }

  return (
    <>
      <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>Cloud Builder</h1>
        <p style={{ color: '#94a3b8', marginTop: '0.25rem' }}>Azure infrastructure wizard</p>
        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setShowHelp(true)} style={headerLinkStyle}>Help</button>
          <button type="button" onClick={goToDashboard} style={headerLinkStyle}>My generations</button>
          <button type="button" onClick={logout} style={headerLinkStyle}>Sign out</button>
        </div>
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
          authToken={token}
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
                headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
                body: JSON.stringify({ config, format }),
              });
              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(errorMessageFromApi(res, data, res.statusText));
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
          onBackToStart={() => goToDashboard()}
        />
      )}

      {error && (
        <p style={{ color: '#f87171', marginTop: '1rem', fontSize: '0.875rem' }}>{error}</p>
      )}
    </>
  );
}
