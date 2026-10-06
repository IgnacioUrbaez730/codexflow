'use client';

import { useState, useEffect } from 'react';
import { createTemplate, getTemplates } from '../../actions/templateActions';

const MASTER_TEMPLATES = {
  BAUTISMO: {
    name: 'Bautismo',
    schema: {
      fields: [
        { name: 'nombre_bautizado', type: 'text', label: 'Nombre del Bautizado' },
        { name: 'fecha_nacimiento', type: 'date', label: 'Fecha de Nacimiento' },
        { name: 'padre', type: 'text', label: 'Padre' },
        { name: 'madre', type: 'text', label: 'Madre' },
        { name: 'padrinos', type: 'text', label: 'Padrinos' }
      ]
    }
  },
  DEFUNCION: {
    name: 'Defunción',
    schema: {
      fields: [
        { name: 'nombre_difunto', type: 'text', label: 'Nombre del Difunto' },
        { name: 'fecha_defuncion', type: 'date', label: 'Fecha de Defunción' },
        { name: 'causa_muerte', type: 'text', label: 'Causa de Muerte' }
      ]
    }
  }
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Mocks for token and tenantId for MVP
  const token = 'mock-auth-token';
  const tenantId = 'mock-tenant-id';

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const res = await getTemplates(tenantId, token);
      setTemplates(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateMaster = async (key: keyof typeof MASTER_TEMPLATES) => {
    setLoading(true);
    try {
      await createTemplate(MASTER_TEMPLATES[key], tenantId, token);
      await loadTemplates();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Gestión de Plantillas</h1>
      
      <div className="mb-8">
        <h2 className="text-xl mb-2">Crear desde Plantilla Maestra</h2>
        <div className="flex gap-4">
          <button 
            disabled={loading}
            onClick={() => handleCreateMaster('BAUTISMO')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Crear Bautismo
          </button>
          <button 
            disabled={loading}
            onClick={() => handleCreateMaster('DEFUNCION')}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            Crear Defunción
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-xl mb-2">Mis Plantillas</h2>
        {templates.length === 0 ? (
          <p className="text-gray-500">No hay plantillas creadas.</p>
        ) : (
          <ul className="border rounded divide-y">
            {templates.map(t => (
              <li key={t.id} className="p-4 flex justify-between">
                <div>
                  <h3 className="font-semibold">{t.name}</h3>
                  <p className="text-sm text-gray-500">
                    {t.schema?.fields?.length || 0} campos
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
