import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../../lib/api', () => ({
  api: {
    partners: {
      list: vi.fn().mockResolvedValue({ data: [] }),
    },
    devices: {
      get: vi.fn().mockResolvedValue({ displayName: 'Test Device' }),
    },
    questionnaireIntake: {
      get: vi.fn(),
      triggerExtraction: vi.fn(),
      download: vi.fn(),
      updateJob: vi.fn(),
      retryDevice: vi.fn(),
    },
  },
}));

import QuestionnaireDetailPage from '../../pages/QuestionnaireDetailPage';
import { api } from '../../lib/api';

function renderPage(jobId: string = 'qj1') {
  return render(
    <MemoryRouter initialEntries={[`/admin/questionnaires/${jobId}`]}>
      <Routes>
        <Route path="/admin/questionnaires/:id" element={<QuestionnaireDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

const minimalJobDetail = {
  id: 'qj1',
  fileName: 'Test_Questionnaire.xlsx',
  fileStoragePath: 'questionnaires/qj1/file.xlsx',
  fileSizeBytes: 1234,
  uploadedBy: 'test-uid',
  uploadedByEmail: 'admin@disney.com',
  uploadedAt: '2026-03-01T00:00:00.000Z',
  submitterPartnerId: null,
  submitterConfidence: null,
  submitterDetectionMethod: null,
  questionnaireFormat: 'unknown',
  deviceCountDetected: 0,
  status: 'awaiting_extraction',
  aiExtractionMode: null,
  aiExtractionStartedAt: null,
  aiExtractionCompletedAt: null,
  extractionError: null,
  extractionStep: null,
  extractionCurrentDevice: null,
  devicesComplete: 0,
  devicesFailed: 0,
  notes: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  stagedDevices: [],
  submitterPartner: null,
  intakePartners: [],
  extractionProgress: null,
};

describe('QuestionnaireDetailPage smoke test', () => {
  it('renders without crashing with minimal job detail', async () => {
    (api.questionnaireIntake.get as ReturnType<typeof vi.fn>).mockResolvedValue(
      minimalJobDetail,
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test_Questionnaire.xlsx')).toBeInTheDocument();
    });
  });

  it('renders without crashing with empty stagedDevices', async () => {
    (api.questionnaireIntake.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...minimalJobDetail,
      stagedDevices: [],
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No staged devices')).toBeInTheDocument();
    });
  });

  it('renders with null partner', async () => {
    (api.questionnaireIntake.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...minimalJobDetail,
      submitterPartner: null,
      submitterPartnerId: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Not assigned')).toBeInTheDocument();
    });
  });

  it('renders with partner assigned', async () => {
    (api.questionnaireIntake.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...minimalJobDetail,
      submitterPartnerId: 'p1',
      submitterPartner: { id: 'p1', displayName: 'Acme Devices' },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Acme Devices')).toBeInTheDocument();
    });
  });

  it('renders staged devices with field summaries', async () => {
    (api.questionnaireIntake.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...minimalJobDetail,
      status: 'pending_review',
      deviceCountDetected: 1,
      stagedDevices: [
        {
          id: 'qsd1',
          rawHeaderLabel: 'STB Model A',
          platformType: 'ncp_linux',
          isOutOfScope: false,
          matchedDeviceId: null,
          reviewStatus: 'pending',
          fieldSummary: {
            totalFields: 10,
            extractedFields: 8,
            conflictCount: 2,
            newFieldCount: 6,
          },
        },
      ],
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('STB Model A')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    (api.questionnaireIntake.get as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Job not found'),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Job not found')).toBeInTheDocument();
    });
  });

  it('renders extraction error state', async () => {
    (api.questionnaireIntake.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...minimalJobDetail,
      status: 'extraction_failed',
      extractionError: 'Anthropic API timeout',
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test_Questionnaire.xlsx')).toBeInTheDocument();
    });
  });
});
