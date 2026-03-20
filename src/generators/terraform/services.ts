import type { AzureService, VMConfig, VMSSConfig } from '../../types/index';
import { serviceUsesSharedSubnet } from '../../core/services/networkPolicy';
import { toTfId } from './network';

function getSubnetRef(svc: AzureService): string {
  if (!serviceUsesSharedSubnet(svc)) {
    throw new Error(`getSubnetRef called for service without shared subnet: ${svc.type} ${svc.name}`);
  }
  return svc.subnetPlacement
    ? `azurerm_subnet.${toTfId(svc.subnetPlacement)}.id`
    : 'azurerm_subnet.backend.id';
}

export function renderServiceTerraform(services: AzureService[]): string {
  if (services.length === 0) return '';

  const blocks = services.map((svc) => {
    const id = toTfId(svc.name);
    const config = (svc.config || {}) as Record<string, unknown>;
    const sub = serviceUsesSharedSubnet(svc) ? getSubnetRef(svc) : null;
    switch (svc.type) {
      case 'app-service':     return appService(id, svc.name, sub!);
      case 'aks':             return aks(id, svc.name, sub);
      case 'azure-sql':       return azureSql(id, svc.name, sub!);
      case 'cosmos-db':       return cosmosDb(id, svc.name, sub!);
      case 'storage-account': return storageAccount(id, svc.name, sub!);
      case 'key-vault':       return keyVault(id, svc.name, sub!);
      case 'api-management':  return apiManagement(id, svc.name, sub!);
      case 'container-apps':  return containerApps(id, svc.name, sub!);
      case 'vm':              return vm(id, svc.name, sub!, config as VMConfig);
      case 'vmss':            return vmss(id, svc.name, sub!, config as VMSSConfig);
    }
  });
  // Key Vault needs the client config data block once per file, not per instance
  const fileType = services[0]?.type;
  const prefix = fileType === 'key-vault' ? keyVaultDataBlock() : '';
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

function aks(id: string, name: string, subnetRef: string | null): string {
  if (subnetRef) {
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
  return `resource "azurerm_kubernetes_cluster" "${id}" {
  name                = "${name}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  dns_prefix          = "${name}"

  default_node_pool {
    name       = "nodepool1"
    node_count = 3
    vm_size    = "Standard_DS2_v2"
  }

  identity {
    type = "SystemAssigned"
  }

  network_profile {
    network_plugin = "kubenet"
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

  rbac_authorization_enabled = true
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

// ─── Virtual Machine ──────────────────────────────────────────────────────────

function vm(id: string, name: string, subnetRef: string, c: VMConfig): string {
  const enablePublicIp = c.enablePublicIp !== false;
  const nicName = c.nicName ?? `${name}-nic`;
  const vmSize = c.vmSize ?? 'Standard_B2s';
  const osType = (c.osType ?? 'Linux') as string;
  const adminUsername = c.adminUsername ?? 'azureuser';
  const osDiskSizeGb = c.osDiskSizeGb ?? 30;
  const isLinux = osType === 'Linux';

  const pipBlock = enablePublicIp
    ? `
resource "azurerm_public_ip" "${id}_pip" {
  name                = "${name}-pip"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  allocation_method   = "Static"
  sku                 = "Standard"
}
`
    : '';
  const nicPublicIp = enablePublicIp ? `azurerm_public_ip.${id}_pip.id` : 'null';

  const nicBlock = `
resource "azurerm_network_interface" "${id}_nic" {
  name                = "${nicName}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = ${subnetRef}
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = ${nicPublicIp}
  }
}
`;

  const linuxVmBlock = `
resource "azurerm_linux_virtual_machine" "${id}" {
  name                = "${name}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  size                = "${vmSize}"
  admin_username      = "${adminUsername}"
  network_interface_ids = [azurerm_network_interface.${id}_nic.id]

  admin_ssh_key {
    username   = "${adminUsername}"
    public_key = var.admin_ssh_public_key
  }

  os_disk {
    name                 = "${name}-osdisk"
    caching              = "ReadWrite"
    storage_account_type = "Premium_LRS"
    disk_size_gb         = ${osDiskSizeGb}
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts"
    version   = "latest"
  }
}

output "${id}_private_ip" {
  value = azurerm_network_interface.${id}_nic.private_ip_address
}
output "${id}_public_ip" {
  value = ${enablePublicIp ? `azurerm_public_ip.${id}_pip.ip_address` : 'null'}
}
`;

  const windowsVmBlock = `
resource "azurerm_windows_virtual_machine" "${id}" {
  name                = "${name}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  size                = "${vmSize}"
  admin_username      = "${adminUsername}"
  admin_password     = var.admin_password
  network_interface_ids = [azurerm_network_interface.${id}_nic.id]

  os_disk {
    name                 = "${name}-osdisk"
    caching              = "ReadWrite"
    storage_account_type = "Premium_LRS"
    disk_size_gb         = ${osDiskSizeGb}
  }

  source_image_reference {
    publisher = "MicrosoftWindowsServer"
    offer     = "WindowsServer"
    sku       = "2022-datacenter-azure-edition"
    version   = "latest"
  }
}

output "${id}_private_ip" {
  value = azurerm_network_interface.${id}_nic.private_ip_address
}
output "${id}_public_ip" {
  value = ${enablePublicIp ? `azurerm_public_ip.${id}_pip.ip_address` : 'null'}
}
`;

  return pipBlock + nicBlock + (isLinux ? linuxVmBlock : windowsVmBlock);
}

// ─── Virtual Machine Scale Set ─────────────────────────────────────────────────

function vmss(id: string, name: string, subnetRef: string, c: VMSSConfig): string {
  const vmSize = c.vmSize ?? 'Standard_B2s';
  const osType = (c.osType ?? 'Linux') as string;
  const nicName = c.nicName ?? `${name}-nic`;
  const instanceCountMin = c.instanceCountMin ?? 1;
  const instanceCountMax = c.instanceCountMax ?? 10;
  const scaleOutCpuPercent = c.scaleOutCpuPercent ?? 70;
  const scaleInCpuPercent = c.scaleInCpuPercent ?? 30;
  const isLinux = osType === 'Linux';

  const linuxVmssBlock = `
resource "azurerm_linux_virtual_machine_scale_set" "${id}" {
  name                = "${name}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "${vmSize}"
  instances           = ${instanceCountMin}
  admin_username      = "azureuser"

  admin_ssh_key {
    username   = "azureuser"
    public_key = var.admin_ssh_public_key
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts"
    version   = "latest"
  }

  os_disk {
    storage_account_type = "Premium_LRS"
    caching              = "ReadWrite"
  }

  network_interface {
    name    = "${nicName}"
    primary = true

    ip_configuration {
      name      = "internal"
      primary   = true
      subnet_id = ${subnetRef}
    }
  }
}

resource "azurerm_monitor_autoscale_setting" "${id}" {
  name                = "${name}-autoscale"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  target_resource_id  = azurerm_linux_virtual_machine_scale_set.${id}.id

  profile {
    name = "default"

    capacity {
      default = ${instanceCountMin}
      minimum = ${instanceCountMin}
      maximum = ${instanceCountMax}
    }

    rule {
      metric_trigger {
        metric_name         = "Percentage CPU"
        metric_resource_id  = azurerm_linux_virtual_machine_scale_set.${id}.id
        time_grain          = "PT1M"
        statistic           = "Average"
        time_window         = "PT5M"
        time_aggregation    = "Average"
        operator            = "GreaterThan"
        threshold           = ${scaleOutCpuPercent}
      }
      scale_action {
        direction = "Increase"
        type      = "ChangeCount"
        value     = "1"
        cooldown  = "PT5M"
      }
    }

    rule {
      metric_trigger {
        metric_name         = "Percentage CPU"
        metric_resource_id  = azurerm_linux_virtual_machine_scale_set.${id}.id
        time_grain          = "PT1M"
        statistic           = "Average"
        time_window         = "PT5M"
        time_aggregation    = "Average"
        operator            = "LessThan"
        threshold           = ${scaleInCpuPercent}
      }
      scale_action {
        direction = "Decrease"
        type      = "ChangeCount"
        value     = "1"
        cooldown  = "PT5M"
      }
    }
  }
}

output "${id}_vmss_id" {
  value = azurerm_linux_virtual_machine_scale_set.${id}.id
}
`;

  const windowsVmssBlock = `
resource "azurerm_windows_virtual_machine_scale_set" "${id}" {
  name                = "${name}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "${vmSize}"
  instances           = ${instanceCountMin}
  admin_username      = "azureuser"
  admin_password      = var.admin_password

  source_image_reference {
    publisher = "MicrosoftWindowsServer"
    offer     = "WindowsServer"
    sku       = "2022-datacenter-azure-edition"
    version   = "latest"
  }

  os_disk {
    storage_account_type = "Premium_LRS"
    caching              = "ReadWrite"
  }

  network_interface {
    name    = "${nicName}"
    primary = true

    ip_configuration {
      name      = "internal"
      primary   = true
      subnet_id = ${subnetRef}
    }
  }
}

resource "azurerm_monitor_autoscale_setting" "${id}" {
  name                = "${name}-autoscale"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  target_resource_id  = azurerm_windows_virtual_machine_scale_set.${id}.id

  profile {
    name = "default"

    capacity {
      default = ${instanceCountMin}
      minimum = ${instanceCountMin}
      maximum = ${instanceCountMax}
    }

    rule {
      metric_trigger {
        metric_name         = "Percentage CPU"
        metric_resource_id  = azurerm_windows_virtual_machine_scale_set.${id}.id
        time_grain          = "PT1M"
        statistic           = "Average"
        time_window         = "PT5M"
        time_aggregation    = "Average"
        operator            = "GreaterThan"
        threshold           = ${scaleOutCpuPercent}
      }
      scale_action {
        direction = "Increase"
        type      = "ChangeCount"
        value     = "1"
        cooldown  = "PT5M"
      }
    }

    rule {
      metric_trigger {
        metric_name         = "Percentage CPU"
        metric_resource_id  = azurerm_windows_virtual_machine_scale_set.${id}.id
        time_grain          = "PT1M"
        statistic           = "Average"
        time_window         = "PT5M"
        time_aggregation    = "Average"
        operator            = "LessThan"
        threshold           = ${scaleInCpuPercent}
      }
      scale_action {
        direction = "Decrease"
        type      = "ChangeCount"
        value     = "1"
        cooldown  = "PT5M"
      }
    }
  }
}

output "${id}_vmss_id" {
  value = azurerm_windows_virtual_machine_scale_set.${id}.id
}
`;

  return isLinux ? linuxVmssBlock : windowsVmssBlock;
}
