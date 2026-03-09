import { checkbox, input, select } from '@inquirer/prompts';
import chalk from 'chalk';
import boxen from 'boxen';
import { SERVICE_CATALOG } from '../../core/services/catalog';
import type { AzureService, SubnetConfig } from '../../types/index';

const NAME_REGEX = /^[a-z0-9-]+$/;

function validateResourceName(value: string): string | true {
  if (!value.trim()) return 'Name cannot be empty.';
  if (!NAME_REGEX.test(value)) return 'Only lowercase letters, numbers, and hyphens are allowed.';
  return true;
}

function printServiceHeader(): void {
  const content =
    chalk.bold('Azure Services\n\n') +
    chalk.gray('  Select the services to include in your infrastructure.\n') +
    chalk.gray('  Each service will be placed into a subnet and given a resource name.');

  console.log(
    boxen(content, {
      padding: 1,
      borderStyle: 'round',
      borderColor: 'yellow',
    }),
  );
}

export async function promptServices(
  projectName: string,
  subnets: SubnetConfig[],
): Promise<AzureService[]> {
  printServiceHeader();

  const selectedTypes = await checkbox({
    message: chalk.white('Select Azure services'),
    choices: SERVICE_CATALOG.map(entry => ({
      name: `${entry.label.padEnd(36)} ${chalk.gray(entry.description)}`,
      value: entry.type,
      checked: false,
    })),
    validate: (choices) => choices.length > 0 || 'Select at least one service.',
  });

  const subnetNames = subnets.map(s => s.name);
  const services: AzureService[] = [];

  console.log('');
  console.log(chalk.bold('  Configure each selected service:\n'));

  for (const type of selectedTypes) {
    const entry = SERVICE_CATALOG.find(e => e.type === type)!;

    console.log(chalk.cyan(`  -- ${entry.label} --`));

    const name = await input({
      message: chalk.white('    Resource name'),
      default: `${projectName}-${type}`,
      validate: validateResourceName,
    });

    const defaultSubnet = subnetNames.includes(entry.defaultSubnet)
      ? entry.defaultSubnet
      : subnetNames[0];

    const subnetPlacement = await select<string>({
      message: chalk.white('    Subnet placement'),
      choices: subnetNames.map(sn => ({ name: sn, value: sn })),
      default: defaultSubnet,
    });

    services.push({
      type,
      name,
      subnetPlacement,
      config: {}, // per-service deep config is a future step
    });

    console.log('');
  }

  return services;
}
