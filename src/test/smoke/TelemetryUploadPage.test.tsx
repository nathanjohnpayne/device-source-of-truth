import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../lib/api', () => ({
  api: {
    telemetry: {
      upload: vi.fn(),
      history: vi.fn(),
    },
  },
}));

import TelemetryUploadPage from '../../pages/TelemetryUploadPage';
import { api } from '../../lib/api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TelemetryUploadPage smoke test', () => {
  it('renders without crashing with empty history', async () => {
    (api.telemetry.history as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 50,
      totalPages: 0,
    });

    render(
      <MemoryRouter>
        <TelemetryUploadPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    (api.telemetry.history as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

    render(
      <MemoryRouter>
        <TelemetryUploadPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });
});
