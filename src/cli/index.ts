import chalk from 'chalk';
import path from 'path';
import { promptProject }  from './screens/project.js';
import { promptNetwork }  from './screens/network.js';
import { promptServices } from './screens/services.js';
import { promptSummary }  from './screens/summary.js';
import { generateBicep }      from '../generators/bicep/index.js';
import { generateTerraform }  from '../generators/terraform/index.js';
import type { ProjectConfig } from '../types/index.js';

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
