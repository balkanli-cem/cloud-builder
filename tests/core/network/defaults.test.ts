import { buildDefaultNetwork } from '../../../src/core/network/defaults';

describe('buildDefaultNetwork', () => {
  it('returns vnet name with project suffix', () => {
    const net = buildDefaultNetwork('my-app');
    expect(net.vnetName).toBe('my-app-vnet');
  });

  it('uses fixed address space 10.50.0.0/16', () => {
    const net = buildDefaultNetwork('any');
    expect(net.addressSpace).toBe('10.50.0.0/16');
  });

  it('returns Frontend, Backend, DB subnets with expected prefixes', () => {
    const net = buildDefaultNetwork('proj');
    expect(net.subnets).toHaveLength(3);
    expect(net.subnets[0]).toEqual({ name: 'Frontend', addressPrefix: '10.50.1.0/24' });
    expect(net.subnets[1]).toEqual({ name: 'Backend', addressPrefix: '10.50.2.0/24' });
    expect(net.subnets[2]).toEqual({ name: 'DB', addressPrefix: '10.50.3.0/24' });
  });
});
