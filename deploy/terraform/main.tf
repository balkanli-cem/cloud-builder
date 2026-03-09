terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

locals {
  name_prefix = "${var.app_name}-${var.environment}"
}

data "azurerm_client_config" "current" {}

# Resource group
resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
}

# App Service Plan (Linux, Node)
resource "azurerm_service_plan" "main" {
  name                = "${local.name_prefix}-plan"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  os_type             = "Linux"
  sku_name            = "B1"
}

# Azure SQL Server + database (for storing generation history)
resource "azurerm_mssql_server" "main" {
  name                         = "${replace(local.name_prefix, "-", "")}sql"
  resource_group_name          = azurerm_resource_group.main.name
  location                     = azurerm_resource_group.main.location
  version                      = "12.0"
  administrator_login          = var.sql_admin_login
  administrator_login_password = var.sql_admin_password
  minimum_tls_version          = "1.2"
  public_network_access_enabled = true
}

resource "azurerm_mssql_firewall_rule" "azure" {
  name             = "AllowAzureServices"
  server_id        = azurerm_mssql_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

resource "azurerm_mssql_database" "main" {
  name           = "cloudbuilder"
  server_id      = azurerm_mssql_server.main.id
  collation      = "SQL_Latin1_General_CP1_CI_AS"
  max_size_gb    = 2
  sku_name       = var.sql_database_sku
  zone_redundant = false
}

# Connection string for the app (stored in app settings)
locals {
  sql_connection_string = "Server=tcp:${azurerm_mssql_server.main.fully_qualified_domain_name},1433;Initial Catalog=${azurerm_mssql_database.main.name};Persist Security Info=False;User ID=${var.sql_admin_login};Password=${var.sql_admin_password};MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
}

# Web App (Node 20) – Cloud Builder UI + API
resource "azurerm_linux_web_app" "main" {
  name                = "${local.name_prefix}-app"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  service_plan_id     = azurerm_service_plan.main.id

  site_config {
    application_stack {
      node_version = "20-lts"
    }
    always_on = false
  }

  app_settings = {
    "WEBSITE_NODE_DEFAULT_VERSION"       = "~20"
    "SCM_DO_BUILD_DURING_DEPLOYMENT"      = "true"
    "AZURE_SQL_CONNECTION_STRING"        = local.sql_connection_string
  }
}
