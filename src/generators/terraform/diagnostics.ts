import type { ProjectConfig } from '../../types/index';
import { getIacSettings, resolveResourceNameSegment } from '../../core/iac/conventions';
import { toTfId } from './network';

/**
 * Log Analytics workspace + monitor diagnostic settings for supported resources.
 * References resources created in service *.tf files by standard names.
 */
export function renderDiagnosticsTerraform(config: ProjectConfig): string {
  const iac = getIacSettings(config);
  if (!iac.enableDiagnostics) {
    return `# Diagnostics disabled. Set config.iac.production.enableDiagnostics = true to create Log Analytics and diagnostic settings.\n`;
  }

  const project = config.projectName.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 40);

  const la = `resource "azurerm_log_analytics_workspace" "main" {
  name                = "${project}-logs"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = 30

  depends_on = [azurerm_resource_group.main]
}

`;

  const blocks: string[] = [];
  for (const svc of config.services) {
    const id = toTfId(svc.name);
    const name = resolveResourceNameSegment(svc.name, config);

    if (svc.type === 'azure-sql') {
      blocks.push(`resource "azurerm_monitor_diagnostic_setting" "${id}_sql" {
  name                       = "${name}-sql-diag"
  target_resource_id         = azurerm_mssql_server.${id}.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  depends_on = [
    azurerm_log_analytics_workspace.main,
    azurerm_mssql_server.${id},
  ]

  metric {
    category = "AllMetrics"
    enabled  = true
  }
}

`);
    }
    if (svc.type === 'storage-account') {
      blocks.push(`resource "azurerm_monitor_diagnostic_setting" "${id}_st" {
  name                       = "${name}-st-diag"
  target_resource_id         = azurerm_storage_account.${id}.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  depends_on = [
    azurerm_log_analytics_workspace.main,
    azurerm_storage_account.${id},
  ]

  metric {
    category = "AllMetrics"
    enabled  = true
  }
}

`);
    }
    if (svc.type === 'app-service') {
      blocks.push(`resource "azurerm_monitor_diagnostic_setting" "${id}_web" {
  name                       = "${name}-web-diag"
  target_resource_id         = azurerm_linux_web_app.${id}.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  depends_on = [
    azurerm_log_analytics_workspace.main,
    azurerm_linux_web_app.${id},
  ]

  metric {
    category = "AllMetrics"
    enabled  = true
  }
}

`);
    }
    if (svc.type === 'key-vault') {
      blocks.push(`resource "azurerm_monitor_diagnostic_setting" "${id}_kv" {
  name                       = "${name}-kv-diag"
  target_resource_id         = azurerm_key_vault.${id}.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  depends_on = [
    azurerm_log_analytics_workspace.main,
    azurerm_key_vault.${id},
  ]

  metric {
    category = "AllMetrics"
    enabled  = true
  }
}

`);
    }
  }

  return la + blocks.join('\n');
}
