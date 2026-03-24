// Catalog of available Azure services shown in the service-selection screen
import type { AzureServiceType } from '../../types/index';

/** Shared VNet usage: required = must use a wizard subnet; optional = can use managed networking (e.g. AKS Kubenet) or attach to a subnet. */
export type ServiceNetworkMode = 'subnet_required' | 'subnet_optional';

/**
 * UI grouping (Azure RP–aligned) for card colors on the Services step.
 * compute ≈ Microsoft.Compute · containers ≈ AKS / Container Apps · data ≈ databases & storage · web ≈ App Service · integration · security.
 */
export type ServiceUiCategory =
  | 'compute'
  | 'containers'
  | 'data'
  | 'web'
  | 'integration'
  | 'security';

/** In-app “what this creates”: cost, teardown, and links (not legal/financial advice). */
export interface ServiceWhatCreates {
  /** Short list of Azure resources emitted by the generator for this type. */
  createsSummary: string;
  /** Factors that most affect cost for this template. */
  costLevers: string[];
  /** Suggested destroy order for resources in this stack (relative ordering). */
  destroyOrder: string;
  /** Azure or Microsoft pricing overview for the product. */
  pricingUrl: string;
  /** Primary product documentation on learn.microsoft.com. */
  docsUrl: string;
}

export interface ServiceEntry {
  type: AzureServiceType;
  label: string;
  description: string;
  defaultSubnet: string;
  networkMode: ServiceNetworkMode;
  /** Card color group on the Services step. */
  uiCategory: ServiceUiCategory;
  /** How this service often connects to others (shown in UI only). */
  integrationNotes?: string;
  whatCreates?: ServiceWhatCreates;
}

