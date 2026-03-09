variable "resource_group_name" {
  description = "Name of the resource group for Cloud Builder."
  type        = string
}

variable "location" {
  description = "Azure region for all resources."
  type        = string
  default     = "westeurope"
}

variable "environment" {
  description = "Environment label (e.g. dev, prod)."
  type        = string
  default     = "prod"
}

variable "app_name" {
  description = "Base name for the app (used in App Service and SQL)."
  type        = string
  default     = "cloud-builder"
}

variable "sql_admin_login" {
  description = "Azure SQL Server administrator login."
  type        = string
  sensitive   = true
}

variable "sql_admin_password" {
  description = "Azure SQL Server administrator password."
  type        = string
  sensitive   = true
}

variable "sql_database_sku" {
  description = "Azure SQL Database SKU (e.g. Basic, S0, S1)."
  type        = string
  default     = "Basic"
}
