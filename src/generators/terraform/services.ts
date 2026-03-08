import type { AzureService } from '../../types/index.js';
import { toTfId } from './network.js';

function getSubnetRef(svc: AzureService): string {
  return svc.subnetPlacement
    ? `azurerm_subnet.${toTfId(svc.subnetPlacement)}.id`
    : 'azurerm_subnet.backend.id';
}

export function renderServiceTerraform(services: AzureService[]): string {
  if (services.length === 0) return '';

  const type = services[0].type;
  const blocks = services.map(svc => {
    const id = toTfId(svc.name);
    const sub = getSubnetRef(svc);
    switch (type) {
      case 'app-service':     return appService(id, svc.name, sub);
      case 'aks':             return aks(id, svc.name, sub);
      case 'azure-sql':       return azureSql(id, svc.name, sub);
      case 'cosmos-db':       return cosmosDb(id, svc.name, sub);
      case 'storage-account': return storageAccount(id, svc.name, sub);
      case 'key-vault':       return keyVault(id, svc.name, sub);
      case 'api-management':  return apiManagement(id, svc.name, sub);
      case 'container-apps':  return containerApps(id, svc.name, sub);
    }
  });
  // Key Vault needs the client config data block once per file, not per instance
  const prefix = type === 'key-vault' ? keyVaultDataBlock() : '';
  return prefix + blocks.join('\n\n');
}

// ─── App Service ──────────────────────────────────────────────────────────────

function appService(id: string, name: string, subnetRef: string): string {
  return `resource "azurerm_service_plan" "${id}" {
  name                = "${name}-plan"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  os_type             = "Linux"
  sku_name            = "B1"
}

resource "azurerm_linux_web_app" "${id}" {
  name                      = "${name}"
  resource_group_name       = azurerm_resource_group.main.name
  location                  = azurerm_resource_group.main.location
  service_plan_id           = azurerm_service_plan.${id}.id
  virtual_network_subnet_id = ${subnetRef}
  https_only                = true

  site_config {
    minimum_tls_version = "1.2"
    ftps_state          = "Disabled"
  }
}

output "${id}_hostname" {
  value = azurerm_linux_web_app.${id}.default_hostname
}
`;
}

// ─── AKS ──────────────────────────────────────────────────────────────────────

function aks(id: string, name: string, subnetRef: string): string {
  return `resource "azurerm_kubernetes_cluster" "${id}" {
  name                = "${name}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  dns_prefix          = "${name}"

  default_node_pool {
    name           = "nodepool1"
    node_count     = 3
    vm_size        = "Standard_DS2_v2"
    vnet_subnet_id = ${subnetRef}
  }

  identity {
    type = "SystemAssigned"
  }

  network_profile {
    network_plugin = "azure"
    network_policy = "azure"
  }
}

output "${id}_kube_config" {
  value     = azurerm_kubernetes_cluster.${id}.kube_config_raw
  sensitive = true
}
`;
}

// ─── Azure SQL ────────────────────────────────────────────────────────────────

function azureSql(id: string, name: string, subnetRef: string): string {
  return `# Requires the hashicorp/random provider — already added to main.tf
resource "random_password" "${id}_admin" {
  length  = 16
  special = true
}

resource "azurerm_mssql_server" "${id}" {
  name                          = "${name}"
  resource_group_name           = azurerm_resource_group.main.name
  location                      = azurerm_resource_group.main.location
  version                       = "12.0"
  administrator_login           = "sqladmin"
  administrator_login_password  = random_password.${id}_admin.result
  minimum_tls_version           = "1.2"
  public_network_access_enabled = false
}

resource "azurerm_mssql_database" "${id}" {
  name                        = "${name}-db"
  server_id                   = azurerm_mssql_server.${id}.id
  sku_name                    = "GP_S_Gen5_1"
  auto_pause_delay_in_minutes = 60
  min_capacity                = 0.5
}

resource "azurerm_mssql_virtual_network_rule" "${id}" {
  name      = "allow-subnet"
  server_id = azurerm_mssql_server.${id}.id
  subnet_id = ${subnetRef}
}

output "${id}_server_id" {
  value = azurerm_mssql_server.${id}.id
}
`;
}

