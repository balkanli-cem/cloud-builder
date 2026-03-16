# Cloud Builder

Interactive Azure infrastructure builder that generates **Bicep** or **Terraform** from a step-by-step wizard. Use it from the terminal (CLI) or in the browser (web app). Deployments can be recorded in Azure SQL.

## What it does

1. **Project** — Name, resource group, Azure region (West Europe, Sweden Central, Belgium Central).
2. **Network** — Use the default VNet layout or customize: VNet name, address space (CIDR), and each subnet’s address prefix (e.g. Frontend, Backend, DB). Available in both CLI and web app.
3. **Services** — Select Azure services, set resource names and subnet placement.
4. **Summary** — Review, choose Bicep or Terraform, then generate.

Generated files are written to `output/<projectName>/bicep/` or `output/<projectName>/terraform/`. When running as the web app with **AZURE_SQL_CONNECTION_STRING** set, each generation is stored in an Azure SQL table for history.

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

## Output layout

- **Bicep:** `main.bicep` plus `modules/network.bicep` and one module per service type (e.g. `cosmos-db.bicep`). Multiple instances of the same type each get their own deployment in `main.bicep`.
- **Terraform:** `main.tf`, `variables.tf`, `outputs.tf`, `network.tf`, and one `.tf` file per service type. Multiple instances of the same type are emitted as multiple resources in that file.

## Tests

Tests live under `tests/` and use Jest (see `jest.config.js`). Run with `npm test`. CI runs on every push and pull request to `main` (see `.github/workflows/ci.yml`).

**Rate limiting:** Login, register, and generate are rate-limited per IP (see **[docs/RATE_LIMITING.md](docs/RATE_LIMITING.md)** for how it works and how to tune it).

## Deploy to Azure

Terraform in **[deploy/terraform/](deploy/terraform/)** provisions the Web App (Node 20) and an Azure SQL database. The app uses the connection string from app settings to store generation history. Step-by-step and CI/CD setup are in **[deploy/README.md](deploy/README.md)**.

- **CI/CD:** GitHub Actions (`.github/workflows/deploy.yml`) deploys to the Web App on push to `main` **only when application code changes** (e.g. `src/`, `web/`, `package.json`, `tests/`). Changes to README, `deploy/`, or the workflow file alone do not trigger a deploy. You can also run the deploy workflow manually.

## License

MIT (or your choice).
