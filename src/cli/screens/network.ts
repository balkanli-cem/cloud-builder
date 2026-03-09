import { input, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import boxen from 'boxen';
import { buildDefaultNetwork } from '../../core/network/defaults';
import type { NetworkConfig, SubnetConfig } from '../../types/index';

const CIDR_REGEX = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/;
const NAME_REGEX = /^[a-z0-9-]+$/;

function validateCIDR(value: string): string | true {
  if (!CIDR_REGEX.test(value)) return 'Enter a valid CIDR block, e.g. 10.50.1.0/24';
  return true;
}

function validateName(value: string): string | true {
  if (!value.trim()) return 'Value cannot be empty.';
  if (!NAME_REGEX.test(value)) return 'Only lowercase letters, numbers, and hyphens are allowed.';
  return true;
}

function validateSubnetLabel(value: string): string | true {
  if (!value.trim()) return 'Subnet name cannot be empty.';
  if (/\s/.test(value)) return 'Subnet name cannot contain spaces.';
  return true;
}

function printNetworkSummary(network: NetworkConfig): void {
  const subnetLines = network.subnets
    .map(s => `  ${chalk.cyan(s.name.padEnd(12))} ${chalk.gray(s.addressPrefix)}`)
    .join('\n');

  const content =
    chalk.bold('Network Layout\n\n') +
    `  ${chalk.green('VNet')}         ${chalk.white(network.vnetName)}\n` +
    `  ${chalk.green('Address Space')} ${chalk.white(network.addressSpace)}\n\n` +
    chalk.bold('Subnets\n') +
    subnetLines;

  console.log(
    boxen(content, {
      padding: 1,
      borderStyle: 'round',
      borderColor: 'blue',
    }),
  );
}

export async function promptNetwork(projectName: string): Promise<NetworkConfig> {
  const defaults = buildDefaultNetwork(projectName);

  printNetworkSummary(defaults);

  const useDefaults = await confirm({
    message: chalk.white('Use this default network layout?'),
    default: true,
  });

  let vnetName = defaults.vnetName;
  let addressSpace = defaults.addressSpace;
  let subnets: SubnetConfig[] = defaults.subnets.map(s => ({ ...s }));

  if (!useDefaults) {
    vnetName = await input({
      message: chalk.white('VNet name'),
      default: defaults.vnetName,
      validate: validateName,
    });

    addressSpace = await input({
      message: chalk.white('Address space'),
      default: defaults.addressSpace,
      validate: validateCIDR,
    });

    console.log(chalk.gray('\n  Customise subnet address prefixes:\n'));
    const updatedSubnets: SubnetConfig[] = [];
    for (const subnet of subnets) {
      const prefix = await input({
        message: chalk.white(`  ${subnet.name} prefix`),
        default: subnet.addressPrefix,
        validate: validateCIDR,
      });
      updatedSubnets.push({ name: subnet.name, addressPrefix: prefix });
    }
    subnets = updatedSubnets;
  }

  const addCustom = await confirm({
    message: chalk.white('Add a custom subnet?'),
    default: false,
  });

  if (addCustom) {
    const customName = await input({
      message: chalk.white('  Subnet name'),
      validate: validateSubnetLabel,
    });
    const customPrefix = await input({
      message: chalk.white('  Address prefix'),
      validate: validateCIDR,
    });
    subnets.push({ name: customName, addressPrefix: customPrefix });
  }

  return { vnetName, addressSpace, subnets };
}
