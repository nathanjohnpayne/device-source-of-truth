import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let mockRole = 'admin';
let mockIsAdmin = true;
let mockIsEditor = true;

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'test-uid', email: 'test@disney.com', displayName: 'Test User', photoUrl: null, role: mockRole },
    loading: false,
    role: mockRole,
    isEditor: mockIsEditor,
    isAdmin: mockIsAdmin,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../../hooks/useImportPrerequisites', () => ({
  useImportPrerequisites: () => ({
    loading: false,
    fieldOptionsSeeded: true,
    partnerKeysLoaded: true,
    devicesRegistered: true,
    partnersExist: true,
    versionRegistrySeeded: true,
    counts: { fieldOptions: 10, partnerKeys: 5, devices: 42, partners: 3 },
    refresh: vi.fn(),
  }),
}));

vi.mock('../../components/UpdateBanner', () => ({
  default: () => null,
}));

vi.mock('../../lib/api', () => ({
  api: {
    questionnaireIntake: {
      notifications: {
        list: vi.fn().mockResolvedValue([]),
        markRead: vi.fn(),
      },
    },
    search: vi.fn().mockResolvedValue([]),
  },
}));

import AppShell from '../../components/layout/AppShell';

function setRole(role: 'admin' | 'editor' | 'viewer') {
  mockRole = role;
  mockIsAdmin = role === 'admin';
  mockIsEditor = role === 'admin' || role === 'editor';
}

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AppShell>
        <div>page content</div>
      </AppShell>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  setRole('admin');
});

describe('Sidebar navigation visibility by role', () => {
  describe('admin role', () => {
    beforeEach(() => setRole('admin'));

    it('shows all core navigation items', () => {
      renderShell();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Devices')).toBeInTheDocument();
      expect(screen.getByText('Partners')).toBeInTheDocument();
      expect(screen.getByText('Hardware Tiers')).toBeInTheDocument();
    });

    it('shows the Data Ingestion section with all items', () => {
      renderShell();
      expect(screen.getByText('Data Ingestion')).toBeInTheDocument();
      expect(screen.getByText('Intake Requests')).toBeInTheDocument();
      expect(screen.getByText('Telemetry Upload')).toBeInTheDocument();
      expect(screen.getByText('Questionnaires')).toBeInTheDocument();
      expect(screen.getByText('Data Migration')).toBeInTheDocument();
    });

    it('shows the Configuration section', () => {
      renderShell();
      expect(screen.getByText('Configuration')).toBeInTheDocument();
      expect(screen.getByText('Reference Data')).toBeInTheDocument();
      expect(screen.getByText('Partner Keys')).toBeInTheDocument();
    });

    it('shows the Admin section', () => {
      renderShell();
      expect(screen.getByText('Admin')).toBeInTheDocument();
      expect(screen.getByText('Users')).toBeInTheDocument();
      expect(screen.getByText('Alerts')).toBeInTheDocument();
      expect(screen.getByText('Audit Log')).toBeInTheDocument();
      expect(screen.getByText('Version Registry')).toBeInTheDocument();
      expect(screen.getByText('Readiness Checklist')).toBeInTheDocument();
      expect(screen.getByText('Danger Zone')).toBeInTheDocument();
    });

    it('shows the Reports section', () => {
      renderShell();
      expect(screen.getByText('Reports')).toBeInTheDocument();
      expect(screen.getByText('Spec Coverage')).toBeInTheDocument();
    });
  });

  describe('viewer role', () => {
    beforeEach(() => setRole('viewer'));

    it('shows core navigation items', () => {
      renderShell();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Devices')).toBeInTheDocument();
      expect(screen.getByText('Partners')).toBeInTheDocument();
      expect(screen.getByText('Hardware Tiers')).toBeInTheDocument();
    });

    it('shows the Data Ingestion section heading (not section-level adminOnly)', () => {
      renderShell();
      expect(screen.getByText('Data Ingestion')).toBeInTheDocument();
    });

    it('shows Questionnaires under Data Ingestion (no adminOnly flag)', () => {
      renderShell();
      expect(screen.getByText('Questionnaires')).toBeInTheDocument();
    });

    it('hides admin-only items within Data Ingestion', () => {
      renderShell();
      expect(screen.queryByText('Intake Requests')).not.toBeInTheDocument();
      expect(screen.queryByText('Telemetry Upload')).not.toBeInTheDocument();
      expect(screen.queryByText('Data Migration')).not.toBeInTheDocument();
    });

    it('hides the Configuration section entirely (section-level adminOnly)', () => {
      renderShell();
      expect(screen.queryByText('Configuration')).not.toBeInTheDocument();
      expect(screen.queryByText('Reference Data')).not.toBeInTheDocument();
      expect(screen.queryByText('Partner Keys')).not.toBeInTheDocument();
    });

    it('hides the Admin section entirely', () => {
      renderShell();
      expect(screen.queryByText('Admin')).not.toBeInTheDocument();
      expect(screen.queryByText('Users')).not.toBeInTheDocument();
      expect(screen.queryByText('Alerts')).not.toBeInTheDocument();
      expect(screen.queryByText('Audit Log')).not.toBeInTheDocument();
    });

    it('shows Reports section (not admin-restricted)', () => {
      renderShell();
      expect(screen.getByText('Reports')).toBeInTheDocument();
      expect(screen.getByText('Spec Coverage')).toBeInTheDocument();
    });
  });

  describe('editor role', () => {
    beforeEach(() => setRole('editor'));

    it('shows Questionnaires (available to editors)', () => {
      renderShell();
      expect(screen.getByText('Questionnaires')).toBeInTheDocument();
    });

    it('hides admin-only items within Data Ingestion', () => {
      renderShell();
      expect(screen.queryByText('Intake Requests')).not.toBeInTheDocument();
      expect(screen.queryByText('Telemetry Upload')).not.toBeInTheDocument();
      expect(screen.queryByText('Data Migration')).not.toBeInTheDocument();
    });

    it('hides Configuration and Admin sections', () => {
      renderShell();
      expect(screen.queryByText('Configuration')).not.toBeInTheDocument();
      expect(screen.queryByText('Admin')).not.toBeInTheDocument();
    });
  });
});
