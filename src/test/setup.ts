import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(import.meta, 'env', {
  value: { DEV: true, VITE_FIREBASE_API_KEY: 'test', VITE_FIREBASE_APP_ID: 'test', VITE_FIREBASE_MEASUREMENT_ID: 'test' },
});

vi.mock('../lib/firebase', () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: vi.fn((cb: (u: null) => void) => { cb(null); return vi.fn(); }),
  },
  db: {},
  analytics: null,
}));

vi.mock('../lib/analytics', () => ({
  trackEvent: vi.fn(),
  trackPageView: vi.fn(),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'test-uid', email: 'test@disney.com', displayName: 'Test User', photoUrl: null },
    loading: false,
    role: 'admin' as const,
    isEditor: true,
    isAdmin: true,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
