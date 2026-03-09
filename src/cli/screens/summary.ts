import { confirm, select } from '@inquirer/prompts';
import chalk from 'chalk';
import boxen from 'boxen';
import { SERVICE_CATALOG } from '../../core/services/catalog';
import type { ProjectConfig, AzureRegion, OutputFormat } from '../../types/index';

export interface SummaryResult {
  confirmed: boolean;
  format: OutputFormat;
}

const REGION_LABELS: Record<AzureRegion, string> = {
  westeurope:     'West Europe',
  swedencentral:  'Sweden Central',
  belgiumcentral: 'Belgium Central',
};

function row(label: string, value: string): string {
  return `  ${chalk.green(label.padEnd(16))} ${chalk.white(value)}`;
}

function sectionTitle(title: string): string {
  return chalk.bold.yellow(`  ${title}\n`);
}

function buildSummary(config: ProjectConfig): string {
  const lines: string[] = [];

  // Project
  lines.push(sectionTitle('Project'));
  lines.push(row('Name',           config.projectName));
  lines.push(row('Resource Group', config.resourceGroupName));
  lines.push(row('Region',         REGION_LABELS[config.region]));

  // Network
  lines.push('');
  lines.push(sectionTitle('Network'));
  lines.push(row('VNet',           config.network.vnetName));
  lines.push(row('Address Space',  config.network.addressSpace));
  lines.push('');
  lines.push(`  ${chalk.green('Subnets')}`);
  for (const subnet of config.network.subnets) {
    lines.push(`    ${chalk.cyan(subnet.name.padEnd(14))} ${chalk.gray(subnet.addressPrefix)}`);
  }

  // Services
  lines.push('');
  lines.push(sectionTitle('Services'));
  if (config.services.length === 0) {
    lines.push(chalk.gray('  (none selected)'));
  } else {
    for (const svc of config.services) {
      const entry = SERVICE_CATALOG.find(e => e.type === svc.type);
      const label = entry?.label ?? svc.type;
      lines.push(`  ${chalk.cyan(svc.name.padEnd(32))} ${chalk.gray(label)}`);
      if (svc.subnetPlacement) {
        lines.push(`    ${chalk.gray('subnet →')} ${chalk.white(svc.subnetPlacement)}`);
      }
    }
  }

  return lines.join('\n');
}

export async function promptSummary(config: ProjectConfig): Promise<SummaryResult> {
  console.log(
    boxen(buildSummary(config), {
      title:          chalk.bold(' Infrastructure Summary '),
      titleAlignment: 'center',
      padding:        1,
      borderStyle:    'double',
      borderColor:    'green',
    }),
  );

  const format = await select<OutputFormat>({
    message: chalk.white('Output format'),
    choices: [
      { name: 'Bicep      (recommended for Azure-native workflows)', value: 'bicep' },
      { name: 'Terraform  (portable, multi-cloud IaC)',              value: 'terraform' },
    ],
  });

  const confirmed = await confirm({
    message: chalk.white(`Generate ${format === 'bicep' ? 'Bicep' : 'Terraform'} output for this configuration?`),
    default: true,
  });

  if (!confirmed) {
    console.log(chalk.yellow('\n  Aborted. No files were written.\n'));
  }

  return { confirmed, format };
}
