import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { minimalDeviceDetail } from '../helpers/fixtures';

vi.mock('../../lib/api', () => ({
  api: {
    devices: {
      get: vi.fn(),
      update: vi.fn(),
    },
    deviceSpecs: {
      create: vi.fn(),
    },
    versionMappings: {
      friendlyVersions: vi.fn().mockResolvedValue({ data: [] }),
    },
    questionnaireIntake: {
      getDeviceSources: vi.fn().mockResolvedValue([]),
      getDeviceDeployments: vi.fn().mockResolvedValue([]),
    },
  },
}));

import DeviceDetailPage from '../../pages/DeviceDetailPage';
import { api } from '../../lib/api';

function renderWithRoute(deviceId: string = 'd1') {
  return render(
    <MemoryRouter initialEntries={[`/devices/${deviceId}`]}>
      <Routes>
        <Route path="/devices/:id" element={<DeviceDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DeviceDetailPage smoke test', () => {
  it('renders without crashing with minimal device detail', async () => {
    (api.devices.get as ReturnType<typeof vi.fn>).mockResolvedValue(minimalDeviceDetail);

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByText('Test Device')).toBeInTheDocument();
    });
  });

  it('renders without crashing when all relations are null', async () => {
    (api.devices.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...minimalDeviceDetail,
      partner: null,
      partnerKey: null,
      spec: null,
      tier: null,
      deployments: [],
      telemetrySnapshots: [],
      auditHistory: [],
    });

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByText('Test Device')).toBeInTheDocument();
    });
    expect(screen.getByText('No specifications recorded')).toBeInTheDocument();
    expect(screen.getByText('No telemetry data uploaded yet')).toBeInTheDocument();
  });

  it('handles API error gracefully', async () => {
    (api.devices.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Not found'));

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByText('Not found')).toBeInTheDocument();
    });
  });

  it('renders active device count as number (not crash on .toLocaleString)', async () => {
    (api.devices.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...minimalDeviceDetail,
      activeDeviceCount: 150000,
    });

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByText('150,000')).toBeInTheDocument();
    });
  });

  it('renders with empty deployments array', async () => {
    (api.devices.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...minimalDeviceDetail,
      deployments: [],
    });

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByText('No deployments')).toBeInTheDocument();
    });
  });

  it('uses the resolved device document id for questionnaire follow-up requests', async () => {
    (api.devices.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...minimalDeviceDetail,
      id: 'd1',
      deviceId: 'legacy-business-id',
    });

    renderWithRoute('legacy-business-id');

    await waitFor(() => {
      expect(api.questionnaireIntake.getDeviceSources).toHaveBeenCalledWith('d1');
      expect(api.questionnaireIntake.getDeviceDeployments).toHaveBeenCalledWith('d1');
    });
  });
});
