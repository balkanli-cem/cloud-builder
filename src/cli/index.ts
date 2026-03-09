import chalk from 'chalk';
import path from 'path';
import { promptProject }  from './screens/project';
import { promptNetwork }  from './screens/network';
import { promptServices } from './screens/services';
import { promptSummary }  from './screens/summary';
import { generateBicep }      from '../generators/bicep/index';
import { generateTerraform }  from '../generators/terraform/index';
import type { ProjectConfig } from '../types/index';

export async function runCLI(): Promise<void> {
  // Step 1 — project basics
  const project = await promptProject();

  // Step 2 — network layout
  const network = await promptNetwork(project.projectName);

  // Step 3 — service selection
  const services = await promptServices(project.projectName, network.subnets);

  // Step 4 — review summary, pick format, confirm
  const config: ProjectConfig = { ...project, network, services };
  const { confirmed, format } = await promptSummary(config);

  if (!confirmed) return;

  // Step 5 — generate output
  const outputDir = path.join('output', config.projectName);

  if (format === 'bicep') {
    await generateBicep(config, outputDir);
  } else {
    await generateTerraform(config, outputDir);
  }

  console.log(chalk.green(`\n  Done! Files written to ./${outputDir}\n`));
}
