import {
  renderNetworkTerraform,
  toTfId,
} from '../../../src/generators/terraform/network';

describe('toTfId', () => {
  it('lowercases and replaces non-alphanumeric with underscore', () => {
    expect(toTfId('Backend')).toBe('backend');
    expect(toTfId('my-app-db')).toBe('my_app_db');
  });
});

describe('renderNetworkTerraform', () => {
  it('includes vnet name and address space', () => {
    const out = renderNetworkTerraform({
      vnetName: 'test-vnet',
      addressSpace: '10.0.0.0/16',
      subnets: [],
    });
    expect(out).toContain('test-vnet');
    expect(out).toContain('10.0.0.0/16');
    expect(out).toContain('azurerm_virtual_network');
  });

  it('emits one subnet resource per subnet', () => {
    const out = renderNetworkTerraform({
      vnetName: 'v',
      addressSpace: '10.0.0.0/16',
      subnets: [
        { name: 'Frontend', addressPrefix: '10.0.1.0/24' },
        { name: 'Backend', addressPrefix: '10.0.2.0/24' },
      ],
    });
    expect(out).toContain('azurerm_subnet');
    expect(out).toContain('Frontend');
    expect(out).toContain('Backend');
    expect(out).toContain('10.0.1.0/24');
    expect(out).toContain('10.0.2.0/24');
  });
});
