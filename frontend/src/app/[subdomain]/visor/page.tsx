"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function VisorDual() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const subdomain = params.subdomain as string;
  const folioIdParam = searchParams.get("folio_id");
  
  const [folio, setFolio] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<any>({});

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchNextFolio = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/v1/folios/get_next", { 
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${data.session?.access_token}`
        }
      });
      const resData = await res.json();
      if (resData.status === "success" && resData.data) {
        setFolio(resData.data);
        setFormData(resData.data.ai_predictions || {});
      } else {
        setFolio(null);
      }
    } catch (e) {
      console.error(e);
      setFolio(null);
    }
    setLoading(false);
  }, [supabase]);

  const fetchSpecificFolio = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const { data } = await supabase.from('folios').select('*').eq('id', id).single();
      if (data) {
        setFolio(data);
        setFormData(data.ai_predictions || {});
      } else {
        setFolio(null);
      }
    } catch (e) {
      console.error(e);
      setFolio(null);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (folioIdParam) {
      fetchSpecificFolio(folioIdParam);
    } else {
      fetchNextFolio();
    }
  }, [folioIdParam, fetchNextFolio, fetchSpecificFolio]);

  const handleSave = useCallback(async () => {
    if (!folio) return;
    
    // Allow saving empty fields
    console.log("Saving folio...", formData);
    
    await supabase.from('folios').update({ status: 'completed', metadata: formData }).eq('id', folio.id);
    
    if (folioIdParam) {
      // In revision mode, just go back or to ingest hub
      router.push(`/${subdomain}/ingest`);
    } else {
      // In queue mode, mark as completed and get next
      fetchNextFolio();
    }
  }, [folio, formData, folioIdParam, router, subdomain, fetchNextFolio, supabase]);

  const handleMarkRevision = useCallback(async () => {
    if (!folio) return;
    
    console.log("Marking folio as revision...");
    await supabase.from('folios').update({ status: 'revision' }).eq('id', folio.id);
    
    if (folioIdParam) {
      router.push(`/${subdomain}/ingest`);
    } else {
      fetchNextFolio();
    }
  }, [folio, folioIdParam, router, subdomain, fetchNextFolio, supabase]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
      if (e.ctrlKey && e.code === "Space") {
        e.preventDefault();
        handleMarkRevision();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, handleMarkRevision]);

  if (loading) {
    return <div className="p-8 text-center">Cargando folio...</div>;
  }

  if (!folio) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">¡Trabajo al día!</h1>
        <p className="text-gray-600 mb-8">No hay folios pendientes en la cola.</p>
        <button 
          onClick={() => router.push(`/${subdomain}/dashboard`)}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700"
        >
          Volver al Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left side: Visor Dual (Document) */}
      <div className="w-1/2 bg-gray-200 border-r flex items-center justify-center p-4">
        <div className="w-full h-full bg-white shadow flex items-center justify-center text-gray-400">
          Visualizador de Documento ({folio.r2_url})
        </div>
      </div>
      
      {/* Right side: Form */}
      <div className="w-1/2 bg-white flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {folioIdParam ? "Modo: Revisión de Dudoso" : "Modo: Cola Global"}
            </h2>
            <p className="text-sm text-gray-500">Folio ID: {folio.id}</p>
          </div>
          <div className="text-sm text-gray-500 space-y-1 text-right">
            <div><kbd className="bg-gray-200 px-1 rounded">Ctrl + Enter</kbd> para Guardar</div>
            <div><kbd className="bg-gray-200 px-1 rounded">Ctrl + Espacio</kbd> para Dudoso</div>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {/* Mock fields */}
          <div>
            <label className="block text-sm font-medium mb-1">Campo 1</label>
            <input 
              type="text" 
              className="w-full border rounded p-2"
              value={formData.field1 || ""}
              onChange={(e) => setFormData({...formData, field1: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Campo 2</label>
            <input 
              type="text" 
              className="w-full border rounded p-2"
              value={formData.field2 || ""}
              onChange={(e) => setFormData({...formData, field2: e.target.value})}
            />
          </div>
        </div>
        
        <div className="p-4 border-t flex justify-end space-x-4 bg-gray-50">
          <button 
            onClick={handleMarkRevision}
            className="px-4 py-2 border border-yellow-500 text-yellow-600 rounded hover:bg-yellow-50"
          >
            Marcar Dudoso
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700"
          >
            Guardar y Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
