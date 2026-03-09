# Deploy Cloud Builder to Azure

This folder contains Terraform to deploy the Cloud Builder web app and an Azure SQL database (single instance) for storing generation history.

## What gets deployed

- **Resource group**
- **App Service Plan** (Linux, B1) and **Web App** (Node 20)
- **Azure SQL Server** + **single database** (Basic by default)
- App setting **AZURE_SQL_CONNECTION_STRING** on the Web App (so the app can save each generation to the DB)

## Prerequisites

- Azure CLI logged in: `az login`
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
3. Deploy the application to the Web App:
   - From repo root: build with `npm run build` and `npm run build:web`.
   - Zip `dist/`, `web-dist/`, `package.json`, and `package-lock.json` (and optionally `node_modules/` to skip install on the server).
   - If you omit `node_modules/`, ensure **SCM_DO_BUILD_DURING_DEPLOYMENT** is `true` (set by Terraform) so the server runs `npm install` on deploy.
   - Set the Web App **Startup Command** to: `node dist/server.js`  
     (Azure Portal → App Service → Configuration → General settings → Startup Command).
   - Deploy the zip:  
     `az webapp deployment source config-zip --resource-group <resource_group_name> --name <web_app_name> --src app.zip`
   - Or use GitHub Actions / Azure DevOps to build and zip deploy on push.

The app expects **PORT** (set by App Service) and **AZURE_SQL_CONNECTION_STRING** (set by Terraform).

## Optional: run locally with DB

Set the same connection string (from Terraform output or Key Vault) and run the server:

```bash
$env:AZURE_SQL_CONNECTION_STRING = "Server=tcp:...;Database=cloudbuilder;User ID=...;Password=...;Encrypt=True;..."
npm run server
```

Generations will be stored in the **Generations** table (ProjectName, ResourceGroupName, Region, NetworkJson, ServicesJson, Format, CreatedAt).