export const SERVICE_CATALOG: ServiceEntry[] = [
  {
    type: 'app-service',
    label: 'App Service',
    description: 'Managed PaaS for web apps and APIs',
    defaultSubnet: 'Frontend',
    networkMode: 'subnet_required',
    uiCategory: 'web',
    integrationNotes: 'Often fronted by API Management; connects to backends in other subnets via private endpoints.',
    whatCreates: {
      createsSummary: 'App Service plan (Linux) and Linux web app with VNet integration to your subnet.',
      costLevers: ['Plan SKU and tier (Basic / Standard / Premium v3)', 'Always-on and scale-out settings outside this template'],
      destroyOrder: 'Delete the web app, then the plan if no other apps use it.',
      pricingUrl: 'https://azure.microsoft.com/pricing/details/app-service/',
      docsUrl: 'https://learn.microsoft.com/azure/app-service/overview',
    },
  },
  {
    type: 'aks',
    label: 'Azure Kubernetes Service (AKS)',
    description: 'Managed Kubernetes — can use its own networking (Kubenet) or your VNet (Azure CNI)',
    defaultSubnet: 'Backend',
    networkMode: 'subnet_optional',
    uiCategory: 'containers',
    integrationNotes: 'Typical pattern: ingress in-cluster + private link to Key Vault, ACR, or Azure SQL. App Service or API Management can sit in front.',
    whatCreates: {
      createsSummary: 'AKS cluster with one system node pool (Kubenet or Azure CNI + subnet).',
      costLevers: ['VM size and node count', 'Uptime (always running)', 'Optional add-ons (monitoring, registry) not in this template'],
      destroyOrder: 'User workloads and ingress first, then node pool, then the AKS resource.',
      pricingUrl: 'https://azure.microsoft.com/pricing/details/kubernetes-service/',
      docsUrl: 'https://learn.microsoft.com/azure/aks/introduction',
    },
  },
  {
    type: 'azure-sql',
    label: 'Azure SQL Database',
    description: 'Fully managed relational database',
    defaultSubnet: 'DB',
    networkMode: 'subnet_required',
    uiCategory: 'data',
    integrationNotes: 'Private endpoint in DB subnet; allow access from app subnets via VNet rules or private link.',
    whatCreates: {
      createsSummary: 'SQL server (random admin password), serverless GP database, and VNet rule for your subnet.',
      costLevers: ['Database SKU (this template uses serverless GP)', 'Storage and IOPS', 'Backup retention if you add it'],
      destroyOrder: 'Delete databases, then firewall/VNet rules, then the logical server.',
      pricingUrl: 'https://azure.microsoft.com/pricing/details/azure-sql/',
      docsUrl: 'https://learn.microsoft.com/azure/azure-sql/database/sql-database-paas-overview',
    },
  },
  {
    type: 'cosmos-db',
    label: 'Cosmos DB',
    description: 'Globally distributed NoSQL database',
    defaultSubnet: 'DB',
    networkMode: 'subnet_required',
    uiCategory: 'data',
    integrationNotes: 'Use private endpoint from application subnets; pair with Key Vault for keys.',
    whatCreates: {
      createsSummary: 'Cosmos DB account (SQL API) with VNet filter and regional replica in your region.',
      costLevers: ['RU/s or serverless throughput', 'Storage consumed', 'Multi-region writes if you extend the template'],
      destroyOrder: 'Delete databases/containers, then the Cosmos account.',
      pricingUrl: 'https://azure.microsoft.com/pricing/details/cosmos-db/',
      docsUrl: 'https://learn.microsoft.com/azure/cosmos-db/introduction',
    },
  },
  {
    type: 'storage-account',
    label: 'Storage Account',
    description: 'Blob, file, queue and table storage',
    defaultSubnet: 'Backend',
    networkMode: 'subnet_required',
    uiCategory: 'data',
    integrationNotes: 'Restrict to trusted subnets or private endpoints; used by VMs, AKS, and App Service mounts.',
    whatCreates: {
      createsSummary: 'Storage account with network rules; optional private endpoint for blob when enabled in Advanced IaC.',
      costLevers: ['Redundancy (LRS/ZRS/GRS)', 'Hot vs cool/archive access tiers', 'Transactions and egress'],
      destroyOrder: 'Private endpoint first if present, then the storage account after emptying blobs.',
      pricingUrl: 'https://azure.microsoft.com/pricing/details/storage/',
      docsUrl: 'https://learn.microsoft.com/azure/storage/common/storage-introduction',
    },
  },
  {
    type: 'key-vault',
    label: 'Key Vault',
    description: 'Secrets, keys and certificate management',
    defaultSubnet: 'Backend',
    networkMode: 'subnet_required',
    uiCategory: 'security',
    integrationNotes: 'Reference from App Service, AKS, or VMs; use private endpoint and managed identities.',
    whatCreates: {
      createsSummary: 'Key Vault (RBAC, soft delete, purge protection) with network ACLs; optional private endpoint.',
      costLevers: ['Operations (secrets/keys transactions)', 'HSM-backed keys if you choose premium SKU later'],
      destroyOrder: 'Remove references (apps, PE), purge soft-deleted vault only after retention policy allows.',
      pricingUrl: 'https://azure.microsoft.com/pricing/details/key-vaults/',
      docsUrl: 'https://learn.microsoft.com/azure/key-vault/general/overview',
    },
  },
  {
    type: 'api-management',
    label: 'API Management',
    description: 'API gateway and developer portal',
    defaultSubnet: 'Frontend',
    networkMode: 'subnet_required',
    uiCategory: 'integration',
    integrationNotes: 'External or internal; routes to App Service, AKS ingress, or Container Apps.',
    whatCreates: {
      createsSummary: 'API Management instance in internal VNet mode on your subnet.',
      costLevers: ['SKU (Developer vs production tiers)', 'Capacity units', 'Long-running deploy time (often 30–45 min)'],
      destroyOrder: 'APIs and backends first, then the APIM service resource.',
      pricingUrl: 'https://azure.microsoft.com/pricing/details/api-management/',
      docsUrl: 'https://learn.microsoft.com/azure/api-management/api-management-key-concepts',
    },
  },
  {
    type: 'container-apps',
    label: 'Container Apps',
    description: 'Serverless containers with auto-scaling',
    defaultSubnet: 'Backend',
    networkMode: 'subnet_required',
    uiCategory: 'containers',
    integrationNotes: 'Shares patterns with AKS; often uses Container Apps Environment with dedicated subnet.',
    whatCreates: {
      createsSummary: 'Container Apps Environment (subnet) and a sample container app with external ingress.',
      costLevers: ['vCPU and memory per replica', 'Min/max replicas', 'Environment overhead'],
      destroyOrder: 'Delete container apps/revisions, then the environment.',
      pricingUrl: 'https://azure.microsoft.com/pricing/details/container-apps/',
      docsUrl: 'https://learn.microsoft.com/azure/container-apps/overview',
    },
  },
  {
    type: 'vm',
    label: 'Virtual Machine (VM)',
    description: 'Single Linux or Windows VM with configurable NIC and public IP',
    defaultSubnet: 'Backend',
    networkMode: 'subnet_required',
    uiCategory: 'compute',
    integrationNotes: 'Reach Storage, SQL private endpoints, or peered VNets from the same or connected subnets.',
    whatCreates: {
      createsSummary: 'Optional public IP, NIC, and single Linux or Windows VM (size and disk configurable).',
      costLevers: ['VM size series', 'OS disk type and size', 'Public IP and egress', 'Run time (always on vs stopped)'],
      destroyOrder: 'VM, then NIC, then public IP, then disks if retained separately.',
      pricingUrl: 'https://azure.microsoft.com/pricing/details/virtual-machines/linux/',
      docsUrl: 'https://learn.microsoft.com/azure/virtual-machines/overview',
    },
  },
  {
    type: 'vmss',
    label: 'Virtual Machine Scale Set (VMSS)',
    description: 'Auto-scaling set of VMs with horizontal scale rules',
    defaultSubnet: 'Backend',
    networkMode: 'subnet_required',
    uiCategory: 'compute',
    integrationNotes: 'Same as VM: place with backends that call databases or internal APIs.',
    whatCreates: {
      createsSummary: 'Linux or Windows VMSS with autoscale profile (CPU rules) on your subnet.',
      costLevers: ['VM SKU', 'Instance count range', 'OS disks', 'Autoscale churn'],
      destroyOrder: 'Autoscale setting first, then scale set (instances), then related load balancers if any.',
      pricingUrl: 'https://azure.microsoft.com/pricing/details/virtual-machine-scale-sets/linux/',
      docsUrl: 'https://learn.microsoft.com/azure/virtual-machine-scale-sets/overview',
    },
  },
];
