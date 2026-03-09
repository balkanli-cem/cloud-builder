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
});