// ─── Cosmos DB ────────────────────────────────────────────────────────────────

function cosmosDb(id: string, name: string, subnetRef: string): string {
  return `resource "azurerm_cosmosdb_account" "${id}" {
  name                = "${name}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  offer_type          = "Standard"
  kind                = "GlobalDocumentDB"

  consistency_policy {
    consistency_level = "Session"
  }

  geo_location {
    location          = azurerm_resource_group.main.location
    failover_priority = 0
  }

  is_virtual_network_filter_enabled = true

  virtual_network_rule {
    id = ${subnetRef}
  }

  public_network_access_enabled = false
  enable_automatic_failover     = false
}

output "${id}_endpoint" {
  value = azurerm_cosmosdb_account.${id}.endpoint
}
`;
}

// ─── Storage Account ──────────────────────────────────────────────────────────

function storageAccount(id: string, name: string, subnetRef: string): string {
  return `# NOTE: Storage account names must be 3-24 chars, lowercase alphanumeric only (no hyphens).
# Adjust the name below if your resource name contains hyphens.
resource "azurerm_storage_account" "${id}" {
  name                     = "${name}"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  account_kind             = "StorageV2"
  min_tls_version          = "TLS1_2"

  allow_nested_items_to_be_public = false

  network_rules {
    default_action             = "Deny"
    bypass                     = ["AzureServices"]
    virtual_network_subnet_ids = [${subnetRef}]
  }
}

output "${id}_blob_endpoint" {
  value = azurerm_storage_account.${id}.primary_blob_endpoint
}
`;
}

// ─── Key Vault ────────────────────────────────────────────────────────────────

function keyVaultDataBlock(): string {
  return `data "azurerm_client_config" "current" {}
`;
}

function keyVault(id: string, name: string, subnetRef: string): string {
  return `resource "azurerm_key_vault" "${id}" {
  name                = "${name}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "standard"

  enable_rbac_authorization  = true
  soft_delete_retention_days = 90
  purge_protection_enabled   = true

  network_acls {
    default_action             = "Deny"
    bypass                     = ["AzureServices"]
    virtual_network_subnet_ids = [${subnetRef}]
  }
}

output "${id}_uri" {
  value = azurerm_key_vault.${id}.vault_uri
}
`;
}

// ─── API Management ───────────────────────────────────────────────────────────

function apiManagement(id: string, name: string, subnetRef: string): string {
  return `# NOTE: APIM deployment can take 30-45 minutes.
resource "azurerm_api_management" "${id}" {
  name                = "${name}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  publisher_name      = "Contoso"
  publisher_email     = "admin@contoso.com"
  sku_name            = "Developer_1"

  virtual_network_type = "Internal"

  virtual_network_configuration {
    subnet_id = ${subnetRef}
  }
}

output "${id}_gateway_url" {
  value = azurerm_api_management.${id}.gateway_url
}
`;
}

// ─── Container Apps ───────────────────────────────────────────────────────────

function containerApps(id: string, name: string, subnetRef: string): string {
  return `resource "azurerm_container_app_environment" "${id}_env" {
  name                       = "${name}-env"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  infrastructure_subnet_id   = ${subnetRef}
}

resource "azurerm_container_app" "${id}" {
  name                         = "${name}"
  container_app_environment_id = azurerm_container_app_environment.${id}_env.id
  resource_group_name          = azurerm_resource_group.main.name
  revision_mode                = "Single"

  template {
    container {
      name   = "${name}"
      image  = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"
      cpu    = 0.5
      memory = "1Gi"
    }
    max_replicas = 10
    min_replicas = 1
  }

  ingress {
    external_enabled = true
    target_port      = 80
    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }
}

output "${id}_fqdn" {
  value = azurerm_container_app.${id}.ingress[0].fqdn
}
`;
}
