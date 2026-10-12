"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Search } from "lucide-react";
import { useImageViewerFilters } from "../../../hooks/useImageViewerFilters";
import { MagnifierLens } from "../../../components/viewer/MagnifierLens";
import { FilterControlsPopover } from "../../../components/viewer/FilterControlsPopover";

export default function VisorDual() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const subdomain = params.subdomain as string;
  const folioIdParam = searchParams.get("folio_id");
  
  const [folio, setFolio] = useState<any>(null);
  const [template, setTemplate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<any>({});

  // Image viewer interaction states
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Hook for image filters and magnifier
  const {
    filters,
    magnifier,
    setMagnifier,
    filterString,
    updateFilter,
    resetFilters,
    resetMagnifier,
    toggleMagnifier,
    toggleInvert,
    toggleGrayscale,
    toggleBinarized,
    setMagnifierZoom,
  } = useImageViewerFilters();

  const [imageRect, setImageRect] = useState<DOMRect | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
    setMagnifier((m) => ({ ...m, active: false, visible: false }));
  }, [folio?.id, setMagnifier]);

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 4));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.5));
  const handleResetZoomPan = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
    resetFilters();
    resetMagnifier();
  };
  const handleRotate = () => setRotation(r => (r + 90) % 360);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (magnifier.active) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (imgRef.current) {
      const rect = imgRef.current.getBoundingClientRect();
      setImageRect(rect);
      const isInside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      setMagnifier((m) => ({
        ...m,
        cursorPos: { x: e.clientX, y: e.clientY },
        visible: isInside,
      }));
    }
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setMagnifier((m) => ({ ...m, visible: false }));
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (magnifier.active) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.25 : -0.25;
      setMagnifierZoom((z) => Math.max(1.5, Math.min(5.0, z + delta)));
    } else {
      if (e.deltaY < 0) {
        setZoom(z => Math.min(z + 0.15, 4));
      } else {
        setZoom(z => Math.max(z - 0.15, 0.5));
      }
    }
  };

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchTemplate = async (templateId: string) => {
    const { data } = await supabase.from('templates').select('*').eq('id', templateId).single();
    if (data) setTemplate(data);
  };

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
        // get template_id from batch
        const batchRes = await supabase.from('batches').select('template_id').eq('id', resData.data.batch_id).single();
        if (batchRes.data) {
          await fetchTemplate(batchRes.data.template_id);
        }
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
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await fetch(`/api/v1/folios/${id}`, {
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`
        }
      });
      const resData = await res.json();
      if (res.ok && resData.status === "success" && resData.data) {
        setFolio(resData.data);
        setFormData(resData.data.ai_predictions || {});
        const batchRes = await supabase.from('batches').select('template_id').eq('id', resData.data.batch_id).single();
        if (batchRes.data) {
          await fetchTemplate(batchRes.data.template_id);
        }
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
    
    // Validate required fields
    if (template && template.fields) {
      for (const field of template.fields) {
        if (field.required) {
          const val = formData[field.id];
          if (val === undefined || val === null || String(val).trim() === "") {
            alert(`El campo "${field.label}" es obligatorio.`);
            return;
          }
        }
      }
    }
    
    console.log("Saving folio...", formData);
    
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/v1/folios/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token}`
      },
      body: JSON.stringify({
        folio_id: folio.id,
        metadata: formData,
        status: "completed"
      })
    });
    
    const resData = await res.json();
    if (resData.status !== "success") {
       alert("Error: " + resData.detail);
       return;
    }
    
    if (folioIdParam) {
      // In revision mode, just go back or to ingest hub
      router.push(`/${subdomain}/ingest`);
    } else {
      // In queue mode, mark as completed and get next
      fetchNextFolio();
    }
  }, [folio, formData, template, folioIdParam, router, subdomain, fetchNextFolio, supabase]);

  const handleMarkRevision = useCallback(async () => {
    if (!folio) return;
    
    console.log("Marking folio as revision...");
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/v1/folios/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token}`
      },
      body: JSON.stringify({
        folio_id: folio.id,
        metadata: formData,
        status: "revision"
      })
    });
    
    if (folioIdParam) {
      router.push(`/${subdomain}/ingest`);
    } else {
      fetchNextFolio();
    }
  }, [folio, formData, folioIdParam, router, subdomain, fetchNextFolio, supabase]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        handleSave();
      } else if (e.ctrlKey && e.code === "Space") {
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
      <div 
        ref={containerRef}
        className="w-1/2 bg-gray-900 border-r relative flex items-center justify-center p-4 overflow-hidden select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      >
        {/* Floating Toolbar */}
        <div 
          className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-2 bg-gray-800/90 backdrop-blur border border-gray-700 text-white px-3 py-1.5 rounded-full shadow-lg text-sm"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button 
            type="button"
            onClick={handleZoomOut}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-700 text-gray-200 font-bold"
            title="Alejar (-)"
            aria-label="Alejar"
          >
            -
          </button>
          <span className="text-xs font-mono font-medium min-w-[3rem] text-center select-none text-gray-200">
            {Math.round(zoom * 100)}%
          </span>
          <button 
            type="button"
            onClick={handleZoomIn}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-700 text-gray-200 font-bold"
            title="Acercar (+)"
            aria-label="Acercar"
          >
            +
          </button>
          <span className="h-4 w-px bg-gray-600 mx-1" />
          <button 
            type="button"
            onClick={handleRotate}
            className="px-2.5 py-1 flex items-center rounded hover:bg-gray-700 text-xs text-gray-200 font-medium"
            title="Rotar 90°"
          >
            Rotar 90°
          </button>
          <button 
            type="button"
            onClick={handleResetZoomPan}
            className="px-2.5 py-1 flex items-center rounded hover:bg-gray-700 text-xs text-gray-200 font-medium"
            title="Restablecer"
          >
            Restablecer
          </button>

          <span className="h-4 w-px bg-gray-600 mx-1" />

          {/* Interactive Magnifier Toggle */}
          <button
            type="button"
            onClick={toggleMagnifier}
            className={`px-2.5 py-1 flex items-center gap-1.5 rounded text-xs font-medium transition-colors cursor-pointer select-none ${
              magnifier.active ? "bg-blue-600 text-white shadow-sm" : "hover:bg-gray-700 text-gray-200"
            }`}
            title="Lupa Interactiva (L)"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Lupa [L]</span>
          </button>

          {/* Readability Filters Popover */}
          <FilterControlsPopover
            filters={filters}
            updateFilter={updateFilter}
            resetFilters={resetFilters}
            toggleInvert={toggleInvert}
            toggleGrayscale={toggleGrayscale}
            toggleBinarized={toggleBinarized}
          />
        </div>

        {folio.view_url ? (
          <>
            <img 
              ref={imgRef}
              src={folio.view_url} 
              alt="Documento para indexar" 
              draggable={false}
              style={{ 
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`, 
                cursor: magnifier.active ? 'crosshair' : (isDragging ? 'grabbing' : 'grab'), 
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                filter: filterString
              }}
              className="max-h-full max-w-full object-contain rounded shadow-lg"
            />

            {/* Interactive Magnifier Floating Lens */}
            <MagnifierLens
              imageSrc={folio.view_url}
              magnifier={magnifier}
              filterString={filterString}
              imageRect={imageRect}
              rotation={rotation}
            />
          </>
        ) : (
          <div className="text-gray-400">Cargando documento...</div>
        )}
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
          {template?.fields ? (
            template.fields.map((f: any) => (
              <div key={f.id}>
                <label className="block text-sm font-medium mb-1">
                  {f.label} {f.required && <span className="text-red-500">*</span>}
                </label>
                {f.type === "long_text" ? (
                  <textarea 
                    className="w-full border rounded p-2" 
                    value={formData[f.id] || ""}
                    onChange={(e) => setFormData({...formData, [f.id]: e.target.value})}
                  />
                ) : f.type === "dropdown" ? (
                  <select 
                    className="w-full border rounded p-2"
                    value={formData[f.id] || ""}
                    onChange={(e) => setFormData({...formData, [f.id]: e.target.value})}
                  >
                    <option value="">-- Seleccionar --</option>
                    {f.options?.map((o: string, j: number) => <option key={j} value={o}>{o}</option>)}
                  </select>
                ) : f.type === "date" ? (
                  <input 
                    type="date" 
                    className="w-full border rounded p-2" 
                    value={formData[f.id] || ""}
                    onChange={(e) => setFormData({...formData, [f.id]: e.target.value})}
                  />
                ) : (
                  <input 
                    type="text" 
                    className="w-full border rounded p-2" 
                    value={formData[f.id] || ""}
                    onChange={(e) => setFormData({...formData, [f.id]: e.target.value})}
                  />
                )}
              </div>
            ))
          ) : (
            <div className="text-gray-500 text-sm">Cargando campos...</div>
          )}
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
