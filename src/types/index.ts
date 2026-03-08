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
  | 'container-apps';

export interface AzureService {
  type: AzureServiceType;
  name: string;
  subnetPlacement?: SubnetName;
  config: Record<string, unknown>;
}
