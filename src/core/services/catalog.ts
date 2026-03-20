// Catalog of available Azure services shown in the service-selection screen
import type { AzureServiceType } from '../../types/index';

/** Shared VNet usage: required = must use a wizard subnet; optional = can use managed networking (e.g. AKS Kubenet) or attach to a subnet. */
export type ServiceNetworkMode = 'subnet_required' | 'subnet_optional';

export interface ServiceEntry {
  type: AzureServiceType;
  label: string;
  description: string;
  defaultSubnet: string;
  networkMode: ServiceNetworkMode;
  /** How this service often connects to others (shown in UI only). */
  integrationNotes?: string;
}

export const SERVICE_CATALOG: ServiceEntry[] = [
  {
    type: 'app-service',
    label: 'App Service',
    description: 'Managed PaaS for web apps and APIs',
    defaultSubnet: 'Frontend',
    networkMode: 'subnet_required',
    integrationNotes: 'Often fronted by API Management; connects to backends in other subnets via private endpoints.',
  },
  {
    type: 'aks',
    label: 'Azure Kubernetes Service (AKS)',
    description: 'Managed Kubernetes — can use its own networking (Kubenet) or your VNet (Azure CNI)',
    defaultSubnet: 'Backend',
    networkMode: 'subnet_optional',
    integrationNotes: 'Typical pattern: ingress in-cluster + private link to Key Vault, ACR, or Azure SQL. App Service or API Management can sit in front.',
  },
  {
    type: 'azure-sql',
    label: 'Azure SQL Database',
    description: 'Fully managed relational database',
    defaultSubnet: 'DB',
    networkMode: 'subnet_required',
    integrationNotes: 'Private endpoint in DB subnet; allow access from app subnets via VNet rules or private link.',
  },
  {
    type: 'cosmos-db',
    label: 'Cosmos DB',
    description: 'Globally distributed NoSQL database',
    defaultSubnet: 'DB',
    networkMode: 'subnet_required',
    integrationNotes: 'Use private endpoint from application subnets; pair with Key Vault for keys.',
  },
  {
    type: 'storage-account',
    label: 'Storage Account',
    description: 'Blob, file, queue and table storage',
    defaultSubnet: 'Backend',
    networkMode: 'subnet_required',
    integrationNotes: 'Restrict to trusted subnets or private endpoints; used by VMs, AKS, and App Service mounts.',
  },
  {
    type: 'key-vault',
    label: 'Key Vault',
    description: 'Secrets, keys and certificate management',
    defaultSubnet: 'Backend',
    networkMode: 'subnet_required',
    integrationNotes: 'Reference from App Service, AKS, or VMs; use private endpoint and managed identities.',
  },
  {
    type: 'api-management',
    label: 'API Management',
    description: 'API gateway and developer portal',
    defaultSubnet: 'Frontend',
    networkMode: 'subnet_required',
    integrationNotes: 'External or internal; routes to App Service, AKS ingress, or Container Apps.',
  },
  {
    type: 'container-apps',
    label: 'Container Apps',
    description: 'Serverless containers with auto-scaling',
    defaultSubnet: 'Backend',
    networkMode: 'subnet_required',
    integrationNotes: 'Shares patterns with AKS; often uses Container Apps Environment with dedicated subnet.',
  },
  {
    type: 'vm',
    label: 'Virtual Machine (VM)',
    description: 'Single Linux or Windows VM with configurable NIC and public IP',
    defaultSubnet: 'Backend',
    networkMode: 'subnet_required',
    integrationNotes: 'Reach Storage, SQL private endpoints, or peered VNets from the same or connected subnets.',
  },
  {
    type: 'vmss',
    label: 'Virtual Machine Scale Set (VMSS)',
    description: 'Auto-scaling set of VMs with horizontal scale rules',
    defaultSubnet: 'Backend',
    networkMode: 'subnet_required',
    integrationNotes: 'Same as VM: place with backends that call databases or internal APIs.',
  },
];
