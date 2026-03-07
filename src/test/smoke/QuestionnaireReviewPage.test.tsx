import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../../lib/api', () => ({
  api: {
    partners: {
      list: vi.fn().mockResolvedValue({ data: [] }),
      listAll: vi.fn().mockResolvedValue([]),
    },
    questionnaireIntake: {
      getReview: vi.fn(),
      updateJob: vi.fn(),
      updateStagedDevice: vi.fn(),
      updateField: vi.fn(),
      resolveAll: vi.fn(),
      approve: vi.fn(),
      reject: vi.fn(),
      triggerExtraction: vi.fn(),
      get: vi.fn(),
      updateIntakePartner: vi.fn(),
    },
  },
  ApiError: class ApiError extends Error {
    status: number;
    body: unknown;
    constructor(message: string, status: number, body: unknown) {
      super(message);
      this.status = status;
      this.body = body;
    }
  },
}));

import QuestionnaireReviewPage from '../../pages/QuestionnaireReviewPage';
import { api } from '../../lib/api';

function renderPage(jobId: string = 'qj1') {
  return render(
    <MemoryRouter initialEntries={[`/admin/questionnaires/${jobId}/review`]}>
      <Routes>
        <Route path="/admin/questionnaires/:id/review" element={<QuestionnaireReviewPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

const minimalJob = {
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
  isMultiPartner: false,
  questionnaireFormat: 'unknown',
  deviceCountDetected: 0,
  status: 'pending_review',
  aiExtractionMode: null,
  aiExtractionStartedAt: null,
  aiExtractionCompletedAt: null,
  extractionError: null,
  notes: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
};

describe('QuestionnaireReviewPage smoke test', () => {
  it('renders Step 1 (Assign Partner) when no partner is assigned', async () => {
    (api.questionnaireIntake.getReview as ReturnType<typeof vi.fn>).mockResolvedValue({
      job: { ...minimalJob, submitterPartnerId: null },
      devices: [],
      submitterPartner: null,
      intakePartners: [],
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Step 1: Assign Partner')).toBeInTheDocument();
    });
  });

  it('renders Step 2 (Review Devices) when partner is assigned', async () => {
    (api.questionnaireIntake.getReview as ReturnType<typeof vi.fn>).mockResolvedValue({
      job: { ...minimalJob, submitterPartnerId: 'p1' },
      devices: [],
      submitterPartner: { id: 'p1', displayName: 'Acme Devices' },
      intakePartners: [],
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Step 2: Review Devices')).toBeInTheDocument();
    });
  });

  it('renders with empty devices array', async () => {
    (api.questionnaireIntake.getReview as ReturnType<typeof vi.fn>).mockResolvedValue({
      job: { ...minimalJob, submitterPartnerId: 'p1' },
      devices: [],
      submitterPartner: { id: 'p1', displayName: 'Acme' },
      intakePartners: [],
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/0\s+devices/)).toBeInTheDocument();
    });
  });

  it('renders devices with fields', async () => {
    (api.questionnaireIntake.getReview as ReturnType<typeof vi.fn>).mockResolvedValue({
      job: { ...minimalJob, submitterPartnerId: 'p1', deviceCountDetected: 1 },
      devices: [
        {
          id: 'qsd1',
          intakeJobId: 'qj1',
          rawHeaderLabel: 'STB Model A',
          platformType: 'ncp_linux',
          isOutOfScope: false,
          matchedDeviceId: null,
          matchConfidence: null,
          matchMethod: null,
          reviewStatus: 'pending',
          confirmedDisplayName: null,
          confirmedModelNumber: null,
          confirmedManufacturer: null,
          confirmedDeviceType: null,
          detectedModelName: null,
          detectedModelNumber: null,
          detectedManufacturer: null,
          rejectionReason: null,
          fields: [
            {
              id: 'qsf1',
              stagedDeviceId: 'qsd1',
              dstFieldKey: 'hardware.socVendor',
              dstFieldCategory: 'hardware',
              rawQuestionText: 'SoC Vendor?',
              rawAnswerText: 'Broadcom',
              extractedValue: 'Broadcom',
              extractionMethod: 'ai',
              aiConfidence: 0.95,
              aiReasoning: null,
              conflictStatus: 'new_field',
              existingValue: null,
              resolution: 'pending',
              resolvedBy: null,
              resolvedAt: null,
            },
          ],
        },
      ],
      submitterPartner: { id: 'p1', displayName: 'Acme' },
      intakePartners: [],
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('STB Model A')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    (api.questionnaireIntake.getReview as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Review data not found'),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Review data not found')).toBeInTheDocument();
    });
  });

  it('renders with all null/empty optional fields on job', async () => {
    (api.questionnaireIntake.getReview as ReturnType<typeof vi.fn>).mockResolvedValue({
      job: {
        ...minimalJob,
        submitterPartnerId: null,
        submitterConfidence: null,
        submitterDetectionMethod: null,
        questionnaireFormat: 'unknown',
        deviceCountDetected: null,
        extractionError: null,
        notes: null,
      },
      devices: [],
      submitterPartner: null,
      intakePartners: [],
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Review Questionnaire Import')).toBeInTheDocument();
    });
  });
});
