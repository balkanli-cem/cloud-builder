import type { ProjectConfig } from '../types';
import { InfoIcon } from '../components/InfoIcon';

type Props = {
  projectName: string;
  setProjectName: (s: string) => void;
  resourceGroupName: string;
  setResourceGroupName: (s: string) => void;
  region: ProjectConfig['region'];
  setRegion: (r: ProjectConfig['region']) => void;
  regions: { value: ProjectConfig['region']; label: string }[];
  onNext: () => void;
};

export function StepProject({
  projectName,
  setProjectName,
  resourceGroupName,
  setResourceGroupName,
  region,
  setRegion,
  regions,
  onNext,
}: Props) {
  const valid = /^[a-z0-9-]+$/.test(projectName) && /^[a-z0-9-]*$/.test(resourceGroupName);
  return (
    <section>
      <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem', display: 'inline-flex', alignItems: 'center' }}>
        Project
        <InfoIcon text="Basic identifiers for your deployment. These names are used in the generated Bicep or Terraform and must follow Azure naming rules (lowercase letters, numbers, hyphens)." placement="below" />
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label>
          <span style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem', color: '#94a3b8', gap: '0.25rem' }}>
            Project name (lowercase, hyphens allowed)
            <InfoIcon text="Used as a prefix for resource names (e.g. VNet, subnets). Must be unique within your design." />
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
          <span style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem', color: '#94a3b8', gap: '0.25rem' }}>
            Resource group name
            <InfoIcon text="Azure resource groups hold all resources for this project. Often named like project-rg. Leave blank to use project-name-rg." />
          </span>
          <input
            type="text"
            value={resourceGroupName}
            onChange={(e) => setResourceGroupName(e.target.value)}
            placeholder={projectName ? `${projectName}-rg` : ''}
            style={inputStyle}
          />
        </label>
        <label>
          <span style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem', color: '#94a3b8', gap: '0.25rem' }}>
            Azure region
            <InfoIcon text="Where your resources will be deployed. Choose a region close to your users or that meets compliance needs." />
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
