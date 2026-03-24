# Cloud Builder

Interactive Azure infrastructure builder that generates **Bicep** or **Terraform** from a step-by-step wizard. Use it from the terminal (CLI) or in the browser (web app). Deployments can be recorded in Azure SQL.

## What it does

1. **Project** — Name, resource group, Azure region (West Europe, Sweden Central, Belgium Central), and **environment** (dev / stage / prod) for the `Environment` tag and generated parameters.
2. **Network** — Use the default VNet layout or customize: VNet name, address space (CIDR), and each subnet’s address prefix (e.g. Frontend, Backend, DB). Available in both CLI and web app.
3. **Services** — Select Azure services, set resource names and subnet placement.
4. **Summary** — Review, choose Bicep or Terraform, then generate. In the web app you can expand **Advanced IaC** to set optional tags, name prefix/suffix, SKUs, availability zones, diagnostics, and private endpoints (see below).

Generated files are written to `output/<projectName>/bicep/` or `output/<projectName>/terraform/`. When running as the web app with **AZURE_SQL_CONNECTION_STRING** set, each generation is stored in an Azure SQL table for history.

**Login tracking (optional):** Run `deploy/terraform/sql/schema-login-tracking.sql` on the same database. That adds **UserLoginEvents** (success/failure audit with IP and user agent) and **UserSessions** (JWT session id + last activity). Each successful login creates a row in both; API calls refresh session activity; sign-out revokes the session. Without this migration, login still works but uses stateless JWTs only (no DB session enforcement). **Concurrent “logged in” users** = distinct users with a non-revoked session whose **LastActivityAt** is within **SESSION_IDLE_MINUTES** (default 15). Query metrics with **GET /api/admin/login-stats** and header **X-Admin-Key** (set env **ADMIN_API_KEY** to a long random secret; endpoint returns 404 if unset).

## Prerequisites

- **Node.js** 18+ and npm.

## Install

```bash
git clone https://github.com/balkanli-cem/cloud-builder.git
cd cloud-builder
npm install
```

## Run

### CLI (terminal)

```bash
npm start
```

Or `npm run dev`. Follow the prompts; when done, open `output/<projectName>/` for your IaC.

### Web app (browser)

```bash
npm run build:web
npm run server
```

Open **http://localhost:3000**. Complete the steps and download Bicep or Terraform as a ZIP.

## Scripts

| Command             | Description                              |
|---------------------|------------------------------------------|
| `npm start`         | Run the CLI (ts-node)                    |
| `npm run dev`       | Same as start                            |
| `npm run build`     | Compile TypeScript to `dist/`            |
| `npm run build:web` | Install web deps and build frontend      |
| `npm run server`    | Run web server (serve UI + API)          |
| `npm test`          | Run tests (Jest)                         |

## Supported Azure services

- App Service  
- AKS (Azure Kubernetes Service)  
- Azure SQL Database  
- Cosmos DB  
- Storage Account  
- Key Vault  
- API Management  
- Container Apps  
- **Virtual Machine (VM)** — Optional public IP, NIC name, VM size, OS (Linux/Windows), admin username, OS disk size.  
- **Virtual Machine Scale Set (VMSS)** — NIC name prefix, VM size, OS, min/max instances, and horizontal autoscale: scale-out when CPU % above a threshold, scale-in when CPU % below a threshold.  

## Multi-environment parameters

- **`config.environment`** — `dev` | `stage` | `prod` (default `dev`). Sets the `Environment` tag (merged with `Project` and optional `config.iac.conventions.tags`). You can override via `iac.conventions.tags.Environment` when it is one of those three values.
- **Terraform** — `variable "environment"` in `variables.tf` (defaults from the wizard). Copy **`terraform.tfvars.example`** to `terraform.tfvars` and set `environment = "stage"` (or `prod`) per workspace. `main.tf` uses `locals.common_tags = merge(var.default_tags, { Environment = var.environment })`.
- **Bicep** — `param environment` in `main.bicep` and `var mergedTags = union(tags, { Environment: environment })`. Use **`main.bicepparam`** as a template (`az deployment group create ... --parameters main.bicepparam`) or duplicate it per environment.

