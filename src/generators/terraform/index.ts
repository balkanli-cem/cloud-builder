import fs from 'fs/promises';
import path from 'path';
import type { ProjectConfig } from '../../types/index.js';
import { renderMainTf, renderVariablesTf, renderOutputsTf } from './main.js';
import { renderNetworkTerraform } from './network.js';
import { renderServiceTerraform } from './services.js';

export async function generateTerraform(config: ProjectConfig, outputDir: string): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });

  await fs.writeFile(path.join(outputDir, 'main.tf'),      renderMainTf(config),       'utf8');
  await fs.writeFile(path.join(outputDir, 'variables.tf'), renderVariablesTf(config),  'utf8');
  await fs.writeFile(path.join(outputDir, 'outputs.tf'),   renderOutputsTf(),           'utf8');
  await fs.writeFile(path.join(outputDir, 'network.tf'),   renderNetworkTerraform(config.network), 'utf8');

  // one .tf file per unique service type, named after the service instance
  const writtenTypes = new Set<string>();
  for (const svc of config.services) {
    if (writtenTypes.has(svc.type)) continue;
    await fs.writeFile(
      path.join(outputDir, `${svc.type}.tf`),
      renderServiceTerraform(svc),
      'utf8',
    );
    writtenTypes.add(svc.type);
  }
}
