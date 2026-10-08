"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function IngestHub() {
  const router = useRouter();
  const params = useParams();
  const subdomain = params.subdomain as string;
  const [activeTab, setActiveTab] = useState("upload");
  const [userRole, setUserRole] = useState<string>("archivist");
  
  // Dummy states for the UI
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [recentBatches, setRecentBatches] = useState<any[]>([]);
  const [revisionFolios, setRevisionFolios] = useState<any[]>([]);

  useEffect(() => {
    // Fetch user role
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // mock fetching profile
        const { data } = await supabase.from("user_profiles").select("role").eq("user_id", session.user.id).single();
        if (data) {
          setUserRole(data.role);
        }
      }
    };
    fetchUser();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) {
      alert("Please select a template first.");
      return;
    }
    // Async upload without blocking
    alert("Upload started asynchronously...");
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
                <option value="temp1">Plantilla 1</option>
                <option value="temp2">Plantilla 2</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Archivos</label>
              <input type="file" multiple className="w-full border rounded p-2" />
            </div>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              Subir Archivos
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
          <p className="text-gray-600">Aquí puedes crear y editar plantillas de extracción.</p>
          {/* Lógica de plantillas migrada */}
        </div>
      )}
    </div>
  );
}
