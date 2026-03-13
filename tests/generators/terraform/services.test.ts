import { renderServiceTerraform } from '../../../src/generators/terraform/services';
import type { AzureService } from '../../../src/types';

describe('renderServiceTerraform', () => {
  it('returns empty string for empty array', () => {
    expect(renderServiceTerraform([])).toBe('');
  });

  it('emits one cosmos-db resource for single service', () => {
    const services: AzureService[] = [
      { type: 'cosmos-db', name: 'my-app-cosmos', subnetPlacement: 'DB', config: {} },
    ];
    const out = renderServiceTerraform(services);
    expect(out).toContain('azurerm_cosmosdb_account');
    expect(out).toContain('my-app-cosmos');
    expect(out).toContain('azurerm_subnet.db.id');
  });

  it('emits two cosmos-db resources for two services of same type', () => {
    const services: AzureService[] = [
      { type: 'cosmos-db', name: 'main-db', subnetPlacement: 'DB', config: {} },
      { type: 'cosmos-db', name: 'analytics-db', subnetPlacement: 'Backend', config: {} },
    ];
    const out = renderServiceTerraform(services);
    expect(out).toContain('main-db');
    expect(out).toContain('analytics-db');
    expect((out.match(/resource "azurerm_cosmosdb_account"/g) ?? []).length).toBe(2);
  });

  it('emits data block once for multiple key vaults', () => {
    const services: AzureService[] = [
      { type: 'key-vault', name: 'kv-a', subnetPlacement: 'Backend', config: {} },
      { type: 'key-vault', name: 'kv-b', subnetPlacement: 'Backend', config: {} },
    ];
    const out = renderServiceTerraform(services);
    const dataBlockCount = (out.match(/data "azurerm_client_config" "current"/g) ?? []).length;
    expect(dataBlockCount).toBe(1);
    expect(out).toContain('kv-a');
    expect(out).toContain('kv-b');
  });

  it('emits VM resources with config (public IP, NIC, Linux VM)', () => {
    const services: AzureService[] = [
      {
        type: 'vm',
        name: 'my-vm',
        subnetPlacement: 'Backend',
        config: {
          enablePublicIp: true,
          nicName: 'my-vm-nic',
          vmSize: 'Standard_B2s',
          osType: 'Linux',
          adminUsername: 'azureuser',
          osDiskSizeGb: 30,
        },
      },
    ];
    const out = renderServiceTerraform(services);
    expect(out).toContain('azurerm_public_ip');
    expect(out).toContain('azurerm_network_interface');
    expect(out).toContain('azurerm_linux_virtual_machine');
    expect(out).toContain('my-vm-nic');
    expect(out).toContain('Standard_B2s');
  });

  it('emits VMSS with autoscale settings', () => {
    const services: AzureService[] = [
      {
        type: 'vmss',
        name: 'my-vmss',
        subnetPlacement: 'Backend',
        config: {
          vmSize: 'Standard_B2s',
          osType: 'Linux',
          instanceCountMin: 2,
          instanceCountMax: 20,
          scaleOutCpuPercent: 75,
          scaleInCpuPercent: 25,
        },
      },
    ];
    const out = renderServiceTerraform(services);
    expect(out).toContain('azurerm_linux_virtual_machine_scale_set');
    expect(out).toContain('azurerm_monitor_autoscale_setting');
    expect(out).toContain('minimum = 2');
    expect(out).toContain('maximum = 20');
    expect(out).toContain('threshold           = 75');
    expect(out).toContain('threshold           = 25');
  });
});
