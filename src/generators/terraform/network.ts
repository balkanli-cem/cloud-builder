import type { NetworkConfig } from '../../types/index';

export function renderNetworkTerraform(network: NetworkConfig): string {
  const subnetBlocks = network.subnets
    .map(
      s => `resource "azurerm_subnet" "${toTfId(s.name)}" {
  name                 = "${s.name}"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["${s.addressPrefix}"]

  depends_on = [azurerm_virtual_network.main]
}`,
    )
    .join('\n\n');

  return `resource "azurerm_virtual_network" "main" {
  name                = "${network.vnetName}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  address_space       = ["${network.addressSpace}"]

  depends_on = [azurerm_resource_group.main]
}

${subnetBlocks}
`;
}

export function toTfId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}
