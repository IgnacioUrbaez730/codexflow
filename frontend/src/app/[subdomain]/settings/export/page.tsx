"use client";
import React, { useState } from 'react';



export default function ExportSettingsPage() {

  const [apiKey, setApiKey] = useState('****************');

  const [showKey, setShowKey] = useState(false);



  const handleDownloadCsv = async () => {

    try {

      const res = await fetch('/api/v1/export/csv');

      if (!res.ok) throw new Error('Failed to download CSV');

      

      const blob = await res.blob();

      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');

      a.href = url;

      a.download = `export-${new Date().toISOString().slice(0, 10)}.csv`;

      a.click();

      window.URL.revokeObjectURL(url);

    } catch (err) {

      console.error(err);

      alert('Error descargando el CSV');

    }

  };



  const handleRegenerateKey = async () => {

    if (!confirm('¿Estás seguro de que deseas regenerar la Llave Maestra? La llave anterior dejará de funcionar.')) {

      return;

    }

    try {

      const res = await fetch('/api/v1/keys/regenerate', { method: 'POST' });

      if (!res.ok) throw new Error('Failed to regenerate key');

      

      const data = await res.json();

      setApiKey(data.apiKey);

      setShowKey(true);

      alert('Llave generada exitosamente. Por favor, cópiala ahora, no se volverá a mostrar.');

    } catch (err) {

      console.error(err);

      alert('Error regenerando la llave');

    }

  };



  return (

    <div className="p-8 max-w-4xl mx-auto">

      <h1 className="text-2xl font-bold mb-6">Configuración de Exportación</h1>



      <div className="bg-white p-6 rounded-lg shadow mb-8">

        <h2 className="text-xl font-semibold mb-4">Exportación de Datos</h2>

        <p className="text-gray-600 mb-4">Descarga un archivo CSV con los datos de los folios verificados en los últimos 30 días.</p>

        <button 

          onClick={handleDownloadCsv}

          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"

        >

          Descargar CSV (Últimos 30 días)

        </button>

      </div>



      <div className="bg-white p-6 rounded-lg shadow border border-red-100">

        <h2 className="text-xl font-semibold mb-4 text-red-600">Llave Maestra de API</h2>

        <p className="text-gray-600 mb-4">

          Esta llave te permite acceder a la API de exportación de manera programática.

          Mantenla en secreto y no la compartas.

        </p>

        

        <div className="mb-4">

          <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>

          <div className="flex gap-4 items-center">

            <input 

              type="text" 

              readOnly 

              value={showKey ? apiKey : '********************************'} 

              className="border p-2 rounded w-full bg-gray-50 font-mono"

            />

            {showKey && (

              <button 

                onClick={() => navigator.clipboard.writeText(apiKey)}

                className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"

              >

                Copiar

              </button>

            )}

          </div>

        </div>



        <button 

          onClick={handleRegenerateKey}

          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"

        >

          Regenerar Llave Maestra

        </button>

      </div>

    </div>

  );

}