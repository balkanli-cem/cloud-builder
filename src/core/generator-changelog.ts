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
