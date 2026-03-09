import { input, select } from '@inquirer/prompts';
import chalk from 'chalk';
import figlet from 'figlet';
import boxen from 'boxen';
import type { AzureRegion, ProjectConfig } from '../../types/index';

type ProjectResult = Pick<ProjectConfig, 'projectName' | 'resourceGroupName' | 'region'>;

const NAME_REGEX = /^[a-z0-9-]+$/;

function validateName(value: string): string | true {
  if (!value.trim()) return 'Value cannot be empty.';
  if (!NAME_REGEX.test(value)) return 'Only lowercase letters, numbers, and hyphens are allowed.';
  return true;
}

function printBanner(): void {
  const banner = figlet.textSync('Cloud Builder', { font: 'Standard' });
  const subtitle = chalk.gray('Azure Infrastructure Wizard  |  Bicep output');
  const box = boxen(`${chalk.cyan(banner)}\n${subtitle}`, {
    padding: 1,
    borderStyle: 'round',
    borderColor: 'cyan',
    textAlignment: 'center',
  });
  console.log(box);
}

export async function promptProject(): Promise<ProjectResult> {
  printBanner();

  const projectName = await input({
    message: chalk.white('Project name') + chalk.gray(' (lowercase, hyphens allowed)'),
    validate: validateName,
  });

  const resourceGroupName = await input({
    message: chalk.white('Resource group name'),
    default: `${projectName}-rg`,
    validate: validateName,
  });

  const region = await select<AzureRegion>({
    message: chalk.white('Azure region'),
    choices: [
      { name: 'West Europe',      value: 'westeurope' },
      { name: 'Sweden Central',   value: 'swedencentral' },
      { name: 'Belgium Central',  value: 'belgiumcentral' },
    ],
  });

  return { projectName, resourceGroupName, region };
}
