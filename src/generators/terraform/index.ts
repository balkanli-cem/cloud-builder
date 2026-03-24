import fs from 'fs/promises';
import path from 'path';
import type { AzureService, ProjectConfig } from '../../types/index';
import { projectUsesSharedNetwork } from '../../core/services/networkPolicy';
import { renderMainTf, renderVariablesTf, renderOutputsTf, renderTerraformTfvarsExample } from './main';
import { renderNetworkTerraform } from './network';
import { renderDiagnosticsTerraform } from './diagnostics';
import { renderServiceTerraform } from './services';

export async function generateTerraform(config: ProjectConfig, outputDir: string): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });

  const includeNet = projectUsesSharedNetwork(config.services);

  await fs.writeFile(path.join(outputDir, 'main.tf'), renderMainTf(config), 'utf8');
  await fs.writeFile(path.join(outputDir, 'variables.tf'), renderVariablesTf(config), 'utf8');
  await fs.writeFile(path.join(outputDir, 'outputs.tf'), renderOutputsTf(includeNet), 'utf8');
  await fs.writeFile(
    path.join(outputDir, 'network.tf'),
    includeNet
      ? renderNetworkTerraform(config.network)
      : `# No shared virtual network — services use managed networking or do not require this VNet.\n`,
    'utf8',
  );

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
      renderServiceTerraform(config, services),
      'utf8',
    );
  }

  await fs.writeFile(path.join(outputDir, 'diagnostics.tf'), renderDiagnosticsTerraform(config), 'utf8');
  await fs.writeFile(path.join(outputDir, 'terraform.tfvars.example'), renderTerraformTfvarsExample(config), 'utf8');
}
