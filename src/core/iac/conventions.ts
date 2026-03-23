import type { ProjectConfig } from '../../types/index';

/** Defaults when `config.iac` is omitted. */
export function getIacSettings(config: ProjectConfig): IacResolved {
  const iac = config.iac ?? {};
  const conv = iac.conventions ?? {};
  const prod = iac.production ?? {};
  return {
    namePrefix: conv.namePrefix ?? '',
    nameSuffix: conv.nameSuffix ?? '',
    tags: {
      Project: config.projectName,
      ...(conv.tags ?? {}),
    },
    enableDiagnostics: prod.enableDiagnostics ?? false,
    enablePrivateEndpoints: prod.enablePrivateEndpoints ?? false,
    sqlZoneRedundant: prod.sqlZoneRedundant ?? false,
    vmAvailabilityZone: prod.vmAvailabilityZone ?? '',
    appServicePlanSku: prod.appServicePlanSku ?? 'B1',
    aksNodeVmSize: prod.aksNodeVmSize ?? 'Standard_DS2_v2',
    aksNodeCount: prod.aksNodeCount ?? 3,
    storageReplication: prod.storageReplication ?? 'LRS',
    apimSku: prod.apimSku ?? 'Developer_1',
    cosmosEnableFreeTier: prod.cosmosEnableFreeTier ?? true,
  };
}

export interface IacResolved {
  namePrefix: string;
  nameSuffix: string;
  tags: Record<string, string>;
  enableDiagnostics: boolean;
  enablePrivateEndpoints: boolean;
  sqlZoneRedundant: boolean;
  vmAvailabilityZone: string;
  appServicePlanSku: string;
  aksNodeVmSize: string;
  aksNodeCount: number;
  /** LRS, GRS, ZRS (passed to Terraform account_replication_type). */
  storageReplication: string;
  apimSku: string;
  cosmosEnableFreeTier: boolean;
}

/**
 * Build a resource name segment with optional prefix/suffix (Azure-safe: lowercase, hyphens).
 * Does not enforce per-resource length limits; callers may truncate.
 */
export function resolveResourceNameSegment(base: string, config: ProjectConfig): string {
  const { namePrefix, nameSuffix } = getIacSettings(config);
  const raw = `${namePrefix}${base}${nameSuffix}`;
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Storage account name: 3–24 chars, lowercase letters and numbers only. */
export function sanitizeStorageAccountName(base: string, config: ProjectConfig): string {
  const merged = resolveResourceNameSegment(base, config).replace(/-/g, '');
  const s = (merged || 'st').slice(0, 24);
  if (s.length < 3) return 'stg' + s;
  return s;
}

/** Serialize Terraform map(string) default block for HCL. */
export function tfMapString(tags: Record<string, string>): string {
  const lines = Object.entries(tags).map(([k, v]) => `    "${escapeTfInterp(k)}" = "${escapeTfInterp(v)}"`);
  return `{\n${lines.join('\n')}\n  }`;
}

function escapeTfInterp(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
