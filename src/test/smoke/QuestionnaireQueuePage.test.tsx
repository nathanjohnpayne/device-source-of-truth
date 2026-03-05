import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { emptyPaginated } from '../helpers/fixtures';

vi.mock('../../lib/api', () => ({
  api: {
    partners: {
      list: vi.fn().mockResolvedValue({ data: [] }),
    },
    questionnaireIntake: {
      list: vi.fn(),
    },
  },
}));

import QuestionnaireQueuePage from '../../pages/QuestionnaireQueuePage';
import { api } from '../../lib/api';

function renderPage() {
  return render(
    <MemoryRouter>
      <QuestionnaireQueuePage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('QuestionnaireQueuePage smoke test', () => {
  it('renders without crashing with empty job list', async () => {
    (api.questionnaireIntake.list as ReturnType<typeof vi.fn>).mockResolvedValue(
      emptyPaginated(),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No questionnaire jobs')).toBeInTheDocument();
    });
  });

  it('renders heading and upload button', async () => {
    (api.questionnaireIntake.list as ReturnType<typeof vi.fn>).mockResolvedValue(
      emptyPaginated(),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Questionnaire Intake Queue')).toBeInTheDocument();
    });
    expect(screen.getByText('Upload New')).toBeInTheDocument();
  });

  it('renders job rows when data is present', async () => {
    (api.questionnaireIntake.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        {
          id: 'qj1',
          fileName: 'Acme_Questionnaire.xlsx',
          partnerId: null,
          questionnaireFormat: 'lg_stb_v1',
          deviceCountDetected: 2,
          status: 'pending_review',
          uploadedAt: '2026-03-01T00:00:00.000Z',
          uploadedByEmail: 'admin@disney.com',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Acme_Questionnaire.xlsx')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    (api.questionnaireIntake.list as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error'),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('renders with null deviceCountDetected', async () => {
    (api.questionnaireIntake.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        {
          id: 'qj1',
          fileName: 'test.xlsx',
          partnerId: null,
          questionnaireFormat: 'unknown',
          deviceCountDetected: null,
          status: 'parsing',
          uploadedAt: null,
          uploadedByEmail: null,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('test.xlsx')).toBeInTheDocument();
    });
  });
});