## Resource ordering (Terraform)

Generated Terraform adds explicit **`depends_on`** where it helps Azure creation order: resource group → VNet/subnets, SQL server on random password, private endpoints after their target resource, container app after its environment, VM NIC after public IP (when used), diagnostic settings after Log Analytics and the target resource.

## Advanced IaC (`config.iac`)

Optional JSON (CLI/API) or the **Advanced IaC** panel (web) configures:

| Area | What it does |
|------|----------------|
| **Conventions** | `namePrefix` / `nameSuffix` — sanitized and applied to logical resource names. `tags` — merged with a default `Project` tag; Terraform uses `default_tags` on the `azurerm` provider where supported. |
| **Diagnostics** | `production.enableDiagnostics` — Terraform: Log Analytics workspace + monitor diagnostic settings on supported resources (cheap “prod-ready” logging). |
| **Private endpoints** | `production.enablePrivateEndpoints` — adds private endpoints for Storage (blob) and Key Vault where implemented; requires a valid subnet (Private Link DNS zones are not generated—add in your landing zone). |
| **SQL** | `production.sqlZoneRedundant` — sets zone redundancy on the database when the SKU supports it (serverless GP may have constraints—validate in target region). |
| **VM / VMSS** | `production.vmAvailabilityZone` — `"1"` \| `"2"` \| `"3"` or omit for regional. |
| **SKUs** | App Service plan (`appServicePlanSku`), AKS node pool (`aksNodeVmSize`, `aksNodeCount`), storage replication (`LRS`, `ZRS`, …), API Management (`apimSku`, e.g. `Developer_1` → name `Developer`, capacity `1` in Bicep). |
| **Cosmos** | `production.cosmosEnableFreeTier` — request free tier when available. |

**Bicep note:** `main.bicep` declares shared parameters (e.g. AKS/SQL/APIM) even if those services are not in the diagram; the linter may warn about unused parameters—safe to ignore or trim locally.

**App Service:** Generated modules use a fixed plan **tier** in Bicep (`Basic`) while the SKU **name** follows `appServicePlanSku`. If you use Premium v3 SKUs (`P1v3`, …), adjust the plan **tier** in the module to match (`PremiumV3`).

## Output layout

- **Bicep:** `main.bicep`, **`main.bicepparam`** (example parameters for environment/location), plus `modules/network.bicep` and one module per service type (e.g. `cosmos-db.bicep`). Multiple instances of the same type each get their own deployment in `main.bicep`.
- **Terraform:** `main.tf`, `variables.tf`, `outputs.tf`, **`terraform.tfvars.example`**, `network.tf`, optional `diagnostics.tf`, and one `.tf` file per service type. Multiple instances of the same type are emitted as multiple resources in that file.

## Tests

Tests live under `tests/` and use Jest (see `jest.config.js`). Run with `npm test`. CI runs on every push and pull request to `main` (see `.github/workflows/ci.yml`).

**Rate limiting:** Login, register, and generate are rate-limited per IP (see **[docs/RATE_LIMITING.md](docs/RATE_LIMITING.md)** for how it works and how to tune it).

## Deploy to Azure

Terraform in **[deploy/terraform/](deploy/terraform/)** provisions the Web App (Node 20) and an Azure SQL database. The app uses the connection string from app settings to store generation history. Step-by-step and CI/CD setup are in **[deploy/README.md](deploy/README.md)**.

- **CI/CD:** GitHub Actions (`.github/workflows/deploy.yml`) deploys to the Web App on push to `main` **only when application code changes** (e.g. `src/`, `web/`, `package.json`, `tests/`). Changes to README, `deploy/`, or the workflow file alone do not trigger a deploy. You can also run the deploy workflow manually.

## License

MIT (or your choice).
