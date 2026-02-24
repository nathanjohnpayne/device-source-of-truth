import { initializeApp, cert, type ServiceAccount, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { GoogleAuth } from 'google-auth-library';
import type { Device } from '../../src/lib/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

let db: FirebaseFirestore.Firestore;

export function initFirebaseAdmin() {
  const projectId = 'device-source-of-truth';

  // Strategy 1: Service account key file
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    || path.join(process.cwd(), 'service-account-key.json');

  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8')) as ServiceAccount;
    initializeApp({ credential: cert(serviceAccount) });
    db = getFirestore();
    return;
  }

  // Strategy 2: Use Firebase CLI refresh token to create ADC
  const firebaseConfigPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  if (fs.existsSync(firebaseConfigPath)) {
    try {
      const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
      const refreshToken = firebaseConfig?.tokens?.refresh_token;

      if (refreshToken) {
        console.log('Using Firebase CLI credentials...');

        // Write ADC-compatible credentials file
        const adcCredentials = {
          type: 'authorized_user',
          client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
          client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
          refresh_token: refreshToken,
        };

        const adcPath = path.join(os.tmpdir(), 'dsot-adc.json');
        fs.writeFileSync(adcPath, JSON.stringify(adcCredentials));
        process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;

        initializeApp({ credential: applicationDefault(), projectId });
        db = getFirestore();
        return;
      }
    } catch (e) {
      console.warn('Could not read Firebase CLI credentials:', e);
    }
  }

  // Strategy 3: Application default credentials
  initializeApp({ projectId });
  db = getFirestore();
}

export async function uploadDevices(devices: Device[]): Promise<void> {
  console.log(`Uploading ${devices.length} devices to Firestore...`);

  const BATCH_SIZE = 400; // Firestore limit is 500 per batch
  for (let i = 0; i < devices.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = devices.slice(i, i + BATCH_SIZE);

    for (const device of chunk) {
      const docRef = db.collection('devices').doc(device.id);
      batch.set(docRef, device);
    }

    await batch.commit();
    console.log(`  Uploaded batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(devices.length / BATCH_SIZE)}`);
  }

  // Update metadata
  const scoreDistribution = { excellent: 0, good: 0, adequate: 0, limited: 0, poor: 0 };
  for (const device of devices) {
    const score = device.deviceScore;
    if (score >= 80) scoreDistribution.excellent++;
    else if (score >= 60) scoreDistribution.good++;
    else if (score >= 40) scoreDistribution.adequate++;
    else if (score >= 20) scoreDistribution.limited++;
    else scoreDistribution.poor++;
  }

  await db.collection('metadata').doc('importStats').set({
    totalDevices: devices.length,
    lastImportDate: new Date().toISOString(),
    fileCount: new Set(devices.flatMap(d => d.sourceFiles)).size,
    scoreDistribution,
    averageScore: Math.round(devices.reduce((sum, d) => sum + d.deviceScore, 0) / devices.length),
  });

  console.log('Metadata updated.');
}

export async function seedAllowlist(emails: string[]): Promise<void> {
  console.log(`Seeding allowlist with ${emails.length} email(s)...`);

  const batch = db.batch();
  for (const email of emails) {
    const docRef = db.collection('allowedUsers').doc(email);
    batch.set(docRef, {
      email,
      addedAt: new Date().toISOString(),
    });
  }
  await batch.commit();
  console.log('Allowlist updated.');
}
