export interface SalesDataEntry {
  region: string;
  country: string;
  brands: string;
  currentDeviceCount: number | null;
  activatedCount: number | null;
  forecastNextYear: number | null;
  disneyPlusOnRemote: boolean;
  disneyPlusPreinstalled: boolean;
}

export interface ScoreBreakdown {
  hardware: number;
  codec: number;
  drm: number;
  display: number;
  security: number;
}

export interface Device {
  id: string;
  modelName: string;
  modelNumber: string;
  manufacturer: string;
  operator: string;
  deviceType: string;
  platform: string;
  hardwareOs: string | null;

  region: string | null;
  liveAdkVersion: string | null;
  is64Bit: boolean;
  performanceCategory: string | null;

  deploymentDate: string | null;
  deliveryEndDate: string | null;
  activeDeviceCount: string | null;
  subscriberCount: string | null;
  countries: string[];
  thirdPartyApps: string[];
  connectionType: string | null;

  socVendor: string | null;
  socModel: string | null;
  socRevision: string | null;
  cpuSpeedDmips: number | null;
  cpuCores: number | null;
  osName: string | null;
  osVersion: string | null;
  middlewareProvider: string | null;
  middlewareVersion: string | null;
  memoryCapacityGb: number | null;
  memoryType: string | null;
  ramForDisneyMb: number | null;
  storageCapacityGb: number | null;
  storageType: string | null;
  hdmiVersion: string | null;

  supportsH264: boolean;
  supportsH265: boolean;
  supportsEAC3: boolean;
  supportsDolbyAtmos: boolean;
  supportsHDR10: boolean;
  supportsDolbyVision: boolean;
  dolbyVisionProfiles: string[];
  supportsHLG: boolean;
  supportsHDR10Plus: boolean;
  maxVideoResolution: string | null;
  maxFrameRate: number | null;

  playReadyVersion: string | null;
  playReadySecurityLevel: string | null;
  widevineVersion: string | null;
  widevineSecurityLevel: string | null;
  hdcpVersion: string | null;
  supportsSecureBoot: boolean;
  supportsTEE: boolean;
  supportsSecureVideoPath: boolean;

  salesData: SalesDataEntry[];

  deviceScore: number;
  scoreBreakdown: ScoreBreakdown;

  sourceFiles: string[];
  conflicts: string[];
  lastUpdated: string;
  importedAt: string;
}

export type ScoreTier = 'excellent' | 'good' | 'adequate' | 'limited' | 'poor';

export function getScoreTier(score: number): ScoreTier {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'adequate';
  if (score >= 20) return 'limited';
  return 'poor';
}

export function getScoreColor(score: number): string {
  const tier = getScoreTier(score);
  const colors: Record<ScoreTier, string> = {
    excellent: '#16a34a',
    good: '#2563eb',
    adequate: '#ca8a04',
    limited: '#ea580c',
    poor: '#dc2626',
  };
  return colors[tier];
}

export function getScoreLabel(score: number): string {
  const tier = getScoreTier(score);
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export type PartnerStatus = 'Current' | 'Sold' | 'Discontinued' | 'Spun off';

export interface Partner {
  id: string;
  name: string;
  parentId: string | null;
  country: string | null;
  region: string | null;
  entityType: string;
  serviceType: string;
  status: PartnerStatus;
  notes: string;
}
