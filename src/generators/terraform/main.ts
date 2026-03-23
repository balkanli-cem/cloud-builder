import type { ProjectConfig } from '../../types/index';
import { getIacSettings, tfMapString } from '../../core/iac/conventions';

export function renderMainTf(config: ProjectConfig): string {
  const needsRandom = config.services.some(s => s.type === 'azure-sql');
  const iac = getIacSettings(config);

  const randomProvider = needsRandom
    ? `    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }\n`
    : '';

  const defaultTagsBlock =
    Object.keys(iac.tags).length > 0
      ? `
  default_tags {
    tags = var.default_tags
  }
`
      : '';

  return `terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
${randomProvider}  }
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy    = false
      recover_soft_deleted_key_vaults = true
    }
  }${defaultTagsBlock}
}

resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
}
`;
}

export function renderVariablesTf(config: ProjectConfig): string {
  const iac = getIacSettings(config);
  const hasVmOrVmss = config.services.some(s => s.type === 'vm' || s.type === 'vmss');
  const vmVariables = hasVmOrVmss
    ? `
variable "admin_ssh_public_key" {
  description = "SSH public key for Linux VMs and VMSS (e.g. contents of ~/.ssh/id_rsa.pub)."
  type        = string
  sensitive   = true
}

variable "admin_password" {
  description = "Admin password for Windows VMs and VMSS. Only required if you deploy Windows."
  type        = string
  sensitive   = true
  default     = ""
}
`
    : '';

  const defaultTagsVar =
    Object.keys(iac.tags).length > 0
      ? `
variable "default_tags" {
  description = "Tags applied to all supported resources (provider default_tags)."
  type        = map(string)
  default     = ${tfMapString(iac.tags)}
}
`
      : '';

  return `variable "location" {
  description = "Azure region for all resources."
  type        = string
  default     = "${config.region}"
}

variable "resource_group_name" {
  description = "Name of the resource group."
  type        = string
  default     = "${config.resourceGroupName}"
}
${defaultTagsVar}${vmVariables}
`;
}

export function renderOutputsTf(includeSharedNetwork: boolean): string {
  const vnetOutput = includeSharedNetwork
    ? `
output "vnet_id" {
  description = "Resource ID of the virtual network (only when the deployment includes a shared VNet)."
  value       = azurerm_virtual_network.main.id
}
`
    : `
# No shared VNet in this deployment — vnet_id output omitted.
`;
  return `output "resource_group_name" {
  description = "Name of the provisioned resource group."
  value       = azurerm_resource_group.main.name
}
${vnetOutput}`;
}
