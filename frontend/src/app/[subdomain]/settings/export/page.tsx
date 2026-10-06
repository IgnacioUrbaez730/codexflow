"use client";
"use client";
import React, { useState } from 'react';
"use client";

"use client";
export default function ExportSettingsPage() {
"use client";
  const [apiKey, setApiKey] = useState('****************');
"use client";
  const [showKey, setShowKey] = useState(false);
"use client";

"use client";
  const handleDownloadCsv = async () => {
"use client";
    try {
"use client";
      const res = await fetch('/api/v1/export/csv');
"use client";
      if (!res.ok) throw new Error('Failed to download CSV');
"use client";
      
"use client";
      const blob = await res.blob();
"use client";
      const url = window.URL.createObjectURL(blob);
"use client";
      const a = document.createElement('a');
"use client";
      a.href = url;
"use client";
      a.download = `export-${new Date().toISOString().slice(0, 10)}.csv`;
"use client";
      a.click();
"use client";
      window.URL.revokeObjectURL(url);
"use client";
    } catch (err) {
"use client";
      console.error(err);
"use client";
      alert('Error descargando el CSV');
"use client";
    }
"use client";
  };
"use client";

"use client";
  const handleRegenerateKey = async () => {
"use client";
    if (!confirm('¿Estás seguro de que deseas regenerar la Llave Maestra? La llave anterior dejará de funcionar.')) {
"use client";
      return;
"use client";
    }
"use client";
    try {
"use client";
      const res = await fetch('/api/v1/keys/regenerate', { method: 'POST' });
"use client";
      if (!res.ok) throw new Error('Failed to regenerate key');
"use client";
      
"use client";
      const data = await res.json();
"use client";
      setApiKey(data.apiKey);
"use client";
      setShowKey(true);
"use client";
      alert('Llave generada exitosamente. Por favor, cópiala ahora, no se volverá a mostrar.');
"use client";
    } catch (err) {
"use client";
      console.error(err);
"use client";
      alert('Error regenerando la llave');
"use client";
    }
"use client";
  };
"use client";

"use client";
  return (
"use client";
    <div className="p-8 max-w-4xl mx-auto">
"use client";
      <h1 className="text-2xl font-bold mb-6">Configuración de Exportación</h1>
"use client";

"use client";
      <div className="bg-white p-6 rounded-lg shadow mb-8">
"use client";
        <h2 className="text-xl font-semibold mb-4">Exportación de Datos</h2>
"use client";
        <p className="text-gray-600 mb-4">Descarga un archivo CSV con los datos de los folios verificados en los últimos 30 días.</p>
"use client";
        <button 
"use client";
          onClick={handleDownloadCsv}
"use client";
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
"use client";
        >
"use client";
          Descargar CSV (Últimos 30 días)
"use client";
        </button>
"use client";
      </div>
"use client";

"use client";
      <div className="bg-white p-6 rounded-lg shadow border border-red-100">
"use client";
        <h2 className="text-xl font-semibold mb-4 text-red-600">Llave Maestra de API</h2>
"use client";
        <p className="text-gray-600 mb-4">
"use client";
          Esta llave te permite acceder a la API de exportación de manera programática.
"use client";
          Mantenla en secreto y no la compartas.
"use client";
        </p>
"use client";
        
"use client";
        <div className="mb-4">
"use client";
          <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
"use client";
          <div className="flex gap-4 items-center">
"use client";
            <input 
"use client";
              type="text" 
"use client";
              readOnly 
"use client";
              value={showKey ? apiKey : '********************************'} 
"use client";
              className="border p-2 rounded w-full bg-gray-50 font-mono"
"use client";
            />
"use client";
            {showKey && (
"use client";
              <button 
"use client";
                onClick={() => navigator.clipboard.writeText(apiKey)}
"use client";
                className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"
"use client";
              >
"use client";
                Copiar
"use client";
              </button>
"use client";
            )}
"use client";
          </div>
"use client";
        </div>
"use client";

"use client";
        <button 
"use client";
          onClick={handleRegenerateKey}
"use client";
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
"use client";
        >
"use client";
          Regenerar Llave Maestra
"use client";
        </button>
"use client";
      </div>
"use client";
    </div>
"use client";
  );
"use client";
}

