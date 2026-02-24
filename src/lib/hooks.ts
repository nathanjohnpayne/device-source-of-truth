import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, setDoc, query, orderBy, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { auth, googleProvider, db } from './firebase';
import type { Device, Partner } from './types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser?.email) {
        const allowedDoc = await getDoc(doc(db, 'allowedUsers', firebaseUser.email));
        setAllowed(allowedDoc.exists());
      } else {
        setAllowed(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const logOut = useCallback(async () => {
    await signOut(auth);
    setAllowed(null);
  }, []);

  return { user, loading, allowed, signIn, logOut };
}

export function useDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDevices() {
      try {
        const q = query(collection(db, 'devices'), orderBy('deviceScore', 'desc'));
        const snapshot = await getDocs(q);
        const devs = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Device));
        setDevices(devs);
      } catch (err) {
        console.error('Error fetching devices:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDevices();
  }, []);

  return { devices, loading };
}

export function useDevice(id: string | undefined) {
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    async function fetchDevice() {
      try {
        const docSnap = await getDoc(doc(db, 'devices', id!));
        if (docSnap.exists()) {
          setDevice({ ...docSnap.data(), id: docSnap.id } as Device);
        }
      } catch (err) {
        console.error('Error fetching device:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDevice();
  }, [id]);

  const updateDeviceData = useCallback(async (updates: Partial<Device>) => {
    if (!id) return;
    await updateDoc(doc(db, 'devices', id), updates as Record<string, unknown>);
    setDevice(prev => prev ? { ...prev, ...updates } : null);
  }, [id]);

  return { device, loading, updateDevice: updateDeviceData };
}

export async function updateDeviceById(id: string, updates: Partial<Device>): Promise<void> {
  await updateDoc(doc(db, 'devices', id), updates as Record<string, unknown>);
}

export async function deleteDeviceById(id: string): Promise<void> {
  await deleteDoc(doc(db, 'devices', id));
}

export interface ConflictResolution {
  deviceId: string;
  field: string;
  value: unknown;
  conflictString: string;
}

export async function resolveConflictsBatch(resolutions: ConflictResolution[], devices: Device[]): Promise<void> {
  const batch = writeBatch(db);

  // Group resolutions by device
  const byDevice = new Map<string, ConflictResolution[]>();
  for (const r of resolutions) {
    const arr = byDevice.get(r.deviceId) || [];
    arr.push(r);
    byDevice.set(r.deviceId, arr);
  }

  for (const [deviceId, deviceResolutions] of byDevice) {
    const device = devices.find(d => d.id === deviceId);
    if (!device) continue;

    const updates: Record<string, unknown> = {};

    // Set resolved field values
    for (const r of deviceResolutions) {
      updates[r.field] = r.value;
    }

    // Remove resolved conflict strings from the conflicts array
    const resolvedStrings = new Set(deviceResolutions.map(r => r.conflictString));
    const remainingConflicts = device.conflicts.filter(c => !resolvedStrings.has(c));
    updates['conflicts'] = remainingConflicts;

    batch.update(doc(db, 'devices', deviceId), updates);
  }

  await batch.commit();
}

// Partner hooks

export function usePartners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPartners() {
      try {
        const q = query(collection(db, 'partners'), orderBy('name'));
        const snapshot = await getDocs(q);
        const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Partner));
        setPartners(items);
      } catch (err) {
        console.error('Error fetching partners:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchPartners();
  }, []);

  return { partners, loading, setPartners };
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 80);
}

export async function createPartner(data: Omit<Partner, 'id'>): Promise<string> {
  const id = slugify(data.name);
  await setDoc(doc(db, 'partners', id), { ...data, id });
  return id;
}

export async function updatePartnerById(id: string, updates: Partial<Partner>): Promise<void> {
  await updateDoc(doc(db, 'partners', id), updates as Record<string, unknown>);
}

export async function deletePartnerById(id: string): Promise<void> {
  await deleteDoc(doc(db, 'partners', id));
}
