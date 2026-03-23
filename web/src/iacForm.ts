import type { IacSettings } from './types';

/** Form state for the optional “Advanced IaC” panel on the summary step. */
export interface IacFormState {
  namePrefix: string;
  nameSuffix: string;
  /** One `key=value` per line, optional extra tags merged with server default `Project` tag. */
  tagsLines: string;
  enableDiagnostics: boolean;
  enablePrivateEndpoints: boolean;
  sqlZoneRedundant: boolean;
  vmAvailabilityZone: '' | '1' | '2' | '3';
  appServicePlanSku: string;
  aksNodeVmSize: string;
  aksNodeCount: number;
  storageReplication: string;
  apimSku: string;
  cosmosEnableFreeTier: boolean;
}

export const DEFAULT_IAC_FORM: IacFormState = {
  namePrefix: '',
  nameSuffix: '',
  tagsLines: '',
  enableDiagnostics: false,
  enablePrivateEndpoints: false,
  sqlZoneRedundant: false,
  vmAvailabilityZone: '',
  appServicePlanSku: 'B1',
  aksNodeVmSize: 'Standard_DS2_v2',
  aksNodeCount: 3,
  storageReplication: 'LRS',
  apimSku: 'Developer_1',
  cosmosEnableFreeTier: true,
};

/** Build API `config.iac` from the summary-step form (when the panel is enabled). */
export function iacSettingsFromForm(form: IacFormState): IacSettings {
  const tags: Record<string, string> = {};
  for (const line of form.tagsLines.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (k) tags[k] = v;
  }
  const prod: NonNullable<IacSettings['production']> = {};
  if (form.enableDiagnostics) prod.enableDiagnostics = true;
  if (form.enablePrivateEndpoints) prod.enablePrivateEndpoints = true;
  if (form.sqlZoneRedundant) prod.sqlZoneRedundant = true;
  if (form.vmAvailabilityZone) prod.vmAvailabilityZone = form.vmAvailabilityZone;
  if (form.appServicePlanSku.trim()) prod.appServicePlanSku = form.appServicePlanSku.trim();
  if (form.aksNodeVmSize.trim()) prod.aksNodeVmSize = form.aksNodeVmSize.trim();
  if (Number.isFinite(form.aksNodeCount) && form.aksNodeCount > 0) prod.aksNodeCount = form.aksNodeCount;
  if (form.storageReplication.trim()) prod.storageReplication = form.storageReplication.trim();
  if (form.apimSku.trim()) prod.apimSku = form.apimSku.trim();
  if (!form.cosmosEnableFreeTier) prod.cosmosEnableFreeTier = false;

  const conventions: NonNullable<IacSettings['conventions']> = {};
  if (form.namePrefix.trim()) conventions.namePrefix = form.namePrefix.trim();
  if (form.nameSuffix.trim()) conventions.nameSuffix = form.nameSuffix.trim();
  if (Object.keys(tags).length > 0) conventions.tags = tags;

  const out: IacSettings = {};
  if (Object.keys(conventions).length > 0) out.conventions = conventions;
  if (Object.keys(prod).length > 0) out.production = prod;
  return out;
}
