import type { ProjectConfig, AzureService, VMConfig, VMSSConfig } from '../../types/index';

function subnetRef(svc: AzureService, config: ProjectConfig): string {
  return svc.subnetPlacement
    ? `network.outputs.subnetIds['${svc.subnetPlacement}']`
    : `network.outputs.subnetIds['${config.network.subnets[0].name}']`;
}

export function renderMainBicep(config: ProjectConfig): string {
  const subnetArray = config.network.subnets
    .map(s => `      {\n        name: '${s.name}'\n        addressPrefix: '${s.addressPrefix}'\n      }`)
    .join('\n');

  const hasVm = config.services.some(s => s.type === 'vm');
  const hasVmss = config.services.some(s => s.type === 'vmss');
  const needsSecureParam = hasVm || hasVmss;

  const moduleBlocks = config.services
    .map(svc => {
      const subnetRefStr = subnetRef(svc, config);
      if (svc.type === 'vm') {
        const c = (svc.config || {}) as VMConfig;
        const enablePublicIp = c.enablePublicIp !== false;
        const nicName = (c.nicName ?? `${svc.name}-nic`).replace(/'/g, "''");
        const vmSize = (c.vmSize ?? 'Standard_B2s').replace(/'/g, "''");
        const osType = (c.osType ?? 'Linux').replace(/'/g, "''");
        const adminUsername = (c.adminUsername ?? 'azureuser').replace(/'/g, "''");
        const osDiskSizeGb = c.osDiskSizeGb ?? 30;
        return `module ${toIdentifier(svc.name)} './modules/${svc.type}.bicep' = {
  name: '${svc.name}-deployment'
  dependsOn: [network]
  params: {
    location: location
    name: '${svc.name}'
    subnetId: ${subnetRefStr}
    enablePublicIp: ${enablePublicIp}
    nicName: '${nicName}'
    vmSize: '${vmSize}'
    osType: '${osType}'
    adminUsername: '${adminUsername}'
    osDiskSizeGb: ${osDiskSizeGb}
    adminPasswordOrKey: adminPasswordOrKey
  }
}`;
      }
      if (svc.type === 'vmss') {
        const c = (svc.config || {}) as VMSSConfig;
        const nicName = (c.nicName ?? `${svc.name}-nic`).replace(/'/g, "''");
        const vmSize = (c.vmSize ?? 'Standard_B2s').replace(/'/g, "''");
        const osType = (c.osType ?? 'Linux').replace(/'/g, "''");
        const instanceCountMin = c.instanceCountMin ?? 1;
        const instanceCountMax = c.instanceCountMax ?? 10;
        const scaleOutCpuPercent = c.scaleOutCpuPercent ?? 70;
        const scaleInCpuPercent = c.scaleInCpuPercent ?? 30;
        return `module ${toIdentifier(svc.name)} './modules/${svc.type}.bicep' = {
  name: '${svc.name}-deployment'
  dependsOn: [network]
  params: {
    location: location
    name: '${svc.name}'
    subnetId: ${subnetRefStr}
    nicName: '${nicName}'
    vmSize: '${vmSize}'
    osType: '${osType}'
    instanceCountMin: ${instanceCountMin}
    instanceCountMax: ${instanceCountMax}
    scaleOutCpuPercent: ${scaleOutCpuPercent}
    scaleInCpuPercent: ${scaleInCpuPercent}
    adminPasswordOrKey: adminPasswordOrKey
  }
}`;
      }
      return `module ${toIdentifier(svc.name)} './modules/${svc.type}.bicep' = {
  name: '${svc.name}-deployment'
  dependsOn: [network]
  params: {
    location: location
    name: '${svc.name}'
    subnetId: ${subnetRefStr}
  }
}`;
    })
    .join('\n\n');

  const secureParamBlock =
    needsSecureParam
      ? `
@secure()
@description('SSH public key (Linux) or admin password (Windows) for VM/VMSS.')
param adminPasswordOrKey string
`
      : '';

  return `targetScope = 'resourceGroup'

@description('Azure region for all resources.')
param location string = '${config.region}'${secureParamBlock}

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
