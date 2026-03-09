import type { ProjectConfig } from '../../types/index';

export function renderMainBicep(config: ProjectConfig): string {
  const subnetArray = config.network.subnets
    .map(s => `      {\n        name: '${s.name}'\n        addressPrefix: '${s.addressPrefix}'\n      }`)
    .join('\n');

  const moduleBlocks = config.services
    .map(svc => {
      const subnetRef = svc.subnetPlacement
        ? `network.outputs.subnetIds['${svc.subnetPlacement}']`
        : `network.outputs.subnetIds['${config.network.subnets[0].name}']`;

      return `module ${toIdentifier(svc.name)} './modules/${svc.type}.bicep' = {
  name: '${svc.name}-deployment'
  dependsOn: [network]
  params: {
    location: location
    name: '${svc.name}'
    subnetId: ${subnetRef}
  }
}`;
    })
    .join('\n\n');

  return `targetScope = 'resourceGroup'

@description('Azure region for all resources.')
param location string = '${config.region}'

// ─── Network ──────────────────────────────────────────────────────────────────

module network './modules/network.bicep' = {
  name: 'network-deployment'
  params: {
    location: location
    vnetName: '${config.network.vnetName}'
    addressSpace: '${config.network.addressSpace}'
    subnets: [
${subnetArray}
    ]
  }
}

// ─── Services ─────────────────────────────────────────────────────────────────

${moduleBlocks}
`;
}

function toIdentifier(name: string): string {
  // Convert kebab-case resource names to valid Bicep identifiers (camelCase)
  return name
    .split('-')
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}
