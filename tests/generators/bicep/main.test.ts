import { renderMainBicep } from '../../../src/generators/bicep/main';
import type { ProjectConfig } from '../../../src/types';

function minimalConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    projectName: 'test-proj',
    resourceGroupName: 'test-proj-rg',
    region: 'westeurope',
    network: {
      vnetName: 'test-proj-vnet',
      addressSpace: '10.50.0.0/16',
      subnets: [
        { name: 'Frontend', addressPrefix: '10.50.1.0/24' },
        { name: 'Backend', addressPrefix: '10.50.2.0/24' },
      ],
    },
    services: [
      { type: 'storage-account', name: 'testprojstorage', subnetPlacement: 'Backend', config: {} },
    ],
  };
}

describe('renderMainBicep', () => {
  it('includes location param and network module', () => {
    const out = renderMainBicep(minimalConfig());
    expect(out).toContain("param location string = 'westeurope'");
    expect(out).toContain("param environment string = 'dev'");
    expect(out).toContain('var mergedTags = union(tags, { Environment: environment })');
    expect(out).toContain("module network './modules/network.bicep'");
    expect(out).toContain('test-proj-vnet');
  });

  it('deploys one module per service with correct name', () => {
    const out = renderMainBicep(minimalConfig());
    expect(out).toContain("name: 'testprojstorage'");
    expect(out).toContain("./modules/storage-account.bicep");
  });
});
