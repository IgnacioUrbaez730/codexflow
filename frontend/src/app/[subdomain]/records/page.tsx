"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import {
  Search,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText
} from "lucide-react";

interface BatchOption {
  id: string;
  name?: string;
  created_at: string;
  templates?: { name?: string } | null;
}

interface TemplateField {
  id?: string;
  key?: string;
  name?: string;
  label?: string;
  type?: string;
  required?: boolean;
}

interface RecordData {
  id: string;
  batch_id?: string;
  batch_name?: string;
  file_name?: string;
  r2_url?: string;
  status: string;
  metadata?: Record<string, any>;
  verified_at?: string;
  created_at?: string;
  updated_at?: string;
  view_url?: string;
}

export default function RecordsPage() {
  const { subdomain } = useParams() as { subdomain: string };
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );

  // Filter States
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Table & Records States
  const [records, setRecords] = useState<RecordData[]>([]);
  const [templateFields, setTemplateFields] = useState<TemplateField[] | null>(null);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Modal & Viewer States
  const [selectedRecord, setSelectedRecord] = useState<RecordData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Zoom / Pan / Rotate
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load initial session & batches
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      // Check role
      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const authData = await res.json();
          setUserRole(authData.role);
          if (authData.role === "digitizer") {
            router.replace(`/${subdomain}/visor`);
            return;
          }
        }
      } catch (err) {
        console.error("Error fetching user role:", err);
      }

      // Fetch batches
      try {
        const { data: batchData } = await supabase
          .from("batches")
          .select("id, name, created_at, templates(name)")
          .order("created_at", { ascending: false });

        if (batchData) {
          setBatches(batchData as BatchOption[]);
        }
      } catch (err) {
        console.error("Error fetching batches:", err);
      }
    }

    init();
  }, [subdomain, router]);

  // Fetch records
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const params = new URLSearchParams();
      if (selectedBatch) params.append("batch_id", selectedBatch);
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      params.append("page", page.toString());
      params.append("page_size", pageSize.toString());

      const res = await fetch(`/api/v1/records?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${res.statusText}`);
      }

      const resJson = await res.json();
      if (resJson.status === "success") {
        setRecords(resJson.data || []);
        setTotalRecords(resJson.total_records || 0);
        setTotalPages(resJson.total_pages || 1);
        setTemplateFields(resJson.template_fields || null);
      }
    } catch (err) {
      console.error("Error fetching records:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedBatch, debouncedSearch, startDate, endDate, page, pageSize]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // CSV Export handler
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const params = new URLSearchParams();
      if (selectedBatch) params.append("batch_id", selectedBatch);
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);

      const res = await fetch(`/api/v1/records/export?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Error generando el archivo CSV");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `registros_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Export error:", err);
      alert(err.message || "Error al exportar");
    } finally {
      setExporting(false);
    }
  };

  // Open Edit / View Modal
  const handleOpenDetail = (record: RecordData) => {
    setSelectedRecord(record);
    setFormData(record.metadata ? { ...record.metadata } : {});
    setSaveStatus(null);
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedRecord(null);
    setSaveStatus(null);
  };

  // Zoom / Pan handlers
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 4));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleResetZoomPan = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  };
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom((z) => Math.min(z + 0.15, 4));
    } else {
      setZoom((z) => Math.max(z - 0.15, 0.5));
    }
  };

  // Form Field Change
  const handleFieldChange = (key: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Save Record Metadata
  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    if (selectedRecord.status === "in_progress") {
      setSaveStatus({
        type: "error",
        message: "El documento está siendo indexado en este momento y no se puede editar.",
      });
      return;
    }

    setSaving(true);
    setSaveStatus(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sesión no válida");

      const res = await fetch(`/api/v1/records/${selectedRecord.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ metadata: formData }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.detail || "Error al actualizar registro");
      }

      setSaveStatus({
        type: "success",
        message: "¡Cambios guardados con éxito!",
      });

      // Refresh records in list
      await fetchRecords();

      // Auto close after 1s
      setTimeout(() => {
        handleCloseModal();
      }, 1200);
    } catch (err: any) {
      setSaveStatus({
        type: "error",
        message: err.message || "No se pudo guardar la información.",
      });
    } finally {
      setSaving(false);
    }
  };

  // Fields to render in edit form
  const getEditableFields = () => {
    if (templateFields && templateFields.length > 0) {
      return templateFields.map((f) => ({
        key: f.id || f.key || f.name || "",
        label: f.label || f.name || f.id || "",
        type: f.type || "text",
        required: !!f.required,
      }));
    }

    // Fallback: deduce from existing metadata or generic keys
    const metaKeys = Object.keys(formData);
    if (metaKeys.length > 0) {
      return metaKeys.map((k) => ({
        key: k,
        label: k.replace(/_/g, " ").toUpperCase(),
        type: "text",
        required: false,
      }));
    }

    return [];
  };

  const editableFields = getEditableFields();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Explorador de Registros</h1>
          <p className="text-sm text-gray-500">
            Consulta, filtra y edita folios digitalizados y verificados.
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={exporting || loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 shadow-xs cursor-pointer"
        >
          <Download className="w-4 h-4" />
          {exporting ? "Exportando..." : "Exportar CSV"}
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Batch Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">
              Lote
            </label>
            <select
              value={selectedBatch}
              onChange={(e) => {
                setSelectedBatch(e.target.value);
                setPage(1);
              }}
              className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="">Todos los lotes</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name || `Lote ${b.id.slice(0, 8)}`} {b.templates?.name ? `(${b.templates.name})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">
              Búsqueda
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar por nombre, texto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Date Range: From */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">
              Desde (Verificación)
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full text-sm border border-gray-300 rounded-lg p-2 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Date Range: To */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">
              Hasta (Verificación)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full text-sm border border-gray-300 rounded-lg p-2 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Clear Filters Helper */}
        {(selectedBatch || searchTerm || startDate || endDate) && (
          <div className="flex justify-end pt-2 border-t border-gray-100">
            <button
              onClick={() => {
                setSelectedBatch("");
                setSearchTerm("");
                setStartDate("");
                setEndDate("");
                setPage(1);
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
            >
              Limpiar todos los filtros
            </button>
          </div>
        )}
      </div>

      {/* Interactive Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-100 text-gray-600 font-semibold text-xs uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">ID Folio</th>
                <th className="px-4 py-3">Archivo</th>
                {templateFields && templateFields.length > 0 ? (
                  templateFields.slice(0, 4).map((f) => (
                    <th key={f.id || f.key || f.name} className="px-4 py-3">
                      {f.label || f.name || f.id}
                    </th>
                  ))
                ) : (
                  <th className="px-4 py-3">Lote</th>
                )}
                <th className="px-4 py-3">Fecha Verificación</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-2"></div>
                    <p>Cargando registros...</p>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="font-medium text-gray-700">No se encontraron registros</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Intenta ajustar los filtros de búsqueda o seleccionar otro lote.
                    </p>
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const isCompleted = r.status === "completed";
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-mono text-xs text-gray-600 font-medium">
                        {r.id.slice(0, 8)}...
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate" title={r.file_name || ""}>
                        {r.file_name || "Sin archivo"}
                      </td>

                      {/* Dynamic Columns or Standard Batch */}
                      {templateFields && templateFields.length > 0 ? (
                        templateFields.slice(0, 4).map((f) => {
                          const key = f.id || f.key || f.name || "";
                          const val = r.metadata ? r.metadata[key] : "";
                          return (
                            <td key={key} className="px-4 py-3 text-gray-600 max-w-[150px] truncate">
                              {val !== undefined && val !== null ? String(val) : "—"}
                            </td>
                          );
                        })
                      ) : (
                        <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate">
                          {r.batch_name || (r.batch_id ? r.batch_id.slice(0, 8) : "—")}
                        </td>
                      )}

                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {r.verified_at ? new Date(r.verified_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle2 className="w-3 h-3" />
                            Completado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <Clock className="w-3 h-3" />
                            En edición
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleOpenDetail(r)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-medium transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ver / Editar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Counter Footer */}
        <div className="p-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span>
              Mostrando página <strong>{page}</strong> de <strong>{totalPages}</strong> (Total:{" "}
              <strong>{totalRecords}</strong> registros)
            </span>
            <div className="flex items-center gap-1">
              <span>Por página:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="border border-gray-300 rounded p-1 text-xs bg-white text-gray-700"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1 || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Siguiente
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Split Screen: Detalle & Corrección */}
      {isModalOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 sm:p-6 animate-fade-in">
          <div className="bg-gray-900 rounded-2xl w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden text-white border border-gray-800 shadow-2xl">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gray-950 border-b border-gray-800 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-400" />
                <div>
                  <h2 className="text-base font-bold text-gray-100 flex items-center gap-2">
                    <span>Folio:</span>
                    <span className="font-mono text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-300">
                      {selectedRecord.id}
                    </span>
                    {selectedRecord.status === "completed" ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-green-950 text-green-400 border border-green-800">
                        Completado
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-950 text-yellow-400 border border-yellow-800">
                        En edición
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-gray-400">
                    Archivo: {selectedRecord.file_name || selectedRecord.r2_url || "Desconocido"}
                  </p>
                </div>
              </div>

              <button
                onClick={handleCloseModal}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Split Columns */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Left Column: Interactive Image Viewer */}
              <div className="flex-1 bg-gray-950 relative flex flex-col border-b md:border-b-0 md:border-r border-gray-800 overflow-hidden">
                {/* Viewer Controls Toolbar */}
                <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-gray-900/90 backdrop-blur-md p-1.5 rounded-xl border border-gray-700 shadow-lg">
                  <button
                    type="button"
                    onClick={handleZoomIn}
                    title="Acercar (+)"
                    className="p-1.5 hover:bg-gray-800 text-gray-200 rounded-lg transition cursor-pointer"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    title="Alejar (-)"
                    className="p-1.5 hover:bg-gray-800 text-gray-200 rounded-lg transition cursor-pointer"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleRotate}
                    title="Rotar 90°"
                    className="p-1.5 hover:bg-gray-800 text-gray-200 rounded-lg transition cursor-pointer"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleResetZoomPan}
                    title="Restablecer"
                    className="p-1.5 hover:bg-gray-800 text-gray-200 rounded-lg transition cursor-pointer"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  <div className="text-[11px] text-gray-400 font-mono px-2 border-l border-gray-700">
                    {Math.round(zoom * 100)}%
                  </div>
                </div>

                {/* Image Canvas Container */}
                <div
                  className="flex-1 w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onWheel={handleWheel}
                >
                  {selectedRecord.view_url ? (
                    <img
                      src={selectedRecord.view_url}
                      alt="Folio visualizado"
                      style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                        transition: isDragging ? "none" : "transform 0.1s ease-out",
                        maxHeight: "85%",
                        maxWidth: "85%",
                        objectFit: "contain",
                      }}
                      draggable={false}
                      className="shadow-2xl rounded-xs pointer-events-none"
                    />
                  ) : (
                    <div className="text-center text-gray-500 p-8">
                      <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto mb-2" />
                      <p className="text-sm">No se pudo cargar la vista previa de la imagen.</p>
                      <p className="text-xs text-gray-600 mt-1">El archivo podría no estar disponible en Storage.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Record Edit Form */}
              <div className="w-full md:w-[480px] bg-gray-900 flex flex-col justify-between overflow-hidden">
                <form onSubmit={handleSaveChanges} className="flex-1 flex flex-col justify-between overflow-hidden">
                  <div className="flex-1 p-6 overflow-y-auto space-y-5">
                    {/* Status Alert if in_progress */}
                    {selectedRecord.status === "in_progress" && (
                      <div className="p-3 bg-yellow-950/80 border border-yellow-800/80 rounded-xl flex items-start gap-2.5 text-yellow-200 text-xs">
                        <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block font-semibold">Documento bloqueado</strong>
                          Este folio está actualmente en proceso de indexación. Las modificaciones están deshabilitadas
                          hasta que sea completado.
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pb-3 border-b border-gray-800">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Campos del Documento
                      </span>
                      <span className="text-xs text-gray-500">
                        {editableFields.length} campos disponibles
                      </span>
                    </div>

                    {/* Fields list */}
                    {editableFields.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">
                        No hay campos definidos para este registro.
                      </p>
                    ) : (
                      editableFields.map((field) => {
                        const val = formData[field.key] ?? "";
                        return (
                          <div key={field.key} className="space-y-1.5">
                            <label className="flex items-center justify-between text-xs font-medium text-gray-300">
                              <span>
                                {field.label}
                                {field.required && <span className="text-red-400 ml-1">*</span>}
                              </span>
                              <span className="font-mono text-[10px] text-gray-500">{field.key}</span>
                            </label>
                            <input
                              type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
                              value={val}
                              disabled={selectedRecord.status === "in_progress" || saving}
                              onChange={(e) => handleFieldChange(field.key, e.target.value)}
                              className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-sm text-gray-100 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition"
                            />
                          </div>
                        );
                      })
                    )}

                    {/* Status Alert Notification */}
                    {saveStatus && (
                      <div
                        className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                          saveStatus.type === "success"
                            ? "bg-green-950/80 border-green-800 text-green-300"
                            : "bg-red-950/80 border-red-800 text-red-300"
                        }`}
                      >
                        {saveStatus.type === "success" ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-green-400" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                        )}
                        <span>{saveStatus.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Form Actions Footer */}
                  <div className="p-4 bg-gray-950 border-t border-gray-800 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={saving || selectedRecord.status === "in_progress"}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer"
                    >
                      {saving ? "Guardando..." : "Guardar Cambios"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
