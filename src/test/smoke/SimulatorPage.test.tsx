import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../lib/api', () => ({
  api: {
    tiers: {
      list: vi.fn(),
      simulate: vi.fn(),
    },
    devices: {
      list: vi.fn(),
    },
  },
}));

import SimulatorPage from '../../pages/SimulatorPage';

describe('SimulatorPage smoke test', () => {
  it('renders without crashing', () => {
    render(
      <MemoryRouter>
        <SimulatorPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('renders simulation form elements', () => {
    render(
      <MemoryRouter>
        <SimulatorPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /run/i })).toBeInTheDocument();
  });
});
