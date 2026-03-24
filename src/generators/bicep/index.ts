import fs from 'fs/promises';
import path from 'path';
import type { ProjectConfig } from '../../types/index';
import { renderMainBicep, renderMainBicepparam } from './main';
import { renderNetworkBicep } from './network';
import { renderServiceBicep } from './services';

export async function generateBicep(config: ProjectConfig, outputDir: string): Promise<void> {
  const modulesDir = path.join(outputDir, 'modules');
  await fs.mkdir(modulesDir, { recursive: true });

  // main.bicep
  await fs.writeFile(
    path.join(outputDir, 'main.bicep'),
    renderMainBicep(config),
    'utf8',
  );

  await fs.writeFile(
    path.join(outputDir, 'main.bicepparam'),
    renderMainBicepparam(config),
    'utf8',
  );

  // modules/network.bicep
  await fs.writeFile(
    path.join(modulesDir, 'network.bicep'),
    renderNetworkBicep(config.network),
    'utf8',
  );

  // modules/<service-type>.bicep — one file per unique service type
  const writtenTypes = new Set<string>();
  for (const svc of config.services) {
    if (writtenTypes.has(svc.type)) continue;
    await fs.writeFile(
      path.join(modulesDir, `${svc.type}.bicep`),
      renderServiceBicep(svc.type),
      'utf8',
    );
    writtenTypes.add(svc.type);
  }
}
