import type { ProjectConfig, AzureService, VMConfig, VMSSConfig } from '../../types/index';
import { projectUsesSharedNetwork, serviceUsesSharedSubnet } from '../../core/services/networkPolicy';
import { getIacSettings, omitEnvironmentTag } from '../../core/iac/conventions';
import { renderBicepObjectLiteral } from '../../core/iac/bicepSerialize';

function subnetRef(svc: AzureService, config: ProjectConfig): string {
  return svc.subnetPlacement
    ? `network.outputs.subnetIds['${svc.subnetPlacement}']`
    : `network.outputs.subnetIds['${config.network.subnets[0]?.name ?? 'Backend'}']`;
}

function networkDependsOn(svc: AzureService): string {
  return serviceUsesSharedSubnet(svc) ? 'dependsOn: [network]\n  ' : '';
}

export function renderMainBicep(config: ProjectConfig): string {
  const iac = getIacSettings(config);
  const tagsLiteral = renderBicepObjectLiteral(omitEnvironmentTag(iac.tags));
  const envEsc = iac.environment.replace(/'/g, "''");
  const vmZoneEsc = iac.vmAvailabilityZone.replace(/'/g, "''");
  const apimParts = iac.apimSku.split('_');
  const apimSkuName = apimParts[0] ?? 'Developer';
  const apimSkuCapacity = apimParts[1] ? parseInt(apimParts[1], 10) : 1;
  const iacParams = `
@description('Deployment environment (dev, stage, prod). Merged into resource tags.')
param environment string = '${envEsc}'
param tags object = ${tagsLiteral}
param appServicePlanSku string = '${iac.appServicePlanSku}'
param aksNodeVmSize string = '${iac.aksNodeVmSize}'
param aksNodeCount int = ${iac.aksNodeCount}
param storageSkuName string = 'Standard_${iac.storageReplication}'
param sqlZoneRedundant bool = ${iac.sqlZoneRedundant}
param apimSkuName string = '${apimSkuName}'
param apimSkuCapacity int = ${Number.isFinite(apimSkuCapacity) ? apimSkuCapacity : 1}
param cosmosEnableFreeTier bool = ${iac.cosmosEnableFreeTier}
param enablePrivateEndpoints bool = ${iac.enablePrivateEndpoints}
param vmAvailabilityZone string = '${vmZoneEsc}'
`;

  const includeNetwork = projectUsesSharedNetwork(config.services);
  const subnetArray = config.network.subnets
    .map(s => `      {\n        name: '${s.name}'\n        addressPrefix: '${s.addressPrefix}'\n      }`)
    .join('\n');

  const hasVm = config.services.some(s => s.type === 'vm');
  const hasVmss = config.services.some(s => s.type === 'vmss');
  const needsSecureParam = hasVm || hasVmss;

  const moduleBlocks = config.services
    .map(svc => {
      const usesShared = serviceUsesSharedSubnet(svc);
      const subnetRefStr = subnetRef(svc, config);
      const dep = networkDependsOn(svc);

      if (svc.type === 'aks') {
        const attach = usesShared;
        return `module ${toIdentifier(svc.name)} './modules/${svc.type}.bicep' = {
  name: '${svc.name}-deployment'
  ${dep}params: {
    location: location
    name: '${svc.name}'
    attachToSubnet: ${attach}
    subnetId: ${attach ? subnetRefStr : "''"}
    tags: mergedTags
    aksNodeVmSize: aksNodeVmSize
    aksNodeCount: aksNodeCount
  }
}`;
      }
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
  ${dep}params: {
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
    tags: mergedTags
    vmAvailabilityZone: vmAvailabilityZone
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
  ${dep}params: {
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
    tags: mergedTags
    vmAvailabilityZone: vmAvailabilityZone
  }
}`;
      }
      if (svc.type === 'app-service') {
        return `module ${toIdentifier(svc.name)} './modules/${svc.type}.bicep' = {
  name: '${svc.name}-deployment'
  ${dep}params: {
    location: location
    name: '${svc.name}'
    subnetId: ${subnetRefStr}
    tags: mergedTags
    appServicePlanSku: appServicePlanSku
  }
}`;
      }
      if (svc.type === 'azure-sql') {
        return `module ${toIdentifier(svc.name)} './modules/${svc.type}.bicep' = {
  name: '${svc.name}-deployment'
  ${dep}params: {
    location: location
    name: '${svc.name}'
    subnetId: ${subnetRefStr}
    tags: mergedTags
    sqlZoneRedundant: sqlZoneRedundant
  }
}`;
      }
      if (svc.type === 'storage-account') {
        return `module ${toIdentifier(svc.name)} './modules/${svc.type}.bicep' = {
  name: '${svc.name}-deployment'
  ${dep}params: {
    location: location
    name: '${svc.name}'
    subnetId: ${subnetRefStr}
    tags: mergedTags
    storageSkuName: storageSkuName
    enablePrivateEndpoints: enablePrivateEndpoints
  }
}`;
      }
      if (svc.type === 'key-vault') {
        return `module ${toIdentifier(svc.name)} './modules/${svc.type}.bicep' = {
  name: '${svc.name}-deployment'
  ${dep}params: {
    location: location
    name: '${svc.name}'
    subnetId: ${subnetRefStr}
    tags: mergedTags
    enablePrivateEndpoints: enablePrivateEndpoints
  }
}`;
      }
      if (svc.type === 'api-management') {
        return `module ${toIdentifier(svc.name)} './modules/${svc.type}.bicep' = {
  name: '${svc.name}-deployment'
  ${dep}params: {
    location: location
    name: '${svc.name}'
    subnetId: ${subnetRefStr}
    tags: mergedTags
    apimSkuName: apimSkuName
    apimSkuCapacity: apimSkuCapacity
  }
}`;
      }
      if (svc.type === 'cosmos-db') {
        return `module ${toIdentifier(svc.name)} './modules/${svc.type}.bicep' = {
  name: '${svc.name}-deployment'
  ${dep}params: {
    location: location
    name: '${svc.name}'
    subnetId: ${subnetRefStr}
    tags: mergedTags
    cosmosEnableFreeTier: cosmosEnableFreeTier
  }
}`;
      }
      if (svc.type === 'container-apps') {
        return `module ${toIdentifier(svc.name)} './modules/${svc.type}.bicep' = {
  name: '${svc.name}-deployment'
  ${dep}params: {
    location: location
    name: '${svc.name}'
    subnetId: ${subnetRefStr}
    tags: mergedTags
  }
}`;
      }
      if (svc.type === 'azure-ai-search') {
        const attach = usesShared;
        return `module ${toIdentifier(svc.name)} './modules/${svc.type}.bicep' = {
  name: '${svc.name}-deployment'
  ${dep}params: {
    location: location
    name: '${svc.name}'
    attachToSubnet: ${attach}
    subnetId: ${attach ? subnetRefStr : "''"}
    tags: mergedTags
  }
}`;
      }
      if (svc.type === 'azure-machine-learning' || svc.type === 'azure-ai-foundry') {
        const kind = svc.type === 'azure-ai-foundry' ? 'Hub' : 'Default';
        return `module ${toIdentifier(svc.name)} './modules/${svc.type}.bicep' = {
  name: '${svc.name}-deployment'
  ${dep}params: {
    location: location
    name: '${svc.name}'
    workspaceKind: '${kind}'
    subnetId: ${subnetRefStr}
    tenantId: subscription().tenantId
    tags: mergedTags
  }
}`;
      }
      return `module ${toIdentifier(svc.name)} './modules/${svc.type}.bicep' = {
  name: '${svc.name}-deployment'
  ${dep}params: {
    location: location
    name: '${svc.name}'
    subnetId: ${subnetRefStr}
    tags: mergedTags
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

  const networkBlock = includeNetwork
    ? `
// ─── Shared virtual network (only when at least one service uses it) ─────────

module network './modules/network.bicep' = {
  name: 'network-deployment'
  params: {
    location: location
    vnetName: '${config.network.vnetName}'
    addressSpace: '${config.network.addressSpace}'
    subnets: [
${subnetArray}
    ]
    tags: mergedTags
  }
}
`
    : `
// No shared VNet module: all services use managed networking or do not require this VNet.
`;

  return `targetScope = 'resourceGroup'

@description('Azure region for all resources.')
param location string = '${config.region}'${iacParams}${secureParamBlock}

var mergedTags = union(tags, { Environment: environment })

${networkBlock}
// ─── Services ─────────────────────────────────────────────────────────────────

${moduleBlocks}
`;
}

/** Example Bicep parameters file for multi-environment deploys (copy/adjust per env). */
export function renderMainBicepparam(config: ProjectConfig): string {
  const iac = getIacSettings(config);
  const locEsc = config.region.replace(/'/g, "''");
  const envEsc = iac.environment.replace(/'/g, "''");
  return `using './main.bicep'

param location = '${locEsc}'
param environment = '${envEsc}'
`;
}

function toIdentifier(name: string): string {
  // Convert kebab-case resource names to valid Bicep identifiers (camelCase)
  return name
    .split('-')
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}
