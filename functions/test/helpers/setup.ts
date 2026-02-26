import { vi } from 'vitest';
import { MockFirestoreDB, DOCUMENT_ID_SENTINEL } from './mockFirestore.js';

export const mockDb = new MockFirestoreDB();

vi.mock('firebase-admin', () => {
  const firestoreFn = Object.assign(() => mockDb, {
    FieldPath: { documentId: () => DOCUMENT_ID_SENTINEL },
  });

  return {
    default: {
      initializeApp: vi.fn(),
      firestore: firestoreFn,
      auth: () => ({
        verifyIdToken: vi.fn().mockResolvedValue({
          uid: 'test-uid',
          email: 'test@disney.com',
          name: 'Test User',
          picture: null,
        }),
      }),
    },
  };
});

vi.mock('firebase-functions', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('firebase-functions/v2/https', () => ({
  onRequest: vi.fn(),
}));
