import type { AzureServiceType } from '../../types/index.js';

export function renderServiceBicep(type: AzureServiceType): string {
  switch (type) {
    case 'app-service':    return appService();
    case 'aks':            return aks();
    case 'azure-sql':      return azureSql();
    case 'cosmos-db':      return cosmosDb();
    case 'storage-account':return storageAccount();
    case 'key-vault':      return keyVault();
    case 'api-management': return apiManagement();
    case 'container-apps': return containerApps();
  }
}

// ─── App Service ──────────────────────────────────────────────────────────────

function appService(): string {
  return `param location string
param name string
param subnetId string

resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: '\${name}-plan'
  location: location
  sku: {
    name: 'B1'
    tier: 'Basic'
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

resource webApp 'Microsoft.Web/sites@2023-01-01' = {
  name: name
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    virtualNetworkSubnetId: subnetId
    httpsOnly: true
    siteConfig: {
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
    }
  }
}

output webAppId string = webApp.id
output defaultHostname string = webApp.properties.defaultHostName
`;
}

// ─── AKS ──────────────────────────────────────────────────────────────────────

function aks(): string {
  return `param location string
param name string
param subnetId string

resource aks 'Microsoft.ContainerService/managedClusters@2024-02-01' = {
  name: name
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    dnsPrefix: name
    networkProfile: {
      networkPlugin: 'azure'
      networkPolicy: 'azure'
    }
    agentPoolProfiles: [
      {
        name: 'nodepool1'
        count: 3
        vmSize: 'Standard_DS2_v2'
        osType: 'Linux'
        mode: 'System'
        vnetSubnetID: subnetId
      }
    ]
  }
}

output clusterName string = aks.name
output clusterFqdn string = aks.properties.fqdn
`;
}

// ─── Azure SQL ────────────────────────────────────────────────────────────────

function azureSql(): string {
  return `param location string
param name string
param subnetId string

@secure()
param adminPassword string = newGuid()

resource sqlServer 'Microsoft.Sql/servers@2023-05-01-preview' = {
  name: name
  location: location
  properties: {
    administratorLogin: 'sqladmin'
    administratorLoginPassword: adminPassword
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Disabled'
  }
}

resource sqlDb 'Microsoft.Sql/servers/databases@2023-05-01-preview' = {
  parent: sqlServer
  name: '\${name}-db'
  location: location
  sku: {
    name: 'GP_S_Gen5_1'
    tier: 'GeneralPurpose'
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    autoPauseDelay: 60
    minCapacity: json('0.5')
  }
}

resource vnetRule 'Microsoft.Sql/servers/virtualNetworkRules@2023-05-01-preview' = {
  parent: sqlServer
  name: 'allow-subnet'
  properties: {
    virtualNetworkSubnetId: subnetId
    ignoreMissingVnetServiceEndpoint: false
  }
}

output sqlServerId string = sqlServer.id
output sqlDbId string = sqlDb.id
`;
}

// ─── Cosmos DB ────────────────────────────────────────────────────────────────

function cosmosDb(): string {
  return `param location string
param name string
param subnetId string

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-02-15-preview' = {
  name: name
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    databaseAccountOfferType: 'Standard'
    isVirtualNetworkFilterEnabled: true
    virtualNetworkRules: [
      {
        id: subnetId
        ignoreMissingVNetServiceEndpoint: false
      }
    ]
    publicNetworkAccess: 'Disabled'
    enableAutomaticFailover: false
  }
}

output accountId string = cosmosAccount.id
output documentEndpoint string = cosmosAccount.properties.documentEndpoint
`;
}

// ─── Storage Account ──────────────────────────────────────────────────────────

function storageAccount(): string {
  return `// NOTE: Azure storage account names must be 3-24 chars, lowercase alphanumeric only (no hyphens).
// Adjust the 'name' parameter in main.bicep if your project name contains hyphens.
param location string
param name string
param subnetId string

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: name
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
      virtualNetworkRules: [
        {
          id: subnetId
          action: 'Allow'
        }
      ]
    }
  }
}

output storageAccountId string = storageAccount.id
output blobEndpoint string = storageAccount.properties.primaryEndpoints.blob
`;
}

// ─── Key Vault ────────────────────────────────────────────────────────────────

function keyVault(): string {
  return `param location string
param name string
param subnetId string
param tenantId string = subscription().tenantId

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: name
  location: location
  properties: {
    tenantId: tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
      virtualNetworkRules: [
        {
          id: subnetId
          ignoreMissingVnetServiceEndpoint: false
        }
      ]
    }
  }
}

output keyVaultId string = keyVault.id
output keyVaultUri string = keyVault.properties.vaultUri
`;
}

// ─── API Management ───────────────────────────────────────────────────────────

function apiManagement(): string {
  return `// NOTE: APIM deployment can take 30-45 minutes.
param location string
param name string
param subnetId string

resource apim 'Microsoft.ApiManagement/service@2023-09-01-preview' = {
  name: name
  location: location
  sku: {
    name: 'Developer'
    capacity: 1
  }
  properties: {
    publisherEmail: 'admin@contoso.com'
    publisherName: 'Contoso'
    virtualNetworkType: 'Internal'
    virtualNetworkConfiguration: {
      subnetResourceId: subnetId
    }
  }
}

output apimId string = apim.id
output gatewayUrl string = apim.properties.gatewayUrl
`;
}

// ─── Container Apps ───────────────────────────────────────────────────────────

function containerApps(): string {
  return `param location string
param name string
param subnetId string

resource containerAppEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '\${name}-env'
  location: location
  properties: {
    vnetConfiguration: {
      infrastructureSubnetId: subnetId
      internal: false
    }
  }
}

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 80
      }
    }
    template: {
      containers: [
        {
          name: name
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 10
      }
    }
  }
}

output containerAppId string = containerApp.id
output fqdn string = containerApp.properties.configuration.ingress.fqdn
`;
}
