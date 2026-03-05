import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../lib/api', () => ({
  api: {
    partners: {
      list: vi.fn(),
    },
    questionnaireIntake: {
      upload: vi.fn(),
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

import QuestionnaireUploadPage from '../../pages/QuestionnaireUploadPage';
import { api } from '../../lib/api';

function renderPage() {
  return render(
    <MemoryRouter>
      <QuestionnaireUploadPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('QuestionnaireUploadPage smoke test', () => {
  it('renders without crashing when partners load successfully', async () => {
    (api.partners.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: 'p1', displayName: 'Acme' }],
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Upload Partner Questionnaire')).toBeInTheDocument();
    });
    expect(screen.getByText('Select File')).toBeInTheDocument();
  });

  it('renders without crashing when partners API fails', async () => {
    (api.partners.list as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error'),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Upload Partner Questionnaire')).toBeInTheDocument();
    });
  });

  it('renders without crashing with empty partner list', async () => {
    (api.partners.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Upload Partner Questionnaire')).toBeInTheDocument();
    });
    expect(screen.getByText('Auto-detect')).toBeInTheDocument();
  });

  it('upload button is disabled when no file is selected', async () => {
    (api.partners.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Upload')).toBeInTheDocument();
    });
    expect(screen.getByText('Upload').closest('button')).toBeDisabled();
  });

  it('renders AI extraction checkbox', async () => {
    (api.partners.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText('Use AI Extraction?')).toBeInTheDocument();
    });
  });
});
