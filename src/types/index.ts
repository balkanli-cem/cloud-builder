export type AzureRegion = 'westeurope' | 'swedencentral' | 'belgiumcentral';

export type OutputFormat = 'bicep' | 'terraform';

export type SubnetName = 'Backend' | 'Frontend' | 'DB' | string;

export interface SubnetConfig {
  name: SubnetName;
  addressPrefix: string; // e.g. "10.0.1.0/24"
}

export interface NetworkConfig {
  vnetName: string;
  addressSpace: string; // e.g. "10.0.0.0/16"
  subnets: SubnetConfig[];
}

/** Optional naming and tagging for generated IaC (Bicep + Terraform). */
export interface IacConventions {
  /** Prepended to logical resource names (sanitized). */
  namePrefix?: string;
  /** Appended to logical resource names (sanitized). */
  nameSuffix?: string;
  /** Merged with a default `Project` tag. */
  tags?: Record<string, string>;
}

/** “Prod-ready” switches: SKUs, zones, diagnostics, private endpoints. */
export interface IacProduction {
  /** Create Log Analytics + monitor diagnostic settings for supported resources. */
  enableDiagnostics?: boolean;
  /** Add private endpoints for Storage + Key Vault where implemented (requires subnet). */
  enablePrivateEndpoints?: boolean;
  /** Set on Azure SQL database when SKU supports it. */
  sqlZoneRedundant?: boolean;
  /** VM / VMSS: pin to zone `"1"` | `"2"` | `"3"` (empty = no zone). */
  vmAvailabilityZone?: string;
  /** App Service plan SKU, e.g. B1, P1v3. */
  appServicePlanSku?: string;
  /** AKS default node pool VM size. */
  aksNodeVmSize?: string;
  /** AKS default node pool node count. */
  aksNodeCount?: number;
  /** Storage account replication: LRS, GRS, ZRS, GZRS, RAGRS, RAGZRS. */
  storageReplication?: string;
  /** API Management SKU name, e.g. Developer_1, Standard_1. */
  apimSku?: string;
  /** When true, request Cosmos free tier (if available in region). */
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

/** Options when type is 'vm' */
export interface VMConfig {
  enablePublicIp?: boolean;
  nicName?: string;
  vmSize?: string;
  osType?: 'Linux' | 'Windows';
  adminUsername?: string;
  osDiskSizeGb?: number;
}

/** Options when type is 'vmss' */
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
  subnetPlacement?: SubnetName;
  config: Record<string, unknown>;
}
