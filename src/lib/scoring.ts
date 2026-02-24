import type { Device, ScoreBreakdown } from './types';

function scoreHardware(device: Device): number {
  let score = 0;

  // CPU Speed (0-8 points)
  const dmips = device.cpuSpeedDmips;
  if (dmips != null) {
    if (dmips >= 16000) score += 8;
    else if (dmips >= 8000) score += 6;
    else if (dmips >= 4000) score += 4;
    else score += 2;
  }

  // RAM for Disney+ (0-7 points)
  const ram = device.ramForDisneyMb;
  if (ram != null) {
    if (ram >= 1024) score += 7;
    else if (ram >= 512) score += 5;
    else if (ram >= 256) score += 3;
    else score += 1;
  }

  // Total RAM (0-5 points)
  const totalRam = device.memoryCapacityGb;
  if (totalRam != null) {
    if (totalRam >= 4) score += 5;
    else if (totalRam >= 2) score += 4;
    else if (totalRam >= 1) score += 3;
    else score += 1;
  }

  // Storage (0-5 points)
  const storage = device.storageCapacityGb;
  if (storage != null) {
    if (storage >= 16) score += 5;
    else if (storage >= 8) score += 4;
    else if (storage >= 4) score += 3;
    else if (storage >= 1) score += 2;
    else score += 1;
  }

  return score;
}

function scoreCodec(device: Device): number {
  let score = 0;
  if (device.supportsH264) score += 5;
  if (device.supportsH265) score += 6;
  if (device.supportsEAC3) score += 4;
  if (device.supportsDolbyAtmos) score += 5;
  return score;
}

function scoreDrm(device: Device): number {
  let score = 0;

  // Widevine (0-7 points)
  const wv = device.widevineSecurityLevel?.toUpperCase();
  if (wv?.includes('L1')) score += 7;
  else if (wv?.includes('L2')) score += 4;
  else if (wv?.includes('L3')) score += 2;

  // PlayReady (0-7 points)
  const pr = device.playReadySecurityLevel?.toUpperCase();
  if (pr?.includes('3000')) score += 7;
  else if (pr?.includes('2000')) score += 4;
  else if (pr?.includes('150')) score += 2;

  // HDCP (0-6 points)
  const hdcp = device.hdcpVersion;
  if (hdcp) {
    const ver = parseFloat(hdcp.replace(/[^0-9.]/g, ''));
    if (ver >= 2.2) score += 6;
    else if (ver >= 2.0) score += 4;
    else if (ver >= 1.4) score += 2;
  }

  return score;
}

function scoreDisplay(device: Device): number {
  let score = 0;

  // Max Resolution (0-8 points)
  const res = device.maxVideoResolution?.toLowerCase();
  if (res?.includes('2160') || res?.includes('4k') || res?.includes('uhd')) score += 8;
  else if (res?.includes('1080') || res?.includes('fhd')) score += 4;
  else if (res?.includes('720')) score += 2;

  // HDR10 (0-4 points)
  if (device.supportsHDR10) score += 4;

  // Dolby Vision (0-4 points)
  if (device.supportsDolbyVision) score += 4;

  // HLG / HDR10+ (0-4 points)
  if (device.supportsHLG && device.supportsHDR10Plus) score += 4;
  else if (device.supportsHLG || device.supportsHDR10Plus) score += 2;

  return score;
}

function scoreSecurity(device: Device): number {
  let score = 0;
  if (device.supportsSecureBoot) score += 5;
  if (device.supportsTEE) score += 5;
  if (device.supportsSecureVideoPath) score += 5;
  return score;
}

export function calculateScoreBreakdown(device: Device): ScoreBreakdown {
  return {
    hardware: scoreHardware(device),
    codec: scoreCodec(device),
    drm: scoreDrm(device),
    display: scoreDisplay(device),
    security: scoreSecurity(device),
  };
}

export function calculateDeviceScore(device: Device): number {
  const breakdown = calculateScoreBreakdown(device);
  return breakdown.hardware + breakdown.codec + breakdown.drm + breakdown.display + breakdown.security;
}
