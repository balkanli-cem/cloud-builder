// Catalog of available Azure services shown in the service-selection screen
import type { AzureServiceType } from '../../types/index';

export interface ServiceEntry {
  type: AzureServiceType;
  label: string;
  description: string;
  defaultSubnet: string;
}

export const SERVICE_CATALOG: ServiceEntry[] = [
  {
    type: 'app-service',
    label: 'App Service',
    description: 'Managed PaaS for web apps and APIs',
    defaultSubnet: 'Frontend',
  },
  {
    type: 'aks',
    label: 'Azure Kubernetes Service (AKS)',
    description: 'Managed Kubernetes cluster',
    defaultSubnet: 'Backend',
  },
  {
    type: 'azure-sql',
    label: 'Azure SQL Database',
    description: 'Fully managed relational database',
    defaultSubnet: 'DB',
  },
  {
    type: 'cosmos-db',
    label: 'Cosmos DB',
    description: 'Globally distributed NoSQL database',
    defaultSubnet: 'DB',
  },
  {
    type: 'storage-account',
    label: 'Storage Account',
    description: 'Blob, file, queue and table storage',
    defaultSubnet: 'Backend',
  },
  {
    type: 'key-vault',
    label: 'Key Vault',
    description: 'Secrets, keys and certificate management',
    defaultSubnet: 'Backend',
  },
  {
    type: 'api-management',
    label: 'API Management',
    description: 'API gateway and developer portal',
    defaultSubnet: 'Frontend',
  },
  {
    type: 'container-apps',
    label: 'Container Apps',
    description: 'Serverless containers with auto-scaling',
    defaultSubnet: 'Backend',
  },
  {
    type: 'vm',
    label: 'Virtual Machine (VM)',
    description: 'Single Linux or Windows VM with configurable NIC and public IP',
    defaultSubnet: 'Backend',
  },
  {
    type: 'vmss',
    label: 'Virtual Machine Scale Set (VMSS)',
    description: 'Auto-scaling set of VMs with horizontal scale rules',
    defaultSubnet: 'Backend',
  },
];
