import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { minimalDashboard } from '../helpers/fixtures';

vi.mock('../../lib/api', () => ({
  api: {
    reports: {
      dashboard: vi.fn(),
    },
  },
}));

import DashboardPage from '../../pages/DashboardPage';
import { api } from '../../lib/api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DashboardPage smoke test', () => {
  it('renders without crashing with minimal data', async () => {
    (api.reports.dashboard as ReturnType<typeof vi.fn>).mockResolvedValue(minimalDashboard);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Ecosystem Overview')).toBeInTheDocument();
    });
  });

  it('renders without crashing with null API response', async () => {
    (api.reports.dashboard as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Unable to load dashboard data.')).toBeInTheDocument();
    });
  });

  it('renders without crashing when API rejects', async () => {
    (api.reports.dashboard as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Unable to load dashboard data.')).toBeInTheDocument();
    });
  });

  it('displays KPI values as numbers', async () => {
    (api.reports.dashboard as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...minimalDashboard,
      totalActiveDevices: 150000,
      totalDevices: 500,
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('150,000')).toBeInTheDocument();
    });
  });
});
