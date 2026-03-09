import type { ProjectConfig } from '../../types/index';

export function renderMainTf(config: ProjectConfig): string {
  const needsRandom = config.services.some(s => s.type === 'azure-sql');

  const randomProvider = needsRandom
    ? `    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }\n`
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
  }
}

resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
}
`;
}

export function renderVariablesTf(config: ProjectConfig): string {
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
`;
}

export function renderOutputsTf(): string {
  return `output "resource_group_name" {
  description = "Name of the provisioned resource group."
  value       = azurerm_resource_group.main.name
}

output "vnet_id" {
  description = "Resource ID of the virtual network."
  value       = azurerm_virtual_network.main.id
}
`;
}
