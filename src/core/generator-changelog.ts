/**
 * Human-readable notes when the generator, catalog, or templates change.
 * Append new entries at the top; keep bullets short for the in-app UI.
 */
export interface GeneratorChangelogEntry {
  /** ISO date (yyyy-mm-dd) */
  date: string;
  title: string;
  bullets: string[];
}

export const GENERATOR_CHANGELOG: GeneratorChangelogEntry[] = [
  {
    date: '2025-03-24',
    title: 'AI & ML services',
    bullets: [
      'Catalog: Azure AI Search, Azure Machine Learning workspace, Azure AI Foundry (Hub) with Terraform + Bicep modules.',
      'Search can use managed public access or attach to the shared VNet; ML/Hub require a subnet for Key Vault and storage network rules.',
      'Terraform: `data "azurerm_client_config" "current"` moved to `main.tf` whenever Key Vault or ML/Hub is in the project.',
    ],
  },
  {
    date: '2025-03-24',
    title: 'Services step UI',
    bullets: [
      'Service selection uses color-coded cards (Compute, Containers, Data, Web & app, Integration, Security) instead of plain checkboxes.',
      'Catalog entries include `uiCategory` for styling; click the card to toggle selection.',
    ],
  },
  {
    date: '2025-03-24',
    title: 'Docs & trust',
    bullets: [
      'Services step: per-service “What this creates” (cost levers, destroy order, Azure links).',
      'Help: generator changelog (this list) with recent template and catalog changes.',
    ],
  },
  {
    date: '2025-03-24',
    title: 'Multi-environment & ordering',
    bullets: [
      'Terraform: variable `environment`, merged `Environment` tag, `terraform.tfvars.example`.',
      'Bicep: `param environment`, `mergedTags`, `main.bicepparam` example.',
      'Explicit `depends_on` where it helps Azure create/destroy order (network, diagnostics, PEs, etc.).',
    ],
  },
  {
    date: '2025-03-24',
    title: 'Advanced IaC',
    bullets: [
      'Optional `config.iac`: tags, SKUs, zones, diagnostics, private endpoints (Terraform + Bicep).',
      'Web: Advanced IaC panel on Summary; resource group default `rg-{project}`.',
    ],
  },
];
