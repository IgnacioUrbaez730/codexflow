"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createBrowserClient } from '@supabase/ssr';

import TemplateBuilder from "./TemplateBuilder";

export default function IngestHub() {
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');
  const router = useRouter();
  const params = useParams();
  const subdomain = params.subdomain as string;
  const [activeTab, setActiveTab] = useState("upload");
  const [userRole, setUserRole] = useState<string>("");
  const [tenantId, setTenantId] = useState<string>("");
  
  // Dummy states for the UI
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [recentBatches, setRecentBatches] = useState<any[]>([]);
  const [revisionFolios, setRevisionFolios] = useState<any[]>([]);

  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    // Fetch user role
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (res.ok) {
          const data = await res.json();
          setUserRole(data.role);
        }
      }
    };
    const fetchTemplates = async () => {
      const { data, error } = await supabase.from('templates').select('id, name');
      if (data && !error) {
        setTemplates(data);
      }
    };
    fetchUser();
    fetchTemplates();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) {
      alert("Please select a template first.");
      return;
    }
    if (files.length === 0) {
      alert("Please select at least one file.");
      return;
    }
    
    setIsUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const batchId = crypto.randomUUID();
      const { error: batchError } = await supabase.from('batches').insert({
        id: batchId,
        template_id: selectedTemplate,
        status: 'uploading'
      });
      if (batchError) throw new Error(`Error creando lote: ${batchError.message}`);

      const uploadedKeys: string[] = [];

      for (const file of files) {
        const urlRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/upload/url?filename=${encodeURIComponent(file.name)}&content_type=${encodeURIComponent(file.type)}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!urlRes.ok) throw new Error("Failed to get upload URL");
        const { url, key } = await urlRes.json();

        const uploadRes = await fetch(url, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type
          }
        });

        if (!uploadRes.ok) throw new Error("Failed to upload file to R2");
        uploadedKeys.push(key);
      }

      const ingestRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ batch_id: batchId, files: uploadedKeys })
      });

      if (!ingestRes.ok) throw new Error("Failed to dispatch ingestion");
      
      alert("Upload completed successfully!");
      setFiles([]);
    } catch (error: any) {
      alert(`Error during upload: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Hub de Ingesta</h1>
      
      <div className="flex space-x-4 border-b mb-6">
        <button 
          className={`py-2 px-4 ${activeTab === 'upload' ? 'border-b-2 border-blue-500 font-bold' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          Subir Lote
        </button>
        <button 
          className={`py-2 px-4 ${activeTab === 'revision' ? 'border-b-2 border-blue-500 font-bold' : ''}`}
          onClick={() => setActiveTab('revision')}
        >
          Dudosos
        </button>
        {userRole !== 'archivist' && (
          <button 
            className={`py-2 px-4 ${activeTab === 'templates' ? 'border-b-2 border-blue-500 font-bold' : ''}`}
            onClick={() => setActiveTab('templates')}
          >
            Plantillas
          </button>
        )}
      </div>

      {activeTab === 'upload' && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">Subir Nuevo Lote</h2>
          <form onSubmit={handleUpload} className="mb-8 space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium mb-1">Seleccionar Plantilla</label>
              <select 
                className="w-full border rounded p-2"
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                required
              >
                <option value="">-- Selecciona una plantilla --</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Archivos</label>
              <input 
                type="file" 
                multiple 
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                className="w-full border rounded p-2" 
              />
            </div>
            <button 
              type="submit" 
              disabled={isUploading}
              className={`px-4 py-2 rounded text-white ${isUploading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {isUploading ? 'Subiendo...' : 'Subir Archivos'}
            </button>
          </form>

          <h2 className="text-xl font-semibold mb-4">Lotes Recientes</h2>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-2">ID</th>
                <th>Estado</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {recentBatches.length === 0 ? (
                <tr><td colSpan={3} className="py-4 text-gray-500">No hay lotes recientes.</td></tr>
              ) : (
                recentBatches.map(batch => (
                  <tr key={batch.id} className="border-b">
                    <td className="py-2">{batch.id}</td>
                    <td>{batch.status}</td>
                    <td>{batch.date}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'revision' && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">Folios Dudosos (Revisión)</h2>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-2">Folio ID</th>
                <th>Lote</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {revisionFolios.length === 0 ? (
                <tr><td colSpan={3} className="py-4 text-gray-500">No hay folios en revisión.</td></tr>
              ) : (
                revisionFolios.map(folio => (
                  <tr key={folio.id} className="border-b">
                    <td className="py-2">{folio.id}</td>
                    <td>{folio.batch_id}</td>
                    <td>
                      <button 
                        onClick={() => router.push(`/${subdomain}/visor?folio_id=${folio.id}`)}
                        className="text-blue-600 hover:underline"
                      >
                        Corregir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'templates' && userRole !== 'archivist' && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">Gestión de Plantillas</h2>
          <p className="text-gray-600 mb-4">Aquí puedes crear y editar plantillas de extracción.</p>
          <TemplateBuilder tenantId={tenantId} />
        </div>
      )}
    </div>
  );
}
