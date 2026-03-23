// Mirrors backend ProjectConfig for API
export type AzureRegion = 'westeurope' | 'swedencentral' | 'belgiumcentral';

export interface SubnetConfig {
  name: string;
  addressPrefix: string;
}

export interface NetworkConfig {
  vnetName: string;
  addressSpace: string;
  subnets: SubnetConfig[];
}

export type AzureServiceType =
  | 'app-service'
  | 'aks'
  | 'azure-sql'
  | 'cosmos-db'
  | 'storage-account'
  | 'key-vault'
  | 'api-management'
  | 'container-apps'
  | 'vm'
  | 'vmss';

export interface VMConfig {
  enablePublicIp?: boolean;
  nicName?: string;
  vmSize?: string;
  osType?: 'Linux' | 'Windows';
  adminUsername?: string;
  osDiskSizeGb?: number;
}

export interface VMSSConfig {
  enablePublicIp?: boolean;
  nicName?: string;
  vmSize?: string;
  osType?: 'Linux' | 'Windows';
  instanceCountMin?: number;
  instanceCountMax?: number;
  scaleOutCpuPercent?: number;
  scaleInCpuPercent?: number;
}

export interface AzureService {
  type: AzureServiceType;
  name: string;
  subnetPlacement?: string;
  config: Record<string, unknown>;
}

/** Optional naming and tagging for generated IaC (Bicep + Terraform). */
export interface IacConventions {
  namePrefix?: string;
  nameSuffix?: string;
  tags?: Record<string, string>;
}

/** “Prod-ready” switches: SKUs, zones, diagnostics, private endpoints. */
export interface IacProduction {
  enableDiagnostics?: boolean;
  enablePrivateEndpoints?: boolean;
  sqlZoneRedundant?: boolean;
  vmAvailabilityZone?: string;
  appServicePlanSku?: string;
  aksNodeVmSize?: string;
  aksNodeCount?: number;
  storageReplication?: string;
  apimSku?: string;
  cosmosEnableFreeTier?: boolean;
}

export interface IacSettings {
  conventions?: IacConventions;
  production?: IacProduction;
}

export interface ProjectConfig {
  projectName: string;
  region: AzureRegion;
  resourceGroupName: string;
  network: NetworkConfig;
  services: AzureService[];
  /** Advanced IaC: tags, naming, SKUs, diagnostics. */
  iac?: IacSettings;
}

/** Matches backend catalog: shared VNet subnet required vs optional (e.g. AKS managed networking). */
export type ServiceNetworkMode = 'subnet_required' | 'subnet_optional';

export interface ServiceEntry {
  type: AzureServiceType;
  label: string;
  description: string;
  defaultSubnet: string;
  networkMode: ServiceNetworkMode;
  /** How this service connects to others (UI hint). */
  integrationNotes?: string;
}
