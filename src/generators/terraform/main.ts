import type { ProjectConfig } from '../../types/index';
import { getIacSettings, omitEnvironmentTag, tfMapString } from '../../core/iac/conventions';

export function renderMainTf(config: ProjectConfig): string {
  const needsClientConfig = config.services.some((s) =>
    s.type === 'key-vault' || s.type === 'azure-machine-learning' || s.type === 'azure-ai-foundry',
  );
  const clientConfigBlock = needsClientConfig
    ? `
data "azurerm_client_config" "current" {}
`
    : '';

  const needsRandom = config.services.some(s => s.type === 'azure-sql');
  const randomProvider = needsRandom
    ? `    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }\n`
    : '';

  const defaultTagsBlock = `
  default_tags {
    tags = local.common_tags
  }
`;

  return `terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
${randomProvider}  }
}

locals {
  common_tags = merge(var.default_tags, { Environment = var.environment })
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
${clientConfigBlock}`;
}

export function renderVariablesTf(config: ProjectConfig): string {
  const iac = getIacSettings(config);
  const tagsForTf = omitEnvironmentTag(iac.tags);
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

  const defaultTagsVar = `
variable "environment" {
  description = "Deployment environment (dev, stage, prod). Merged into provider tags as Environment."
  type        = string
  default     = "${iac.environment}"
}

variable "default_tags" {
  description = "Base tags for the provider; Environment is merged from var.environment in main.tf locals."
  type        = map(string)
  default     = ${tfMapString(tagsForTf)}
}
`;

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

output "environment" {
  description = "Deployment environment passed to resources via provider tags."
  value       = var.environment
}
${vnetOutput}`;
}

/** Example tfvars for dev/stage/prod; copy to `terraform.tfvars` and adjust. */
export function renderTerraformTfvarsExample(config: ProjectConfig): string {
  const iac = getIacSettings(config);
  return `# Copy to terraform.tfvars (or use -var-file) and adjust per environment.
environment         = "${iac.environment}"
# location            = "${config.region}"
# resource_group_name = "${config.resourceGroupName}"
`;
}
