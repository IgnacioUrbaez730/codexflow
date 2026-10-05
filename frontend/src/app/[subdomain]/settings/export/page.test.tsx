import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExportSettingsPage from './page';

global.fetch = jest.fn();

describe('ExportSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.URL.createObjectURL = jest.fn();
    window.URL.revokeObjectURL = jest.fn();
    window.alert = jest.fn();
    window.confirm = jest.fn(() => true);
  });

  it('renders correctly', () => {
    render(<ExportSettingsPage />);
    expect(screen.getByText('Configuración de Exportación')).toBeInTheDocument();
    expect(screen.getByText('Descargar CSV (Últimos 30 días)')).toBeInTheDocument();
    expect(screen.getByText('Regenerar Llave Maestra')).toBeInTheDocument();
    expect(screen.getByDisplayValue('********************************')).toBeInTheDocument();
  });

  it('downloads CSV when button is clicked', async () => {
    const mockBlob = new Blob(['test csv content'], { type: 'text/csv' });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      blob: async () => mockBlob,
    });

    render(<ExportSettingsPage />);
    
    fireEvent.click(screen.getByText('Descargar CSV (Últimos 30 días)'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/export/csv');
      expect(window.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  it('regenerates API key and shows it only once', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ apiKey: 'new-plain-text-key' }),
    });

    render(<ExportSettingsPage />);
    
    fireEvent.click(screen.getByText('Regenerar Llave Maestra'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/keys/regenerate', { method: 'POST' });
    });

    // Should display the new key
    expect(screen.getByDisplayValue('new-plain-text-key')).toBeInTheDocument();
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Por favor, cópiala ahora'));
  });
});
