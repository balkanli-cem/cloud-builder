# Deploy Cloud Builder to Azure

This folder contains Terraform to deploy the Cloud Builder web app and an Azure SQL database (single instance) for storing generation history.

## What gets deployed

- **Resource group**
- **App Service Plan** (Linux, B1) and **Web App** (Node 20)
- **Azure SQL Server** + **single database** (Basic by default)
- App setting **AZURE_SQL_CONNECTION_STRING** on the Web App (so the app can save each generation to the DB)

## Prerequisites

- Azure PowerShell (`Az` module) and logged in: `Connect-AzAccount` (or Azure CLI: `az login`)
- Terraform installed (e.g. 1.x)

## 1. Terraform

```bash
cd deploy/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars: set resource_group_name, sql_admin_login, sql_admin_password
terraform init
terraform plan
terraform apply
```

After apply, note the outputs: `web_app_url`, `web_app_name`, `sql_server_fqdn`, `sql_database_name`.

## 2. Create the database table

Run the schema once against the new database (using Azure Data Studio, sqlcmd, or the Azure Portal query editor):

- **Server:** value of `sql_server_fqdn` (e.g. `cloudbuilderprodsql.database.windows.net`)
- **Database:** `cloudbuilder`
- **Auth:** SQL login (the `sql_admin_login` / `sql_admin_password` from Terraform)

Execute the script: `deploy/terraform/sql/schema.sql`

## 3. Deploy the application

From the repo root:

1. Build the web UI: `npm run build:web`
2. Build the Node app: `npm run build`
3. Deploy to the Web App (PowerShell):

```powershell
# Replace with your resource group and web app name (from Terraform outputs)
$ResourceGroupName = "AZ104-RG-cloud-builder-dev"
$WebAppName        = "cloud-builder-dev-app"

# Set startup command so the app runs the server
Set-AzWebApp -ResourceGroupName $ResourceGroupName -Name $WebAppName -AppCommandLine "node dist/server.js"

# Create zip: App Service runs npm install then npm run build, so include tsconfig.json and src/ for tsc
Compress-Archive -Path dist, web-dist, src, package.json, package-lock.json, tsconfig.json -DestinationPath app.zip -Force

# Deploy the zip
Publish-AzWebApp -ResourceGroupName $ResourceGroupName -Name $WebAppName -ArchivePath (Resolve-Path app.zip).Path -Force
```

**Azure CLI alternative:**

```bash
az webapp config set --resource-group <resource_group_name> --name <web_app_name> --startup-file "node dist/server.js"
az webapp deployment source config-zip --resource-group <resource_group_name> --name <web_app_name> --src app.zip
```

If you omit `node_modules/` from the zip, **SCM_DO_BUILD_DURING_DEPLOYMENT** (set by Terraform) ensures the server runs `npm install` on deploy.

The app expects **PORT** (set by App Service) and **AZURE_SQL_CONNECTION_STRING** (set by Terraform).

## Optional: run locally with DB

Set the same connection string (from Terraform output or Key Vault) and run the server:

**PowerShell:**

```powershell
$env:AZURE_SQL_CONNECTION_STRING = "Server=tcp:...;Database=cloudbuilder;User ID=...;Password=...;Encrypt=True;..."
npm run server
```

**Bash:** `export AZURE_SQL_CONNECTION_STRING="..."; npm run server`

Generations will be stored in the **Generations** table (ProjectName, ResourceGroupName, Region, NetworkJson, ServicesJson, Format, CreatedAt).
