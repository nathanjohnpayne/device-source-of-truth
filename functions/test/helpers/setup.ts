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

vi.mock('../../src/services/questionnaireParser.js', () => ({
  parseQuestionnaire: vi.fn().mockResolvedValue({
    format: 'lg_stb_v1',
    devices: [
      { columnIndex: 3, rawHeaderLabel: 'STB Model A', platformType: 'ncp_linux', isOutOfScope: false },
    ],
    qaPairsByDevice: new Map([[3, [{ rowIndex: 2, rawQuestionText: 'SoC Vendor?', rawAnswerText: 'Broadcom' }]]]),
    partnerDetection: { partnerId: null, confidence: 0, method: 'filename' },
  }),
}));

vi.mock('../../src/services/questionnaireExtractor.js', () => ({
  runExtractionJob: vi.fn().mockResolvedValue(undefined),
  retryDeviceExtraction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/services/storage.js', () => ({
  uploadQuestionnaireFile: vi.fn().mockResolvedValue('questionnaires/test-job/file.xlsx'),
  getSignedDownloadUrl: vi.fn().mockResolvedValue('https://storage.example.com/signed-url'),
}));

vi.mock('../../src/services/partnerAliasResolver.js', () => ({
  loadActiveAliases: vi.fn().mockResolvedValue([]),
  resolvePartnerAlias: vi.fn().mockReturnValue(null),
}));
