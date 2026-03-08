import fs from 'fs/promises';
import path from 'path';
import type { AzureService, ProjectConfig } from '../../types/index.js';
import { renderMainTf, renderVariablesTf, renderOutputsTf } from './main.js';
import { renderNetworkTerraform } from './network.js';
import { renderServiceTerraform } from './services.js';

export async function generateTerraform(config: ProjectConfig, outputDir: string): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });

  await fs.writeFile(path.join(outputDir, 'main.tf'),      renderMainTf(config),       'utf8');
  await fs.writeFile(path.join(outputDir, 'variables.tf'), renderVariablesTf(config),  'utf8');
  await fs.writeFile(path.join(outputDir, 'outputs.tf'),   renderOutputsTf(),           'utf8');
  await fs.writeFile(path.join(outputDir, 'network.tf'),   renderNetworkTerraform(config.network), 'utf8');

  // one .tf file per service type; each file contains all instances of that type
  const byType = new Map<string, AzureService[]>();
  for (const svc of config.services) {
    const list = byType.get(svc.type) ?? [];
    list.push(svc);
    byType.set(svc.type, list);
  }
  for (const [type, services] of byType) {
    await fs.writeFile(
      path.join(outputDir, `${type}.tf`),
      renderServiceTerraform(services),
      'utf8',
    );
  }
}
