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
  
  // States for the UI
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [recentBatches, setRecentBatches] = useState<any[]>([]);
  const [revisionFolios, setRevisionFolios] = useState<any[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [loadingRevision, setLoadingRevision] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const fetchRecentBatches = async () => {
    setLoadingBatches(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      let fetchedBatches: any[] = [];
      if (token) {
        try {
          const res = await fetch('/api/v1/batches', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            fetchedBatches = Array.isArray(data) ? data : data.data || [];
          }
        } catch (fetchErr) {
          console.warn('Fallback a Supabase directo para batches:', fetchErr);
        }
      }

      if (fetchedBatches.length === 0) {
        const { data, error } = await supabase
          .from('batches')
          .select('id, template_id, status, created_at, templates(name)')
          .order('created_at', { ascending: false });
        if (!error && data) {
          fetchedBatches = data;
        }
      }

      setRecentBatches(fetchedBatches);
    } catch (err) {
      console.error('Error cargando lotes recientes:', err);
    } finally {
      setLoadingBatches(false);
    }
  };

  const fetchDudosos = async () => {
    setLoadingRevision(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      let fetchedFolios: any[] = [];
      if (token) {
        try {
          const res = await fetch('/api/v1/folios/revision', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            fetchedFolios = Array.isArray(data) ? data : data.data || [];
          }
        } catch (fetchErr) {
          console.warn('Fallback a Supabase directo para folios en revisión:', fetchErr);
        }
      }

      if (fetchedFolios.length === 0) {
        const { data, error } = await supabase
          .from('folios')
          .select('*, batches(id, template_id, uploaded_by, templates(name))')
          .eq('status', 'revision')
          .order('created_at', { ascending: false });

        if (!error && data) {
          if (userRole === 'archivist' && session?.user?.id) {
            fetchedFolios = data.filter((f: any) => f.batches?.uploaded_by === session.user.id);
          } else {
            fetchedFolios = data;
          }
        }
      }

      setRevisionFolios(fetchedFolios);
    } catch (err) {
      console.error('Error cargando folios dudosos:', err);
    } finally {
      setLoadingRevision(false);
    }
  };

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
        
        // Fetch tenant_id directly from DB since /auth/me doesn't include it
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('tenant_id')
          .eq('user_id', session.user.id)
          .single();
          
        if (profile) {
          setTenantId(profile.tenant_id);
        }
      }
    };
    const fetchTemplates = async () => {
      const { data, error } = await supabase.from('templates').select('id, name');
      if (error) console.error('Error cargando plantillas:', error);
      if (data && !error) {
        setTemplates(data);
      }
    };
    fetchUser();
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (activeTab === 'upload') {
      fetchRecentBatches();
    } else if (activeTab === 'revision') {
      fetchDudosos();
    }
  }, [activeTab]);

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
      const userId = session?.user?.id;

      if (!userId || !tenantId) throw new Error("No user or tenant found.");

      const batchId = crypto.randomUUID();
      const { error: batchError } = await supabase.from('batches').insert({
        id: batchId,
        template_id: selectedTemplate,
        status: 'pending',
        tenant_id: tenantId,
        uploaded_by: userId
      });
      if (batchError) throw new Error(`Error creando lote: ${batchError.message}`);

      const uploadedKeys: string[] = [];

      for (const file of files) {
        const urlRes = await fetch(`/api/v1/upload/url?filename=${encodeURIComponent(file.name)}&content_type=${encodeURIComponent(file.type)}`, {
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

      const ingestRes = await fetch(`/api/v1/ingest`, {
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
      fetchRecentBatches();
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
                <th>Plantilla</th>
                <th>Estado</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {loadingBatches ? (
                <tr><td colSpan={4} className="py-4 text-gray-500">Cargando lotes...</td></tr>
              ) : recentBatches.length === 0 ? (
                <tr><td colSpan={4} className="py-4 text-gray-500">No hay lotes recientes.</td></tr>
              ) : (
                recentBatches.map(batch => (
                  <tr key={batch.id} className="border-b">
                    <td className="py-2 font-mono text-sm" title={batch.id}>
                      {batch.id ? `${batch.id.slice(0, 8)}...` : '-'}
                    </td>
                    <td>{batch.templates?.name || 'Sin plantilla'}</td>
                    <td>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        batch.status === 'completed' ? 'bg-green-100 text-green-800' :
                        batch.status === 'processing' || batch.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        batch.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {batch.status}
                      </span>
                    </td>
                    <td>{batch.created_at ? new Date(batch.created_at).toLocaleString() : (batch.date || '-')}</td>
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
                <th>Lote / Plantilla</th>
                <th>Fecha</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {loadingRevision ? (
                <tr><td colSpan={4} className="py-4 text-gray-500">Cargando folios en revisión...</td></tr>
              ) : revisionFolios.length === 0 ? (
                <tr><td colSpan={4} className="py-4 text-gray-500">No hay folios en revisión.</td></tr>
              ) : (
                revisionFolios.map(folio => {
                  const batchInfo = folio.batches;
                  const templateName = batchInfo?.templates?.name;
                  const batchDisplay = templateName
                    ? templateName
                    : (folio.batch_id ? `Lote ${folio.batch_id.slice(0, 8)}...` : '-');
                  const dateDisplay = folio.created_at
                    ? new Date(folio.created_at).toLocaleString()
                    : '-';
                  return (
                    <tr key={folio.id} className="border-b">
                      <td className="py-2 font-mono text-sm" title={folio.id}>
                        {folio.id ? `${folio.id.slice(0, 8)}...` : '-'}
                      </td>
                      <td>{batchDisplay}</td>
                      <td>{dateDisplay}</td>
                      <td>
                        <button 
                          onClick={() => router.push(`/${subdomain}/visor?folio_id=${folio.id}`)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
                        >
                          Corregir
                        </button>
                      </td>
                    </tr>
                  );
                })
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
