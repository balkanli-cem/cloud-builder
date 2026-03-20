import type { AzureService, AzureServiceType } from '../../types/index';
import { SERVICE_CATALOG } from './catalog';

/**
 * Whether a catalog entry requires placement in the shared wizard VNet.
 * `subnet_optional` (e.g. AKS) can use managed networking without that VNet.
 */
export function getNetworkMode(type: AzureServiceType): 'subnet_required' | 'subnet_optional' {
  const entry = SERVICE_CATALOG.find((e) => e.type === type);
  return entry?.networkMode ?? 'subnet_required';
}

/**
 * True if this service instance should be wired to the shared VNet in generated IaC.
 * - Required types: always true (subnetPlacement must be set).
 * - Optional types: true only when subnetPlacement is set (user chose "Use shared VNet").
 */
export function serviceUsesSharedSubnet(svc: AzureService): boolean {
  const mode = getNetworkMode(svc.type);
  if (mode === 'subnet_required') return true;
  return !!(svc.subnetPlacement && String(svc.subnetPlacement).trim().length > 0);
}

export function projectUsesSharedNetwork(services: AzureService[]): boolean {
  return services.some(serviceUsesSharedSubnet);
}
