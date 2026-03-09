// Returns the default safe network layout auto-applied to every project
import type { NetworkConfig } from '../../types/index';

export function buildDefaultNetwork(projectName: string): NetworkConfig {
  return {
    vnetName: `${projectName}-vnet`,
    addressSpace: '10.50.0.0/16',
    subnets: [
      { name: 'Frontend', addressPrefix: '10.50.1.0/24' },
      { name: 'Backend',  addressPrefix: '10.50.2.0/24' },
      { name: 'DB',       addressPrefix: '10.50.3.0/24' },
    ],
  };
}
