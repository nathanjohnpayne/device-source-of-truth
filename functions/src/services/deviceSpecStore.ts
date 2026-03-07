import { SPEC_CATEGORIES } from '../types/index.js';
import { repairFlatDottedSpec } from './specCompleteness.js';

type SpecDocData = Record<string, unknown>;

export interface DeviceSpecDocRecord {
  id: string;
  data: SpecDocData;
}

export interface MergedDeviceSpecLookup {
  canonicalDocId: string;
  docs: DeviceSpecDocRecord[];
  lookup: 'byDocId' | 'byField' | 'merged';
  mergedSpec: SpecDocData;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isMeaningfulSpecValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '';
}

function getUpdatedAt(data: SpecDocData): string {
  return typeof data.updatedAt === 'string' ? data.updatedAt : '';
}

function compareSpecDocs(a: DeviceSpecDocRecord, b: DeviceSpecDocRecord, canonicalDocId: string): number {
  const aCanonical = a.id === canonicalDocId;
  const bCanonical = b.id === canonicalDocId;

  if (aCanonical !== bCanonical) {
    return aCanonical ? 1 : -1;
  }

  const byUpdatedAt = getUpdatedAt(a.data).localeCompare(getUpdatedAt(b.data));
  if (byUpdatedAt !== 0) return byUpdatedAt;

  return a.id.localeCompare(b.id);
}

function normalizeSpecDocData(data: SpecDocData): SpecDocData {
  return repairFlatDottedSpec(data).repaired;
}

export async function findDeviceSpecDocsForDevice(
  db: FirebaseFirestore.Firestore,
  deviceDocId: string,
): Promise<DeviceSpecDocRecord[]> {
  const [byDoc, byField] = await Promise.all([
    db.collection('deviceSpecs').doc(deviceDocId).get(),
    db.collection('deviceSpecs').where('deviceId', '==', deviceDocId).get(),
  ]);

  const docs = new Map<string, DeviceSpecDocRecord>();

  if (byDoc.exists) {
    docs.set(byDoc.id, {
      id: byDoc.id,
      data: normalizeSpecDocData(byDoc.data() ?? {}),
    });
  }

  for (const doc of byField.docs) {
    docs.set(doc.id, {
      id: doc.id,
      data: normalizeSpecDocData(doc.data()),
    });
  }

  return [...docs.values()];
}

export function buildCanonicalDeviceSpecWrite(
  deviceDocId: string,
  source: SpecDocData,
): SpecDocData {
  const cleanSource = normalizeSpecDocData(source);
  const result: SpecDocData = {
    deviceId: deviceDocId,
    updatedAt: typeof cleanSource.updatedAt === 'string' ? cleanSource.updatedAt : new Date().toISOString(),
  };

  for (const category of SPEC_CATEGORIES) {
    const section = cleanSource[category];
    result[category] = isObjectRecord(section) ? { ...section } : {};
  }

  return result;
}

export function mergeDeviceSpecDocs(
  deviceDocId: string,
  docs: DeviceSpecDocRecord[],
): SpecDocData {
  const merged = buildCanonicalDeviceSpecWrite(deviceDocId, {});
  const sortedDocs = [...docs].sort((a, b) => compareSpecDocs(a, b, deviceDocId));
  let latestUpdatedAt = '';

  for (const doc of sortedDocs) {
    const normalized = buildCanonicalDeviceSpecWrite(deviceDocId, doc.data);
    const isCanonicalDoc = doc.id === deviceDocId;
    const updatedAt = getUpdatedAt(normalized);
    if (updatedAt > latestUpdatedAt) latestUpdatedAt = updatedAt;

    for (const category of SPEC_CATEGORIES) {
      const currentSection = isObjectRecord(merged[category]) ? merged[category] as Record<string, unknown> : {};
      const nextSection = isObjectRecord(normalized[category]) ? normalized[category] as Record<string, unknown> : {};

      for (const [fieldKey, value] of Object.entries(nextSection)) {
        // Canonical doc fields always win so explicit clears are preserved.
        if (isCanonicalDoc || isMeaningfulSpecValue(value) || !(fieldKey in currentSection)) {
          currentSection[fieldKey] = value;
        }
      }

      merged[category] = currentSection;
    }
  }

  merged.updatedAt = latestUpdatedAt || (merged.updatedAt as string);
  return merged;
}

export async function loadMergedDeviceSpecForDevice(
  db: FirebaseFirestore.Firestore,
  deviceDocId: string,
): Promise<MergedDeviceSpecLookup | null> {
  const docs = await findDeviceSpecDocsForDevice(db, deviceDocId);
  if (docs.length === 0) return null;

  const lookup = docs.length > 1
    ? 'merged'
    : docs[0].id === deviceDocId
      ? 'byDocId'
      : 'byField';

  return {
    canonicalDocId: deviceDocId,
    docs,
    lookup,
    mergedSpec: mergeDeviceSpecDocs(deviceDocId, docs),
  };
}

export function resolveDeviceDocIdForSpecDocument(
  specDocId: string,
  specData: SpecDocData,
  deviceDocIds: Set<string>,
  deviceDocIdByBusinessId: Map<string, string>,
): string | null {
  if (deviceDocIds.has(specDocId)) return specDocId;

  const rawDeviceId = typeof specData.deviceId === 'string' ? specData.deviceId : null;
  if (rawDeviceId && deviceDocIds.has(rawDeviceId)) return rawDeviceId;
  if (rawDeviceId && deviceDocIdByBusinessId.has(rawDeviceId)) {
    return deviceDocIdByBusinessId.get(rawDeviceId) ?? null;
  }

  return null;
}

export async function loadMergedDeviceSpecsForTiering(
  db: FirebaseFirestore.Firestore,
): Promise<Array<{ deviceDocId: string; docs: DeviceSpecDocRecord[]; mergedSpec: SpecDocData }>> {
  const [devicesSnap, specsSnap] = await Promise.all([
    db.collection('devices').get(),
    db.collection('deviceSpecs').get(),
  ]);

  const deviceDocIds = new Set<string>();
  const deviceDocIdByBusinessId = new Map<string, string>();

  for (const doc of devicesSnap.docs) {
    deviceDocIds.add(doc.id);
    const businessId = doc.data().deviceId;
    if (typeof businessId === 'string' && businessId) {
      deviceDocIdByBusinessId.set(businessId, doc.id);
    }
  }

  const docsByDeviceId = new Map<string, DeviceSpecDocRecord[]>();

  for (const doc of specsSnap.docs) {
    const normalized = normalizeSpecDocData(doc.data());
    const deviceDocId = resolveDeviceDocIdForSpecDocument(
      doc.id,
      normalized,
      deviceDocIds,
      deviceDocIdByBusinessId,
    );

    if (!deviceDocId) continue;

    if (!docsByDeviceId.has(deviceDocId)) {
      docsByDeviceId.set(deviceDocId, []);
    }

    docsByDeviceId.get(deviceDocId)!.push({
      id: doc.id,
      data: normalized,
    });
  }

  return [...docsByDeviceId.entries()].map(([deviceDocId, docs]) => ({
    deviceDocId,
    docs,
    mergedSpec: mergeDeviceSpecDocs(deviceDocId, docs),
  }));
}
