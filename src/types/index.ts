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

export interface ProjectConfig {
  projectName: string;
  region: AzureRegion;
  resourceGroupName: string;
  network: NetworkConfig;
  services: AzureService[];
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
