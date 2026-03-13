import { checkbox, confirm, input, select } from '@inquirer/prompts';
import chalk from 'chalk';
import boxen from 'boxen';
import { SERVICE_CATALOG } from '../../core/services/catalog';
import type { AzureService, SubnetConfig, VMConfig, VMSSConfig } from '../../types/index';

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

const VM_SIZES = [
  'Standard_B1s',
  'Standard_B2s',
  'Standard_D2s_v3',
  'Standard_D4s_v3',
  'Standard_DS2_v2',
];

async function promptVMConfig(name: string): Promise<VMConfig> {
  const enablePublicIp = await confirm({
    message: chalk.white('    Assign a public IP?'),
    default: true,
  });
  const nicName = await input({
    message: chalk.white('    NIC name'),
    default: `${name}-nic`,
    validate: validateResourceName,
  });
  const vmSize = await select({
    message: chalk.white('    VM size'),
    choices: VM_SIZES.map(s => ({ name: s, value: s })),
    default: 'Standard_B2s',
  });
  const osType = await select<'Linux' | 'Windows'>({
    message: chalk.white('    OS type'),
    choices: [
      { name: 'Linux', value: 'Linux' },
      { name: 'Windows', value: 'Windows' },
    ],
    default: 'Linux',
  });
  const adminUsername = await input({
    message: chalk.white('    Admin username'),
    default: 'azureuser',
  });
  const osDiskSizeGb = parseInt(
    await input({
      message: chalk.white('    OS disk size (GB)'),
      default: '30',
      validate: (v) => {
        const n = parseInt(v, 10);
        if (Number.isNaN(n) || n < 1 || n > 4096) return 'Enter a number between 1 and 4096.';
        return true;
      },
    }),
    10,
  );
  return {
    enablePublicIp,
    nicName,
    vmSize,
    osType,
    adminUsername,
    osDiskSizeGb,
  };
}

async function promptVMSSConfig(name: string): Promise<VMSSConfig> {
  const nicName = await input({
    message: chalk.white('    NIC name (prefix for scale set)'),
    default: `${name}-nic`,
    validate: validateResourceName,
  });
  const vmSize = await select({
    message: chalk.white('    VM size'),
    choices: VM_SIZES.map(s => ({ name: s, value: s })),
    default: 'Standard_B2s',
  });
  const osType = await select<'Linux' | 'Windows'>({
    message: chalk.white('    OS type'),
    choices: [
      { name: 'Linux', value: 'Linux' },
      { name: 'Windows', value: 'Windows' },
    ],
    default: 'Linux',
  });
  const instanceCountMin = parseInt(
    await input({
      message: chalk.white('    Min instances (scale-in floor)'),
      default: '1',
      validate: (v) => {
        const n = parseInt(v, 10);
        if (Number.isNaN(n) || n < 0) return 'Enter a non-negative number.';
        return true;
      },
    }),
    10,
  );
  const instanceCountMax = parseInt(
    await input({
      message: chalk.white('    Max instances (scale-out ceiling)'),
      default: '10',
      validate: (v) => {
        const n = parseInt(v, 10);
        if (Number.isNaN(n) || n < 1) return 'Enter a number >= 1.';
        return true;
      },
    }),
    10,
  );
  const scaleOutCpuPercent = parseInt(
    await input({
      message: chalk.white('    Scale-out when CPU % above'),
      default: '70',
      validate: (v) => {
        const n = parseInt(v, 10);
        if (Number.isNaN(n) || n < 1 || n > 100) return 'Enter a number between 1 and 100.';
        return true;
      },
    }),
    10,
  );
  const scaleInCpuPercent = parseInt(
    await input({
      message: chalk.white('    Scale-in when CPU % below'),
      default: '30',
      validate: (v) => {
        const n = parseInt(v, 10);
        if (Number.isNaN(n) || n < 0 || n > 100) return 'Enter a number between 0 and 100.';
        return true;
      },
    }),
    10,
  );
  return {
    nicName,
    vmSize,
    osType,
    instanceCountMin,
    instanceCountMax,
    scaleOutCpuPercent,
    scaleInCpuPercent,
  };
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

    let config: Record<string, unknown> = {};
    if (type === 'vm') {
      config = (await promptVMConfig(name)) as Record<string, unknown>;
    } else if (type === 'vmss') {
      config = (await promptVMSSConfig(name)) as Record<string, unknown>;
    }

    services.push({
      type,
      name,
      subnetPlacement,
      config,
    });

    console.log('');
  }

  return services;
}
