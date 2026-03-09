output "web_app_url" {
  description = "URL of the Cloud Builder web app."
  value       = "https://${azurerm_linux_web_app.main.default_hostname}"
}

output "web_app_name" {
  description = "Name of the App Service (for deployment)."
  value       = azurerm_linux_web_app.main.name
}

output "resource_group_name" {
  description = "Resource group name."
  value       = azurerm_resource_group.main.name
}

output "sql_server_fqdn" {
  description = "Azure SQL Server FQDN (for running schema or connecting)."
  value       = azurerm_mssql_server.main.fully_qualified_domain_name
}

output "sql_database_name" {
  description = "Azure SQL database name."
  value       = azurerm_mssql_database.main.name
}
