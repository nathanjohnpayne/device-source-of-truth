const NOW = '2026-02-25T00:00:00.000Z';

export const fixtures = {
  partners: [
    {
      id: 'p1',
      displayName: 'Acme Devices',
      regions: ['NA', 'EMEA'],
      countriesIso2: ['US', 'GB'],
      createdAt: NOW,
      updatedAt: NOW,
    },
  ],

  partnerKeys: [
    {
      id: 'pk1',
      key: 'acme-stb-na',
      partnerId: 'p1',
      chipset: 'BCM7218',
      oem: 'Acme',
      region: 'NA',
      countries: ['US'],
    },
  ],

  devices: [
    {
      id: 'd1',
      displayName: 'Acme Streamer 4K',
      deviceId: 'acme-4k-001',
      partnerKeyId: 'pk1',
      deviceType: 'STB',
      status: 'active',
      liveAdkVersion: '7.3.1',
      certificationStatus: 'Certified',
      certificationNotes: null,
      lastCertifiedDate: NOW,
      questionnaireUrl: null,
      questionnaireFileUrl: null,
      activeDeviceCount: 150000,
      specCompleteness: 75,
      tierId: 't1',
      tierAssignedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: 'd2',
      displayName: 'Claro Brazil HD Legacy',
      deviceId: 'claro-brazil-hd-legacy',
      partnerKeyId: '',
      deviceType: 'STB',
      status: 'active',
      liveAdkVersion: null,
      certificationStatus: 'Not Submitted',
      certificationNotes: null,
      lastCertifiedDate: null,
      questionnaireUrl: null,
      questionnaireFileUrl: null,
      activeDeviceCount: 8000,
      specCompleteness: 0,
      tierId: null,
      tierAssignedAt: null,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ],

  deviceSpecs: [
    {
      id: 'ds1',
      deviceId: 'd1',
      identity: { deviceModel: 'Streamer 4K', manufacturer: 'Acme', brandName: 'Acme', modelYear: 2025, deviceCategory: 'STB' },
      soc: { socVendor: 'Broadcom', socModel: 'BCM7218', cpuArchitecture: 'ARM', cpuCores: 4, cpuSpeedMhz: 1800, cpuBenchmarkDmips: 12000, is64Bit: true },
      os: { osName: 'Linux', osVersion: '5.4', browserEngine: 'Cobalt', browserVersion: '25', jsEngineVersion: 'V8 11' },
      memory: { totalRamMb: 2048, appAvailableRamMb: 1536, totalStorageGb: 8, appAvailableStorageMb: 4096, swapMemoryMb: 512 },
      gpu: { gpuModel: 'Mali-G52', gpuVendor: 'ARM', gpuMemoryMb: 512, openGlVersion: '3.2', openGlEsVersion: '3.2', vulkanSupport: false, gpuBenchmark: 3200 },
      streaming: { adkVersion: '7.3.1', adkBuildType: 'release', htmlVersion: '5', cssVersion: '3', playerType: 'native', mseSupport: true, emeSupport: true },
      videoOutput: { maxResolution: '3840x2160', hdmiVersion: '2.1', hdcpVersion: '2.3', hdrSupport: true, hdr10Support: true, hdr10PlusSupport: false, hlgSupport: true, dolbyVisionSupport: false, dolbyVisionProfiles: null, displayRefreshRate: 60 },
      firmware: { firmwareVersion: '1.2.3', firmwareUpdateMethod: 'OTA', lastFirmwareDate: NOW, nextPlannedFirmwareDate: null, firmwareAutoUpdate: true, eolDate: null },
      codecs: { avcSupport: true, avcMaxProfile: 'High', avcMaxLevel: '5.1', hevcSupport: true, hevcMaxProfile: 'Main 10', hevcMaxLevel: '5.1', av1Support: false, vp9Support: true, eac3Support: true, ac4Support: false, dolbyAtmosSupport: false, aacSupport: true, opusSupport: false },
      frameRate: { maxFrameRate: 60, supports24fps: true, supports30fps: true, supports60fps: true, supportsAdaptiveFps: true, trickPlaySupport: true },
      drm: { widevineLevel: 'L1', widevineVersion: '16.0', playreadyLevel: 'SL3000', playreadyVersion: '4.0', fairplaySupport: false, hdcpSupport: true, hdcp2xSupport: true, secureMediaPipeline: true, attestationType: 'hardware' },
      security: { secureBootSupport: true, teeType: 'TrustZone', teeVersion: '3.0', hardwareRootOfTrust: true, secureStorageSupport: true, tamperDetection: false },
      updatedAt: NOW,
    },
  ],

  hardwareTiers: [
    {
      id: 't1',
      tierName: 'Tier 1',
      tierRank: 1,
      ramMin: 1024,
      gpuMin: 256,
      cpuSpeedMin: 1500,
      cpuCoresMin: 4,
      requiredCodecs: ['avc', 'hevc'],
      require64Bit: true,
      version: 1,
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: 't2',
      tierName: 'Tier 2',
      tierRank: 2,
      ramMin: 512,
      gpuMin: 128,
      cpuSpeedMin: 1000,
      cpuCoresMin: 2,
      requiredCodecs: ['avc'],
      require64Bit: false,
      version: 1,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ],

  alerts: [
    {
      id: 'a1',
      type: 'unregistered_device',
      partnerKey: 'unknown-key',
      deviceId: 'unknown-device-001',
      firstSeen: NOW,
      lastSeen: NOW,
      uniqueDeviceCount: 500,
      status: 'open',
      dismissedBy: null,
      dismissReason: null,
      dismissedAt: null,
      consecutiveMisses: 3,
    },
  ],

  telemetrySnapshots: [
    {
      id: 'ts1',
      partnerKey: 'acme-stb-na',
      deviceId: 'd1',
      coreVersion: '7.3.1',
      uniqueDevices: 1200,
      eventCount: 45000,
      snapshotDate: NOW,
    },
  ],

  auditLog: [
    {
      id: 'al1',
      entityType: 'device',
      entityId: 'd1',
      field: 'certificationStatus',
      oldValue: 'Pending',
      newValue: 'Certified',
      userId: 'test-uid',
      userEmail: 'test@disney.com',
      timestamp: NOW,
    },
  ],

  uploadHistory: [
    {
      id: 'uh1',
      uploadedBy: 'test-uid',
      uploadedByEmail: 'test@disney.com',
      uploadedAt: NOW,
      fileName: 'telemetry-2026-02.csv',
      rowCount: 100,
      successCount: 98,
      errorCount: 2,
      snapshotDate: NOW,
      errors: ['Row 50: invalid device', 'Row 75: invalid device'],
    },
  ],

  users: [
    {
      id: 'test-uid',
      email: 'test@disney.com',
      role: 'admin',
      displayName: 'Test User',
      photoUrl: null,
      lastLogin: NOW,
    },
  ],

  deployments: [],
  deviceTierAssignments: [],
  config: [],
};

export function seedAll(db: { seed: (name: string, docs: Array<{ id: string; [k: string]: unknown }>) => void }) {
  for (const [name, docs] of Object.entries(fixtures)) {
    db.seed(name, docs as Array<{ id: string; [k: string]: unknown }>);
  }
}
