import type { NetworkConfig } from '../../types/index.js';

export function renderNetworkBicep(network: NetworkConfig): string {
  const subnetItems = network.subnets
    .map(s =>
      `    {\n      name: '${s.name}'\n      addressPrefix: '${s.addressPrefix}'\n    }`,
    )
    .join('\n');

  return `param location string
param vnetName string
param addressSpace string
param subnets array

resource vnet 'Microsoft.Network/virtualNetworks@2024-01-01' = {
  name: vnetName
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: [
        addressSpace
      ]
    }
    subnets: [for subnet in subnets: {
      name: subnet.name
      properties: {
        addressPrefix: subnet.addressPrefix
      }
    }]
  }
}

output vnetId string = vnet.id
output subnetIds object = toObject(vnet.properties.subnets, subnet => subnet.name, subnet => subnet.id)
`;
}
