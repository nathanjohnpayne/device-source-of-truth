import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { minimalTier } from '../helpers/fixtures';

vi.mock('../../lib/api', () => ({
  api: {
    tiers: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      preview: vi.fn(),
    },
  },
}));

import TierConfigPage from '../../pages/TierConfigPage';
import { api } from '../../lib/api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TierConfigPage smoke test', () => {
  it('renders without crashing with empty tier list', async () => {
    (api.tiers.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 50,
      totalPages: 0,
    });

    render(
      <MemoryRouter>
        <TierConfigPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  it('renders without crashing with tier data', async () => {
    (api.tiers.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [minimalTier],
      total: 1,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    });

    render(
      <MemoryRouter>
        <TierConfigPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Tier 1')).toBeInTheDocument();
    });
  });

  it('shows error message on API failure', async () => {
    (api.tiers.list as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

    render(
      <MemoryRouter>
        <TierConfigPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });
});
