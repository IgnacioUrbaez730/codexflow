import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from './page';

describe('DashboardPage', () => {
  it('renders loading state initially', () => {
    render(<DashboardPage params={{ subdomain: 'test-tenant' }} />);
    expect(screen.getByText(/Cargando dashboard.../i)).toBeInTheDocument();
  });

  it('renders dashboard with soft paywall and metrics', async () => {
    render(<DashboardPage params={{ subdomain: 'test-tenant' }} />);

    // Wait for the simulated fetch to complete
    await waitFor(() => {
      expect(screen.queryByText(/Cargando dashboard.../i)).not.toBeInTheDocument();
    });

    // Subdomain title
    expect(screen.getByText(/Dashboard del Tenant: test-tenant/i)).toBeInTheDocument();

    // KPIs Funnel
    expect(screen.getByText('150')).toBeInTheDocument(); // Uploaded
    expect(screen.getByText('98')).toBeInTheDocument();  // Verified

    // Trend chart (checking max value)
    expect(screen.getByText('30')).toBeInTheDocument();

    // Soft paywall text
    expect(screen.getByText(/Procesamiento Congelado: Has alcanzado el límite/i)).toBeInTheDocument();
  });
});
