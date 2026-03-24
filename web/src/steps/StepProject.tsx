import type { ProjectConfig } from '../types';

type Props = {
  projectName: string;
  setProjectName: (s: string) => void;
  resourceGroupName: string;
  setResourceGroupName: (s: string) => void;
  /** Called when the user types in the resource group field (stops auto-sync from project name). */
  onResourceGroupManualEdit: () => void;
  /** If the field is cleared, auto-sync can resume on the next project name change. */
  onResourceGroupBlur: () => void;
  region: ProjectConfig['region'];
  setRegion: (r: ProjectConfig['region']) => void;
  environment: ProjectConfig['environment'];
  setEnvironment: (e: ProjectConfig['environment']) => void;
  regions: { value: ProjectConfig['region']; label: string }[];
  onNext: () => void;
};

export function StepProject({
  projectName,
  setProjectName,
  resourceGroupName,
  setResourceGroupName,
  onResourceGroupManualEdit,
  onResourceGroupBlur,
  region,
  setRegion,
  environment,
  setEnvironment,
  regions,
  onNext,
}: Props) {
  const valid = /^[a-z0-9-]+$/.test(projectName) && /^[a-z0-9-]*$/.test(resourceGroupName);
  return (
    <section>
      <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Project</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label>
          <span style={{ display: 'block', marginBottom: '0.25rem', color: '#94a3b8' }}>
            Project name (lowercase, hyphens allowed)
          </span>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="my-app"
            style={inputStyle}
          />
        </label>
        <label>
          <span style={{ display: 'block', marginBottom: '0.25rem', color: '#94a3b8' }}>
            Resource group name
          </span>
          <input
            type="text"
            value={resourceGroupName}
            onChange={(e) => {
              onResourceGroupManualEdit();
              setResourceGroupName(e.target.value);
            }}
            onBlur={onResourceGroupBlur}
            placeholder={projectName ? `rg-${projectName}` : 'rg-my-app'}
            style={inputStyle}
          />
        </label>
        <label>
          <span style={{ display: 'block', marginBottom: '0.25rem', color: '#94a3b8' }}>
            Azure region
          </span>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value as ProjectConfig['region'])}
            style={inputStyle}
          >
            {regions.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span style={{ display: 'block', marginBottom: '0.25rem', color: '#94a3b8' }}>
            Environment (tag + IaC parameters)
          </span>
          <select
            value={environment ?? 'dev'}
            onChange={(e) => setEnvironment(e.target.value as NonNullable<ProjectConfig['environment']>)}
            style={inputStyle}
          >
            <option value="dev">Development</option>
            <option value="stage">Staging</option>
            <option value="prod">Production</option>
          </select>
        </label>
        <button onClick={onNext} disabled={!valid} style={{ ...buttonStyle, ...(!valid && { cursor: 'not-allowed', opacity: 0.6 }) }}>
          Next: Network
        </button>
      </div>
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '6px',
  color: '#e2e8f0',
  fontSize: '1rem',
};
const buttonStyle: React.CSSProperties = {
  marginTop: '0.5rem',
  padding: '0.625rem 1rem',
  background: '#3b82f6',
  border: 'none',
  borderRadius: '6px',
  color: 'white',
  fontWeight: 600,
  cursor: 'pointer',
};
