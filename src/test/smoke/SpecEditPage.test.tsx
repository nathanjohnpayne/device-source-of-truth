import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { minimalDeviceDetail, minimalSpec } from '../helpers/fixtures';

vi.mock('../../lib/api', () => ({
  api: {
    devices: { get: vi.fn(), update: vi.fn() },
    deviceSpecs: { get: vi.fn(), save: vi.fn() },
  },
}));

import SpecEditPage from '../../pages/SpecEditPage';
import { api } from '../../lib/api';

function renderPage(deviceId: string = 'd1') {
  const router = createMemoryRouter(
    [{ path: '/devices/:id/specs/edit', element: <SpecEditPage /> }],
    { initialEntries: [`/devices/${deviceId}/specs/edit`] },
  );
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SpecEditPage smoke test', () => {
  it('renders without crashing with no existing specs', async () => {
    (api.devices.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...minimalDeviceDetail,
      spec: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('STB Questionnaire')).toBeInTheDocument();
    });
  });

  it('renders without crashing with existing specs (all nulls)', async () => {
    (api.devices.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...minimalDeviceDetail,
      spec: minimalSpec,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('STB Questionnaire')).toBeInTheDocument();
    });
  });
});
