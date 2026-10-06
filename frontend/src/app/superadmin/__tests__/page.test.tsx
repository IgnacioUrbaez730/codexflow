import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SuperadminDashboard from '../page';
import '@testing-library/jest-dom';

describe('Superadmin Dashboard', () => {
  beforeEach(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{
          id: '1',
          name: 'Test Tenant',
          created_at: '2026-10-06T00:00:00Z',
          weekly_limit: 100,
          current_usage: 50
        }])
      })
    ) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the dashboard and fetches tenants', async () => {
    render(<SuperadminDashboard />);
    
    expect(screen.getByText('Global Dashboard - Superadmin')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Test Tenant')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
    });
  });

  it('opens the edit modal when clicking "Editar Cuota"', async () => {
    render(<SuperadminDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Tenant')).toBeInTheDocument();
    });

    const editBtn = screen.getByText('Editar Cuota');
    fireEvent.click(editBtn);

    expect(screen.getByText('Nuevo Límite Semanal')).toBeInTheDocument();
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
  });
});
