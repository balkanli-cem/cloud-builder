// Quick smoke-test: generates both Bicep and Terraform output from a mock config.
// Run with: node test-generate.mjs
import { generateBicep }     from './dist/generators/bicep/index.js';
import { generateTerraform } from './dist/generators/terraform/index.js';

const config = {
  projectName:       'my-app',
  resourceGroupName: 'my-app-rg',
  region:            'westeurope',
  network: {
    vnetName:     'my-app-vnet',
    addressSpace: '10.50.0.0/16',
    subnets: [
      { name: 'Frontend', addressPrefix: '10.50.1.0/24' },
      { name: 'Backend',  addressPrefix: '10.50.2.0/24' },
      { name: 'DB',       addressPrefix: '10.50.3.0/24' },
      { name: 'Custom',   addressPrefix: '10.50.4.0/24' },
    ],
  },
  services: [
    { type: 'app-service',    name: 'my-app-web',     subnetPlacement: 'Frontend', config: {} },
    { type: 'aks',            name: 'my-app-aks',     subnetPlacement: 'Backend',  config: {} },
    { type: 'azure-sql',      name: 'my-app-sql',     subnetPlacement: 'DB',       config: {} },
    { type: 'cosmos-db',      name: 'my-app-cosmos',  subnetPlacement: 'DB',       config: {} },
    { type: 'storage-account',name: 'myappstorage',   subnetPlacement: 'Backend',  config: {} },
    { type: 'key-vault',      name: 'my-app-kv',      subnetPlacement: 'Backend',  config: {} },
    { type: 'api-management', name: 'my-app-apim',    subnetPlacement: 'Frontend', config: {} },
    { type: 'container-apps', name: 'my-app-ca',      subnetPlacement: 'Custom',   config: {} },
  ],
};

await generateBicep(config, 'output/my-app/bicep');
console.log('Bicep output written to output/my-app/bicep/');

await generateTerraform(config, 'output/my-app/terraform');
console.log('Terraform output written to output/my-app/terraform/');
