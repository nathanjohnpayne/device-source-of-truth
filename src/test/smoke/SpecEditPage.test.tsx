import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { minimalDeviceDetail, minimalSpec, minimalPartner } from '../helpers/fixtures';

vi.mock('../../lib/api', () => ({
  api: {
    devices: { get: vi.fn(), update: vi.fn() },
    deviceSpecs: { get: vi.fn(), save: vi.fn() },
    questionnaireIntake: { upload: vi.fn() },
  },
}));

import SpecEditPage from '../../pages/SpecEditPage';
import { api } from '../../lib/api';

const mockUpload = api.questionnaireIntake.upload as ReturnType<typeof vi.fn>;
const mockSpecsSave = api.deviceSpecs.save as ReturnType<typeof vi.fn>;
const mockDevicesUpdate = api.devices.update as ReturnType<typeof vi.fn>;
const mockDevicesGet = api.devices.get as ReturnType<typeof vi.fn>;

function renderPage(deviceId: string = 'd1') {
  const router = createMemoryRouter(
    [
      { path: '/devices/:id/specs/edit', element: <SpecEditPage /> },
      { path: '/devices/:id', element: <div>Device Detail</div> },
      { path: '/admin/questionnaires/:id', element: <div>Questionnaire Detail</div> },
    ],
    { initialEntries: [`/devices/${deviceId}/specs/edit`] },
  );
  return render(<RouterProvider router={router} />);
}

function createFile(name: string, sizeMb: number = 1): File {
  const bytes = new ArrayBuffer(sizeMb * 1024 * 1024);
  const ext = name.slice(name.lastIndexOf('.'));
  const mime = ext === '.xlsx'
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'application/vnd.ms-excel';
  return new File([bytes], name, { type: mime });
}

async function renderAndWaitForLoad(detail = minimalDeviceDetail) {
  mockDevicesGet.mockResolvedValue({ ...detail, spec: null });
  mockSpecsSave.mockResolvedValue({});
  mockDevicesUpdate.mockResolvedValue({});
  renderPage();
  await waitFor(() => {
    expect(screen.getByText('STB Questionnaire')).toBeInTheDocument();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SpecEditPage smoke test', () => {
  it('renders without crashing with no existing specs', async () => {
    mockDevicesGet.mockResolvedValue({
      ...minimalDeviceDetail,
      spec: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('STB Questionnaire')).toBeInTheDocument();
    });
  });

  it('renders without crashing with existing specs (all nulls)', async () => {
    mockDevicesGet.mockResolvedValue({
      ...minimalDeviceDetail,
      spec: minimalSpec,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('STB Questionnaire')).toBeInTheDocument();
    });
  });
});

describe('SpecEditPage questionnaire upload', () => {
  it('navigates to job detail after successful upload', async () => {
    const deviceWithPartner = {
      ...minimalDeviceDetail,
      partner: { ...minimalPartner, id: 'p1' },
    };
    await renderAndWaitForLoad(deviceWithPartner);

    const fileInput = screen.getByLabelText(/Upload Questionnaire File/i) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [createFile('test.xlsx')] } });

    mockUpload.mockResolvedValue({ id: 'job-123' });

    const saveButton = screen.getAllByRole('button', { name: /save/i })[0];
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Questionnaire Detail')).toBeInTheDocument();
    });

    expect(mockUpload).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'test.xlsx' }),
      { submitterPartnerId: 'p1', aiExtraction: false },
    );
  });

  it('shows error and stays on page when upload fails after spec save', async () => {
    await renderAndWaitForLoad();

    const fileInput = screen.getByLabelText(/Upload Questionnaire File/i) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [createFile('test.xlsx')] } });

    mockUpload.mockRejectedValue(new Error('Network error'));

    const saveButton = screen.getAllByRole('button', { name: /save/i })[0];
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/questionnaire upload failed/i)).toBeInTheDocument();
    });

    expect(screen.getByText('STB Questionnaire')).toBeInTheDocument();
    expect(mockSpecsSave).toHaveBeenCalled();
  });

  it('navigates to device detail when saving without a file', async () => {
    await renderAndWaitForLoad();

    const saveButton = screen.getAllByRole('button', { name: /save/i })[0];
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Device Detail')).toBeInTheDocument();
    });

    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('saves against the resolved device document id when opened by business id', async () => {
    mockDevicesGet.mockResolvedValue({
      ...minimalDeviceDetail,
      id: 'd1',
      deviceId: 'legacy-business-id',
      spec: null,
    });
    mockSpecsSave.mockResolvedValue({});
    mockDevicesUpdate.mockResolvedValue({});

    renderPage('legacy-business-id');

    await waitFor(() => {
      expect(screen.getByText('STB Questionnaire')).toBeInTheDocument();
    });

    const saveButton = screen.getAllByRole('button', { name: /save/i })[0];
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockSpecsSave).toHaveBeenCalledWith('d1', expect.any(Object));
    });
  });

  it('omits partnerId when device has no partner', async () => {
    await renderAndWaitForLoad({ ...minimalDeviceDetail, partner: null, partnerKey: null });

    const fileInput = screen.getByLabelText(/Upload Questionnaire File/i) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [createFile('test.xlsx')] } });

    mockUpload.mockResolvedValue({ id: 'job-456' });

    const saveButton = screen.getAllByRole('button', { name: /save/i })[0];
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalledWith(
        expect.anything(),
        { submitterPartnerId: undefined, aiExtraction: false },
      );
    });
  });
});

describe('SpecEditPage file validation', () => {
  it('rejects non-xlsx/xls files with an error', async () => {
    await renderAndWaitForLoad();

    const pdfFile = new File(['dummy'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByLabelText(/Upload Questionnaire File/i) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [pdfFile] } });

    expect(screen.getByText(/Only .xlsx and .xls files are accepted/i)).toBeInTheDocument();
  });

  it('rejects files over 20 MB', async () => {
    await renderAndWaitForLoad();

    const bigFile = createFile('huge.xlsx', 21);
    const fileInput = screen.getByLabelText(/Upload Questionnaire File/i) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [bigFile] } });

    expect(screen.getByText(/File must be under 20 MB/i)).toBeInTheDocument();
  });

  it('clears a previously valid file when an invalid file is selected', async () => {
    await renderAndWaitForLoad();

    const fileInput = screen.getByLabelText(/Upload Questionnaire File/i) as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [createFile('good.xlsx')] } });
    expect(screen.getByText(/Selected: good.xlsx/i)).toBeInTheDocument();

    const badFile = new File(['dummy'], 'bad.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [badFile] } });

    expect(screen.queryByText(/Selected:/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Only .xlsx and .xls files are accepted/i)).toBeInTheDocument();

    mockSpecsSave.mockResolvedValue({});
    const saveButton = screen.getAllByRole('button', { name: /save/i })[0];
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Device Detail')).toBeInTheDocument();
    });
    expect(mockUpload).not.toHaveBeenCalled();
  });
});
