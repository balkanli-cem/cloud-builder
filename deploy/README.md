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

## 2. Create the database tables

Run the scripts once against the new database (using Azure Data Studio, sqlcmd, or the Azure Portal query editor):

- **Server:** value of `sql_server_fqdn` (e.g. `cloudbuilderprodsql.database.windows.net`)
- **Database:** `cloudbuilder`
- **Auth:** SQL login (the `sql_admin_login` / `sql_admin_password` from Terraform)

**Order matters:** run **`users.sql`** first (creates the Users table for login; passwords stored as bcrypt hashes). Then run **`schema.sql`** (creates the Generations table and links it to Users for "My generations"). For forgot-password, run **`schema-password-reset.sql`** to add reset token columns to Users. For IaC validation badges in the dashboard, run **`schema-validation.sql`** to add ValidationStatus and ValidationMessage to Generations. Set **JWT_SECRET** in the Web App application settings for production. For password reset emails, set **PUBLIC_APP_URL** to your app’s base URL (e.g. `https://your-app.azurewebsites.net`) so reset links are correct; without it, the server logs the link in non-production.

If you already had a Generations table without a user link, run **`schema-add-user-id.sql`** to add the `UserId` column and FK.

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

### 4. CI/CD with GitHub Actions

A workflow (`.github/workflows/deploy.yml`) deploys to the Web App on every push to `main` (and can be run manually).

**One-time setup:**

1. **Get the publish profile** from Azure:
   - Portal: App Service → **Get publish profile** (download the file).
   - Or PowerShell:  
     `Get-AzWebAppPublishProfile -ResourceGroupName "AZ104-RG-cloud-builder-dev" -Name "cloud-builder-dev-app" -Format WebDeploy | Out-File profile.xml`  
     Then copy the file contents (one long line).

2. **Add a GitHub secret:** Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**  
   - Name: `AZURE_WEBAPP_PUBLISH_PROFILE`  
   - Value: paste the full publish profile contents.

3. **Match the app name** in the workflow: in `.github/workflows/deploy.yml`, set `AZURE_WEBAPP_NAME` to your Web App name (default is `cloud-builder-dev-app`).

After that, pushes to `main` (and manual runs of the workflow) will build and deploy the zip to the Web App.

The app expects **PORT** (set by App Service) and **AZURE_SQL_CONNECTION_STRING** (set by Terraform).

**Health check:** Use `GET /api/health` for liveness (returns 200 when the app is up). Use `GET /api/health/ready` for readiness: it returns 200 when the app and database (if configured) are OK, and 503 if the DB is configured but unreachable. You can set the App Service **Health check path** to `/api/health` or `/api/health/ready` in the Azure Portal (App Service → Configuration → General settings).

## Optional: run locally with DB

Set the same connection string (from Terraform output or Key Vault) and run the server:

**PowerShell:**

```powershell
$env:AZURE_SQL_CONNECTION_STRING = "Server=tcp:...;Database=cloudbuilder;User ID=...;Password=...;Encrypt=True;..."
npm run server
```

**Bash:** `export AZURE_SQL_CONNECTION_STRING="..."; npm run server`

Generations will be stored in the **Generations** table (ProjectName, ResourceGroupName, Region, NetworkJson, ServicesJson, Format, CreatedAt).
