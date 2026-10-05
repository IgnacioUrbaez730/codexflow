import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UsersPage from './page';

// Mock fetch
global.fetch = jest.fn();

describe('Users Management Page', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it('renders the users table and invite button', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        { id: '1', email: 'admin@example.com', role: 'admin' },
      ]),
    });

    render(<UsersPage params={{ subdomain: 'test' }} />);
    
    expect(screen.getByText(/Gestión de Usuarios/i)).toBeInTheDocument();
    expect(screen.getByText(/Invitar Usuario/i)).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    });
  });

  it('opens modal and submits invite form', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([]),
      }) // initial fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      }); // invite submit

    render(<UsersPage params={{ subdomain: 'test' }} />);
    
    const inviteBtn = screen.getByText(/Invitar Usuario/i);
    fireEvent.click(inviteBtn);

    const emailInput = screen.getByPlaceholderText(/Email/i);
    const roleSelect = screen.getByRole('combobox');
    const submitBtn = screen.getByText(/Enviar Invitación/i);

    fireEvent.change(emailInput, { target: { value: 'new@example.com' } });
    fireEvent.change(roleSelect, { target: { value: 'archivist' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/users/invite', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'new@example.com', role: 'archivist' })
      }));
    });
  });
});
