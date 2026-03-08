# Cloud Builder

Interactive Azure infrastructure builder that generates **Bicep** or **Terraform** from a step-by-step wizard.

## What it does

1. **Project** — Name, resource group, Azure region (West Europe, Sweden Central, Belgium Central).
2. **Network** — Default or custom VNet and subnets (e.g. Frontend, Backend, DB).
3. **Services** — Select Azure services, set resource names and subnet placement.
4. **Summary** — Review, choose Bicep or Terraform, then generate.

Generated files are written to `output/<projectName>/bicep/` or `output/<projectName>/terraform/`.

## Prerequisites

- **Node.js** 18+ and npm.

## Install

```bash
git clone https://github.com/balkanli-cem/cloud-builder.git
cd cloud-builder
npm install
```

## Run

```bash
npm start
```

Or `npm run dev`. Follow the prompts; when done, open `output/<projectName>/` for your IaC.

## Scripts

| Command        | Description                    |
|----------------|--------------------------------|
| `npm start`    | Run the CLI (ts-node)          |
| `npm run dev`  | Same as start                  |
| `npm run build`| Compile TypeScript to `dist/`  |
| `npm test`     | Run tests                      |

## Supported Azure services

- App Service  
- AKS (Azure Kubernetes Service)  
- Azure SQL Database  
- Cosmos DB  
- Storage Account  
- Key Vault  
- API Management  
- Container Apps  

## Output layout

- **Bicep:** `main.bicep` plus `modules/network.bicep` and one module per service type (e.g. `cosmos-db.bicep`). Multiple instances of the same type each get their own deployment in `main.bicep`.
- **Terraform:** `main.tf`, `variables.tf`, `outputs.tf`, `network.tf`, and one `.tf` file per service type. Multiple instances of the same type are emitted as multiple resources in that file.

## License

MIT (or your choice).
