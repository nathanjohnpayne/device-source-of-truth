import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { emptyPaginated } from '../helpers/fixtures';

vi.mock('../../lib/api', () => ({
  api: {
    partners: {
      get: vi.fn(),
      update: vi.fn(),
    },
    partnerKeys: {
      list: vi.fn(),
    },
    devices: {
      list: vi.fn(),
    },
    questionnaireIntake: {
      getPartnerDeployments: vi.fn().mockResolvedValue([]),
    },
  },
}));

import PartnerDetailPage from '../../pages/PartnerDetailPage';
import { api } from '../../lib/api';

function renderPage(partnerId: string = 'p1') {
  return render(
    <MemoryRouter initialEntries={[`/partners/${partnerId}`]}>
      <Routes>
        <Route path="/partners/:id" element={<PartnerDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PartnerDetailPage smoke test', () => {
  it('renders without crashing with minimal partner data', async () => {
    (api.partners.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'p1',
      displayName: 'Test Partner',
      regions: [],
      countriesIso2: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    });
    (api.partnerKeys.list as ReturnType<typeof vi.fn>).mockResolvedValue(emptyPaginated());
    (api.devices.list as ReturnType<typeof vi.fn>).mockResolvedValue(emptyPaginated());

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test Partner')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    (api.partners.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Not found'));
    (api.partnerKeys.list as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    (api.devices.list as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/not found/i)).toBeInTheDocument();
    });
  });

  it('renders with empty keys and devices arrays', async () => {
    (api.partners.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'p1',
      displayName: 'Empty Partner',
      regions: [],
      countriesIso2: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    });
    (api.partnerKeys.list as ReturnType<typeof vi.fn>).mockResolvedValue(emptyPaginated());
    (api.devices.list as ReturnType<typeof vi.fn>).mockResolvedValue(emptyPaginated());

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Empty Partner')).toBeInTheDocument();
    });
  });
});
