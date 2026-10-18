"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { useTenant } from "@/context/TenantContext";
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
  FileText,
  Play,
  RotateCcw,
  ChevronDown,
  FileSpreadsheet,
  Loader2,
  Trash2,
  ShieldCheck
} from "lucide-react";
import ExportFamilySearchModal from "@/components/folders/ExportFamilySearchModal";
import { DocumentFolder } from "@/components/folders/types";
import { useImageViewerFilters } from "../../../hooks/useImageViewerFilters";
import { MagnifierLens } from "../../../components/viewer/MagnifierLens";
import { FilterControlsPopover } from "../../../components/viewer/FilterControlsPopover";

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
  entry_id?: string | null;
  folio_id?: string;
  entry_number?: number;
  total_entries_in_folio?: number;
  folio_number?: number | null;
  folio_side?: string | null;
  act_number?: string | null;
  principal_person?: string | null;
  person_name?: string | null;
  event_date?: string | null;
  birth_date?: string | null;
  record_type?: string | null;
  tome_name?: string | null;
  folder_id?: string | null;
  series?: string | null;
  is_continued?: boolean;
  continued_from_entry_id?: string | null;
  is_blank?: boolean;
  canonical_filename?: string;
  original_filename?: string;
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
  review_notes?: string;
  escalated_to_archivist?: boolean;
  escalated_by?: string;
  digitized_by?: string;
  verified_by?: string;
}

interface StatusCounts {
  total: number;
  completed: number;
  verified: number;
  pending: number;
  revision: number;
  in_progress: number;
}

function inferFolderSeries(
  folder: DocumentFolder,
  parentSeries?: string
): string {
  const metaSeries = (
    folder.metadata?.sacrament_type ||
    folder.metadata?.series ||
    parentSeries ||
    ""
  )
    .toString()
    .toLowerCase();
  const nameLower = (folder.name || "").toLowerCase();
  const combined = `${metaSeries} ${nameLower}`;

  if (combined.includes("bautis") || combined.includes("bau")) return "bautismo";
  if (combined.includes("matrim") || combined.includes("mat")) return "matrimonio";
  if (combined.includes("defunc") || combined.includes("def") || combined.includes("entierro"))
    return "defuncion";
  return metaSeries || "";
}

function formatHistoricalDate(dateStr?: string | null): string {
  if (!dateStr || dateStr === "—") return "—";
  const trimmed = dateStr.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }
  return trimmed;
}

const getSavedFilters = (sub: string) => {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`codexflow_records_filters_${sub}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export default function RecordsPage() {
  const { subdomain } = useParams() as { subdomain: string };
  const router = useRouter();

  const supabase = getSupabaseBrowserClient();
  const { role: tenantRole, session: contextSession } = useTenant();

  const savedFilters = React.useMemo(() => getSavedFilters(subdomain), [subdomain]);

  // Hierarchical & Multi-status Filter States with retention (T03-F2-04)
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>(() => savedFilters?.selectedBatch || "");
  const [selectedSeries, setSelectedSeries] = useState<string>(() => savedFilters?.selectedSeries || "");
  const [selectedFolderId, setSelectedFolderId] = useState<string>(() => savedFilters?.selectedFolderId || "");
  const [selectedStatus, setSelectedStatus] = useState<string>(() => savedFilters?.selectedStatus || "all");
  const [counts, setCounts] = useState<StatusCounts>({
    total: 0,
    completed: 0,
    verified: 0,
    pending: 0,
    revision: 0,
    in_progress: 0,
  });
  const [searchTerm, setSearchTerm] = useState<string>(() => savedFilters?.searchTerm || "");
  const [debouncedSearch, setDebouncedSearch] = useState<string>(() => savedFilters?.searchTerm || "");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [page, setPage] = useState<number>(() => savedFilters?.page || 1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Table & Records States
  const [records, setRecords] = useState<RecordData[]>([]);
  const [templateFields, setTemplateFields] = useState<TemplateField[] | null>(null);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);
  const [exportingFormat, setExportingFormat] = useState<"xlsx" | "csv" | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [userRole, setUserRole] = useState<string | null>(tenantRole || null);
  const [authToken, setAuthToken] = useState<string | null>(contextSession?.access_token || null);
  const [availableTomes, setAvailableTomes] = useState<DocumentFolder[]>([]);
  const [selectedTomeForExport, setSelectedTomeForExport] = useState<DocumentFolder | null>(null);
  const [isFamilySearchModalOpen, setIsFamilySearchModalOpen] = useState<boolean>(false);

  // Modal & Viewer States
  const [selectedRecord, setSelectedRecord] = useState<RecordData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [loadingModalImage, setLoadingModalImage] = useState<boolean>(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<RecordData | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Readability filters and magnifier hook
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

  const [modalImageRect, setModalImageRect] = useState<DOMRect | null>(null);
  const modalImgRef = useRef<HTMLImageElement>(null);

  // Zoom / Pan / Rotate
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Retención de filtros en sessionStorage para no perder posición al volver de /visor
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(`codexflow_records_filters_${subdomain}`, JSON.stringify({
          selectedBatch,
          selectedSeries,
          selectedFolderId,
          selectedStatus,
          searchTerm,
          page,
        }));
      } catch {
        // Ignorar excepciones de cuota de storage
      }
    }
  }, [selectedBatch, selectedSeries, selectedFolderId, selectedStatus, searchTerm, page, subdomain]);

  // Debounce search sin resetear página si es la carga inicial restaurada
  const isFirstRender = useRef(true);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      if (!isFirstRender.current) {
        setPage(1);
      }
      isFirstRender.current = false;
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Sincronizar rol desde TenantContext
  useEffect(() => {
    if (tenantRole) {
      setUserRole(tenantRole);
      if (tenantRole === "digitizer") {
        router.replace(`/${subdomain}/visor`);
      }
    }
  }, [tenantRole, subdomain, router]);

  // Load initial session, batches & folders tree en paralelo con Promise.all (T03-F2-04)
  useEffect(() => {
    async function init() {
      let activeSession = contextSession;
      if (!activeSession) {
        const { data: { session } } = await supabase.auth.getSession();
        activeSession = session;
      }
      if (!activeSession) {
        router.replace("/login");
        return;
      }

      setAuthToken(activeSession.access_token);

      try {
        const [batchRes, treeRes] = await Promise.all([
          supabase
            .from("batches")
            .select("id, created_at, templates(name)")
            .order("created_at", { ascending: false }),
          fetch("/api/v1/folders/tree", {
            headers: {
              Authorization: `Bearer ${activeSession.access_token}`,
              "x-subdomain": subdomain,
            },
          }),
        ]);

        if (batchRes.data) {
          setBatches(batchRes.data as BatchOption[]);
        }

        if (treeRes.ok) {
          const treeJson = await treeRes.json();
          const treeData: DocumentFolder[] = treeJson.data || [];
          const tomes: DocumentFolder[] = [];
          const traverse = (nodes: DocumentFolder[], inheritedSeries?: string) => {
            for (const n of nodes) {
              const currentSeries =
                n.folder_type === "series"
                  ? inferFolderSeries(n, inheritedSeries)
                  : inheritedSeries;
              if (n.folder_type === "tome" && !n.metadata?.is_virtual_unclassified) {
                const resolvedSeries = inferFolderSeries(n, currentSeries);
                tomes.push({
                  ...n,
                  metadata: {
                    ...(n.metadata || {}),
                    series: n.metadata?.series || resolvedSeries,
                  },
                });
              }
              if (n.children && n.children.length > 0) {
                traverse(n.children, currentSeries);
              }
            }
          };
          traverse(treeData);
          setAvailableTomes(tomes);
          if (tomes.length > 0) {
            setSelectedTomeForExport((prev) => prev || tomes[0]);
          }
        }
      } catch (err) {
        console.error("Error cargando batches y tomes en paralelo:", err);
      }
    }

    init();
  }, [subdomain, router, contextSession, supabase]);

  // Filter tomes dynamically based on selectedSeries
  const filteredTomes = React.useMemo(() => {
    if (!selectedSeries || selectedSeries === "unclassified") {
      return selectedSeries === "unclassified" ? [] : availableTomes;
    }
    return availableTomes.filter((tome) => {
      const series = inferFolderSeries(tome);
      return series === selectedSeries;
    });
  }, [availableTomes, selectedSeries]);

  // Fetch records
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();
      if (selectedSeries) params.append("series", selectedSeries);
      if (selectedFolderId) params.append("folder_id", selectedFolderId);
      if (selectedStatus) params.append("status", selectedStatus);
      if (selectedBatch) params.append("batch_id", selectedBatch);
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      params.append("page", page.toString());
      params.append("limit", pageSize.toString());
      params.append("page_size", pageSize.toString());

      const res = await fetch(`/api/v1/records?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "x-subdomain": subdomain,
        },
      });

      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${res.statusText}`);
      }

      const resJson = await res.json();
      if (resJson.status === "success") {
        const recordsList = Array.isArray(resJson.data) ? resJson.data : [];
        setRecords(recordsList);
        setTotalRecords(resJson.total_records ?? resJson.total ?? recordsList.length);
        setTotalPages(
          resJson.total_pages ??
            Math.max(1, Math.ceil((resJson.total_records ?? recordsList.length) / pageSize))
        );
        setTemplateFields(resJson.template_fields || null);
        if (resJson.counts) {
          setCounts({
            total: resJson.counts.total ?? 0,
            completed: resJson.counts.completed ?? 0,
            verified: resJson.counts.verified ?? 0,
            pending: resJson.counts.pending ?? 0,
            revision: resJson.counts.revision ?? 0,
            in_progress: resJson.counts.in_progress ?? 0,
          });
        }
      } else {
        setRecords([]);
        setTotalRecords(0);
        setTotalPages(1);
      }
    } catch (err) {
      console.error("Error fetching records:", err);
      setRecords([]);
      setTotalRecords(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [
    selectedSeries,
    selectedFolderId,
    selectedStatus,
    selectedBatch,
    debouncedSearch,
    startDate,
    endDate,
    page,
    pageSize,
    supabase,
  ]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Close export dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    }
    if (isExportMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isExportMenuOpen]);

  // Multi-format Export handler
  const handleExport = async (format: "xlsx" | "csv") => {
    setExporting(true);
    setExportingFormat(format);
    setIsExportMenuOpen(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const params = new URLSearchParams();
      params.append("format", format);
      if (selectedSeries) params.append("series", selectedSeries);
      if (selectedFolderId) params.append("folder_id", selectedFolderId);
      if (selectedStatus && selectedStatus !== "all") params.append("status", selectedStatus);
      if (selectedBatch) params.append("batch_id", selectedBatch);
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);

      const res = await fetch(`/api/v1/records/export?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "x-subdomain": subdomain,
        },
      });

      if (!res.ok) {
        throw new Error(`Error generando el archivo ${format.toUpperCase()}`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `registros_export_${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Export error:", err);
      alert(err.message || "Error al exportar");
    } finally {
      setExporting(false);
      setExportingFormat(null);
    }
  };

  // Open Edit / View Modal with on-demand R2 view_url loading
  const handleOpenDetail = async (record: RecordData) => {
    setSelectedRecord(record);
    setFormData(record.metadata ? { ...record.metadata } : {});
    setSaveStatus(null);
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    setMagnifier((m) => ({ ...m, active: false, visible: false }));
    setIsModalOpen(true);

    if (!record.view_url) {
      const targetFolioId = record.folio_id || record.id;
      if (targetFolioId) {
        setLoadingModalImage(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token || authToken;
          if (token) {
            const res = await fetch(`/api/v1/folios/${targetFolioId}`, {
              headers: {
                Authorization: `Bearer ${token}`,
                "x-subdomain": subdomain,
              },
            });
            if (res.ok) {
              const folioJson = await res.json();
              const signedUrl = folioJson.view_url || folioJson.data?.view_url;
              const fetchedFields = folioJson.template?.fields || folioJson.data?.template?.fields;
              if (signedUrl) {
                setSelectedRecord((prev) =>
                  prev && (prev.id === record.id || prev.folio_id === targetFolioId)
                    ? { ...prev, view_url: signedUrl }
                    : prev
                );
              }
              if (Array.isArray(fetchedFields) && fetchedFields.length > 0 && (!templateFields || templateFields.length === 0)) {
                setTemplateFields(fetchedFields);
              }
            }
          }
        } catch (err) {
          console.error("Error cargando view_url bajo demanda:", err);
        } finally {
          setLoadingModalImage(false);
        }
      }
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedRecord(null);
    setSaveStatus(null);
    setLoadingModalImage(false);
    setMagnifier((m) => ({ ...m, active: false, visible: false }));
  };

  // Quality Arbitration status update handler
  const handleArbitrateStatus = async (newStatus: "verified" | "revision" | "pending") => {
    if (!selectedRecord) return;
    setUpdatingStatus(newStatus);
    setSaveStatus(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sesión no válida");

      const targetId = selectedRecord.entry_id || selectedRecord.id;
      const res = await fetch(`/api/v1/records/${targetId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          "x-subdomain": subdomain,
        },
        body: JSON.stringify({
          status: newStatus,
          folio_id: selectedRecord.folio_id || selectedRecord.id,
          metadata: formData,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.detail || "Error al cambiar el estado del registro");
      }

      const statusLabels: Record<string, string> = {
        verified: "Acta verificada con éxito",
        revision: "Acta marcada como Dudosa / En Revisión",
        pending: "Acta devuelta a estado Pendiente",
      };

      setSelectedRecord((prev) => (prev ? { ...prev, status: newStatus } : prev));
      setSaveStatus({
        type: "success",
        message: statusLabels[newStatus] || "Estado actualizado correctamente.",
      });

      await fetchRecords();
    } catch (err: any) {
      setSaveStatus({
        type: "error",
        message: err.message || "No se pudo actualizar el estado del registro.",
      });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleReleaseFolio = async (folioId: string) => {
    if (!window.confirm("¿Deseas devolver este folio a la cola de indexación?")) {
      return;
    }
    setReleasingId(folioId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sesión no válida");

      const res = await fetch(`/api/v1/folios/${folioId}/release`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "x-subdomain": subdomain,
        },
      });
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.detail || "Error al liberar el folio");
      }
      if (selectedRecord && (selectedRecord.id === folioId || selectedRecord.folio_id === folioId)) {
        handleCloseModal();
      }
      await fetchRecords();
    } catch (err: any) {
      alert(err.message || "Error al liberar folio");
    } finally {
      setReleasingId(null);
    }
  };

  // Zoom / Pan handlers
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 4));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleResetZoomPan = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
    resetFilters();
    resetMagnifier();
  };
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (magnifier.active) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (modalImgRef.current) {
      const rect = modalImgRef.current.getBoundingClientRect();
      setModalImageRect(rect);
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

  const handleMouseUp = () => setIsDragging(false);

  const handleMouseLeave = () => {
    setIsDragging(false);
    setMagnifier((m) => ({ ...m, visible: false }));
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (magnifier.active) {
      const delta = e.deltaY < 0 ? 0.25 : -0.25;
      setMagnifierZoom((z) => Math.max(1.5, Math.min(5.0, z + delta)));
    } else {
      if (e.deltaY < 0) {
        setZoom((z) => Math.min(z + 0.15, 4));
      } else {
        setZoom((z) => Math.max(z - 0.15, 0.5));
      }
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

      const targetId = selectedRecord.entry_id || selectedRecord.id;
      const res = await fetch(`/api/v1/records/${targetId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          "x-subdomain": subdomain,
        },
        body: JSON.stringify({
          metadata: formData,
          folio_id: selectedRecord.folio_id || selectedRecord.id,
        }),
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

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No hay sesión activa");
      }

      const res = await fetch(`/api/v1/records/${recordToDelete.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "x-subdomain": subdomain,
        },
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.detail || "Error al eliminar registro");
      }

      setRecordToDelete(null);
      if (isModalOpen) {
        handleCloseModal();
      }
      await fetchRecords();
    } catch (err: any) {
      setDeleteError(err.message || "No se pudo eliminar el registro");
    } finally {
      setIsDeleting(false);
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
  const canArbitrate =
    !userRole || ["admin", "archivist", "evaluator", "superadmin"].includes(userRole);
  const canDelete = !userRole || ["admin", "superadmin"].includes(userRole);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Explorador de Registros</h1>
          <p className="text-sm text-gray-500">
            Consola archivística integral: navega por serie y tomo, supervisa estados y verifica partidas.
          </p>
        </div>
        <div className="relative" ref={exportMenuRef}>
          <button
            onClick={() => setIsExportMenuOpen((prev) => !prev)}
            disabled={exporting || loading}
            aria-expanded={isExportMenuOpen}
            aria-haspopup="true"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 shadow-xs cursor-pointer"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Exportando ({exportingFormat?.toUpperCase()})...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Exportar Registros</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExportMenuOpen ? "rotate-180" : ""}`} />
              </>
            )}
          </button>

          {isExportMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-30 animate-in fade-in slide-in-from-top-2 duration-150">
              <button
                onClick={() => handleExport("xlsx")}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition cursor-pointer text-left"
              >
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-medium">Exportar a Excel (.xlsx)</div>
                  <div className="text-xs text-gray-400">Libro nativo con formato</div>
                </div>
              </button>

              <button
                onClick={() => handleExport("csv")}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition cursor-pointer text-left"
              >
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-medium">Exportar a CSV (.csv)</div>
                  <div className="text-xs text-gray-400">Delimitado por ';' (Excel)</div>
                </div>
              </button>

              <div className="my-1 border-t border-gray-100" />

              <button
                onClick={() => {
                  setIsExportMenuOpen(false);
                  if (availableTomes.length > 0) {
                    setIsFamilySearchModalOpen(true);
                  } else {
                    alert("No hay tomos catalogados para exportar en formato DIP FamilySearch. Ve a Ingesta > Carpetas para catalogar tomos.");
                  }
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition cursor-pointer text-left"
              >
                <div className="p-1.5 rounded-lg bg-emerald-600 text-white">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-medium text-emerald-800">Paquete FamilySearch (DIP)</div>
                  <div className="text-xs text-gray-400">Excel, CSV, GEDCOM, ZIP</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Status Counter Bar (5 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* 1. Todos */}
        <button
          type="button"
          onClick={() => {
            setSelectedStatus("all");
            setPage(1);
          }}
          className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition cursor-pointer ${
            selectedStatus === "all"
              ? "bg-slate-900 text-white border-slate-900 shadow-sm"
              : "bg-white text-gray-800 border-gray-200 hover:border-slate-400 hover:bg-slate-50"
          }`}
        >
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wider ${selectedStatus === "all" ? "text-slate-300" : "text-gray-500"}`}>
              Todos
            </p>
            <p className="text-xl font-bold mt-0.5">{counts.total}</p>
          </div>
          <div className={`p-2 rounded-lg ${selectedStatus === "all" ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-600"}`}>
            <FileText className="w-5 h-5" />
          </div>
        </button>

        {/* 2. Completados */}
        <button
          type="button"
          onClick={() => {
            setSelectedStatus("completed");
            setPage(1);
          }}
          className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition cursor-pointer ${
            selectedStatus === "completed"
              ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
              : "bg-white text-gray-800 border-gray-200 hover:border-emerald-400 hover:bg-emerald-50/40"
          }`}
        >
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wider ${selectedStatus === "completed" ? "text-emerald-100" : "text-emerald-700"}`}>
              Completados
            </p>
            <p className="text-xl font-bold mt-0.5">{counts.completed}</p>
          </div>
          <div className={`p-2 rounded-lg ${selectedStatus === "completed" ? "bg-emerald-700 text-white" : "bg-emerald-100 text-emerald-700"}`}>
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </button>

        {/* 3. Verificados */}
        <button
          type="button"
          onClick={() => {
            setSelectedStatus("verified");
            setPage(1);
          }}
          className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition cursor-pointer ${
            selectedStatus === "verified"
              ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
              : "bg-white text-gray-800 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/40"
          }`}
        >
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wider ${selectedStatus === "verified" ? "text-indigo-100" : "text-indigo-700"}`}>
              Verificados
            </p>
            <p className="text-xl font-bold mt-0.5">{counts.verified}</p>
          </div>
          <div className={`p-2 rounded-lg ${selectedStatus === "verified" ? "bg-indigo-700 text-white" : "bg-indigo-100 text-indigo-700"}`}>
            <ShieldCheck className="w-5 h-5" />
          </div>
        </button>

        {/* 4. Pendientes */}
        <button
          type="button"
          onClick={() => {
            setSelectedStatus("pending");
            setPage(1);
          }}
          className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition cursor-pointer ${
            selectedStatus === "pending"
              ? "bg-amber-500 text-white border-amber-500 shadow-sm"
              : "bg-white text-gray-800 border-gray-200 hover:border-amber-400 hover:bg-amber-50/40"
          }`}
        >
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wider ${selectedStatus === "pending" ? "text-amber-100" : "text-amber-700"}`}>
              Pendientes
            </p>
            <p className="text-xl font-bold mt-0.5">{counts.pending}</p>
          </div>
          <div className={`p-2 rounded-lg ${selectedStatus === "pending" ? "bg-amber-600 text-white" : "bg-amber-100 text-amber-700"}`}>
            <Clock className="w-5 h-5" />
          </div>
        </button>

        {/* 5. Dudosos / Revisión */}
        <button
          type="button"
          onClick={() => {
            setSelectedStatus("revision");
            setPage(1);
          }}
          className={`col-span-2 sm:col-span-1 flex items-center justify-between p-3.5 rounded-xl border text-left transition cursor-pointer ${
            selectedStatus === "revision"
              ? "bg-orange-600 text-white border-orange-600 shadow-sm"
              : "bg-white text-gray-800 border-gray-200 hover:border-orange-400 hover:bg-orange-50/40"
          }`}
        >
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wider ${selectedStatus === "revision" ? "text-orange-100" : "text-orange-700"}`}>
              Dudosos / Revisión
            </p>
            <p className="text-xl font-bold mt-0.5">{counts.revision}</p>
          </div>
          <div className={`p-2 rounded-lg ${selectedStatus === "revision" ? "bg-orange-700 text-white" : "bg-orange-100 text-orange-700"}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </button>
      </div>

      {/* Cascading Filters Bar (6 Controls) */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* 1. Serie / Carpeta */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">
              Serie / Carpeta
            </label>
            <select
              value={selectedSeries}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedSeries(val);
                if (val === "unclassified") {
                  setSelectedFolderId("unclassified");
                } else {
                  setSelectedFolderId("");
                }
                setPage(1);
              }}
              className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="">Todas las series</option>
              <option value="bautismo">Bautismos</option>
              <option value="matrimonio">Matrimonios</option>
              <option value="defuncion">Defunciones</option>
              <option value="unclassified">Sin Clasificar (Folios sueltos)</option>
            </select>
          </div>

          {/* 2. Tomo / Libro */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">
              Tomo / Libro
            </label>
            <select
              value={selectedFolderId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedFolderId(val);
                setPage(1);
                if (val && val !== "unclassified") {
                  const foundTome = availableTomes.find((t) => t.id === val);
                  if (foundTome) {
                    setSelectedTomeForExport(foundTome);
                  }
                }
              }}
              className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="">Todos los tomos</option>
              {filteredTomes.map((tome) => (
                <option key={tome.id} value={tome.id}>
                  {tome.name}
                </option>
              ))}
              <option value="unclassified">Sin Clasificar</option>
            </select>
          </div>

          {/* 3. Estado */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">
              Estado
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="all">Todos los estados</option>
              <option value="completed">Completado</option>
              <option value="verified">Verificado</option>
              <option value="pending">Pendiente</option>
              <option value="revision">Dudoso / En Revisión</option>
              <option value="in_progress">En Progreso</option>
            </select>
          </div>

          {/* 4. Búsqueda Integral */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">
              Búsqueda Integral
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Persona, padres, acta, F.14r, archivo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* 5. Date Range: From */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">
              DESDE (FECHA ACTA)
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

          {/* 6. Date Range: To */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">
              HASTA (FECHA ACTA)
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
        {(selectedSeries || selectedFolderId || selectedStatus !== "all" || selectedBatch || searchTerm || startDate || endDate) && (
          <div className="flex justify-end pt-2 border-t border-gray-100">
            <button
              onClick={() => {
                setSelectedSeries("");
                setSelectedFolderId("");
                setSelectedStatus("all");
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
                <th className="px-4 py-3">Acta / Partida</th>
                <th className="px-4 py-3">Folio Físico</th>
                <th className="px-4 py-3">Persona Principal</th>
                <th className="px-4 py-3">Fecha Acta</th>
                <th className="px-4 py-3">Tomo / Libro</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-2"></div>
                    <p>Cargando registros...</p>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="font-medium text-gray-700">No se encontraron registros</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Intenta ajustar la serie, el tomo, el estado o los términos de búsqueda.
                    </p>
                  </td>
                </tr>
              ) : (
                records.map((rec) => {
                  const folioNum = rec.folio_number || 1;
                  const folioSideChar =
                    rec.folio_side === "vuelto"
                      ? "v"
                      : rec.folio_side === "unica"
                      ? "u"
                      : "r";
                  const totalEntries = rec.total_entries_in_folio || 1;
                  const entryNum = rec.entry_number || 1;
                  const isBlank = Boolean(rec.is_blank || rec.metadata?.is_blank);
                  const rawPerson =
                    rec.principal_person ||
                    rec.person_name ||
                    rec.metadata?.nombre_bautizado ||
                    rec.metadata?.nombre_difunto ||
                    rec.metadata?.nombre_contrayente_1 ||
                    rec.metadata?.nombre ||
                    "";
                  const isPendingWithoutName =
                    (rec.status === "pending" || rec.status === "in_progress") &&
                    (!rawPerson ||
                      rawPerson.includes("Pendiente") ||
                      rawPerson === "Sin titular registrado" ||
                      rawPerson === "—");
                  const canonicalCode =
                    rec.canonical_filename || rec.original_filename || rec.file_name || "";

                  return (
                    <tr key={`${rec.id}-${entryNum}`} className="hover:bg-gray-50 transition">
                      {/* Columna 1 — ACTA / PARTIDA */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          <span className="font-semibold text-gray-900">
                            {rec.act_number && rec.act_number !== "—"
                              ? `Acta ${rec.act_number}`
                              : "Sin N° Acta"}
                          </span>
                          {totalEntries > 1 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              Partida {entryNum} de {totalEntries}
                            </span>
                          )}
                          {rec.is_continued && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                              ↪ Continúa de folio anterior
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Columna 2 — FOLIO FÍSICO */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          F.{folioNum}{folioSideChar}
                        </span>
                      </td>

                      {/* Columna 3 — PERSONA PRINCIPAL */}
                      <td className="px-4 py-3 max-w-[260px]">
                        {isBlank ? (
                          <div className="flex flex-col items-start gap-0.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              📄 Folio en Blanco / Sin Partidas
                            </span>
                            {canonicalCode && (
                              <span className="text-[11px] font-mono text-gray-400 truncate max-w-full">
                                {canonicalCode}
                              </span>
                            )}
                          </div>
                        ) : isPendingWithoutName ? (
                          <div className="flex flex-col items-start gap-0.5">
                            <span className="text-xs italic text-amber-700 font-medium">
                              ⏳ Pendiente de transcripción
                            </span>
                            {canonicalCode && (
                              <span className="text-[11px] font-mono text-gray-400 truncate max-w-full">
                                {canonicalCode}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-start gap-0.5">
                            <span
                              className="font-bold text-gray-900 truncate max-w-full"
                              title={String(rawPerson || "Sin titular registrado")}
                            >
                              {rawPerson || "Sin titular registrado"}
                            </span>
                            <div className="flex items-center gap-1.5 text-[11px] text-gray-400 truncate max-w-full">
                              {rec.record_type && (
                                <span className="font-medium text-gray-500">
                                  {rec.record_type}
                                </span>
                              )}
                              {rec.record_type && canonicalCode && <span>•</span>}
                              {canonicalCode && (
                                <span className="font-mono truncate">{canonicalCode}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Columna 4 — FECHA ACTA */}
                      <td className="px-4 py-3 text-gray-700 text-xs whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">
                            {formatHistoricalDate(rec.event_date)}
                          </span>
                          {rec.birth_date && rec.birth_date !== "—" && (
                            <span className="text-[11px] text-gray-400">
                              Nac: {formatHistoricalDate(rec.birth_date)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Columna 5 — TOMO / LIBRO */}
                      <td
                        className="px-4 py-3 text-gray-600 text-xs max-w-[180px] truncate"
                        title={rec.tome_name || "Sin Clasificar"}
                      >
                        {rec.tome_name && rec.tome_name !== "Sin Clasificar" ? (
                          <span className="font-medium text-gray-800">{rec.tome_name}</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600">
                            Sin Clasificar
                          </span>
                        )}
                      </td>

                      {/* Columna 6 — ESTADO */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {rec.status === "verified" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Verificado
                          </span>
                        ) : rec.status === "completed" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Completado
                          </span>
                        ) : rec.status === "revision" ? (
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800"
                              title={rec.review_notes || rec.metadata?.review_notes || undefined}
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Dudoso / Revisión
                            </span>
                            {Boolean(
                              rec.escalated_to_archivist || rec.metadata?.escalated_to_archivist
                            ) && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-900 border border-orange-300"
                                title={
                                  rec.review_notes ||
                                  rec.metadata?.review_notes ||
                                  "Escalado al Archivista por el Evaluador de Calidad"
                                }
                              >
                                🔔 Escalado al Archivista
                              </span>
                            )}
                          </div>
                        ) : rec.status === "in_progress" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800">
                            <Play className="w-3 h-3 fill-current" />
                            En Progreso
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                            <Clock className="w-3.5 h-3.5" />
                            Pendiente
                          </span>
                        )}
                      </td>

                      {/* Columna 7 — ACCIONES CONTEXTUALES */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {rec.status === "pending" ||
                          rec.status === "revision" ||
                          rec.status === "in_progress" ? (
                            <>
                              <button
                                onClick={() =>
                                  router.push(
                                    `/${subdomain}/visor?folio_id=${rec.folio_id || rec.id}`
                                  )
                                }
                                title="Transcribir en Visor de Indexación"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                Transcribir
                              </button>
                              <button
                                onClick={() => handleOpenDetail(rec)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-medium transition cursor-pointer"
                                title="Ver detalle o arbitrar estado"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Detalle
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleOpenDetail(rec)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer"
                                title="Ver detalle y arbitrar calidad"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Detalle
                              </button>
                              <button
                                onClick={() =>
                                  router.push(
                                    `/${subdomain}/visor?folio_id=${rec.folio_id || rec.id}`
                                  )
                                }
                                title="Abrir en Visor de Indexación"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition cursor-pointer"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                Visor
                              </button>
                            </>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setRecordToDelete(rec)}
                              title="Eliminar registro"
                              className="inline-flex items-center justify-center p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
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
                <option value={100}>100</option>
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

      {/* Modal Split Screen: Detalle, Carga Bajo Demanda & Arbitraje de Calidad */}
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
                      F.{selectedRecord.folio_number || 1}
                      {selectedRecord.folio_side === "vuelto"
                        ? "v"
                        : selectedRecord.folio_side === "unica"
                        ? "u"
                        : "r"}
                    </span>
                    {selectedRecord.status === "verified" ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-950 text-indigo-300 border border-indigo-800">
                        Verificado
                      </span>
                    ) : selectedRecord.status === "completed" ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-green-950 text-green-400 border border-green-800">
                        Completado
                      </span>
                    ) : selectedRecord.status === "revision" ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-orange-950 text-orange-300 border border-orange-800">
                        Dudoso / Revisión
                      </span>
                    ) : selectedRecord.status === "in_progress" ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-sky-950 text-sky-300 border border-sky-800">
                        En Progreso
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-amber-950 text-amber-300 border border-amber-800">
                        Pendiente
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-gray-400">
                    Archivo:{" "}
                    {selectedRecord.canonical_filename ||
                      selectedRecord.file_name ||
                      selectedRecord.r2_url ||
                      "Desconocido"}
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

                  <span className="h-4 w-px bg-gray-700 mx-0.5" />

                  {/* Lupa Interactiva */}
                  <button
                    type="button"
                    onClick={toggleMagnifier}
                    className={`px-2 py-1 flex items-center gap-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                      magnifier.active ? "bg-blue-600 text-white shadow-sm" : "hover:bg-gray-800 text-gray-200"
                    }`}
                    title="Lupa Interactiva (L)"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Lupa</span>
                  </button>

                  {/* Popover de Filtros */}
                  <FilterControlsPopover
                    filters={filters}
                    updateFilter={updateFilter}
                    resetFilters={resetFilters}
                    toggleInvert={toggleInvert}
                    toggleGrayscale={toggleGrayscale}
                    toggleBinarized={toggleBinarized}
                  />
                </div>

                {/* Image Canvas Container */}
                <div
                  className="flex-1 w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseLeave}
                  onWheel={handleWheel}
                >
                  {loadingModalImage ? (
                    <div className="text-center text-gray-400 p-8">
                      <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-2" />
                      <p className="text-sm">Cargando imagen del folio desde Cloudflare R2...</p>
                    </div>
                  ) : selectedRecord.view_url ? (
                    <>
                      <img
                        ref={modalImgRef}
                        src={selectedRecord.view_url}
                        alt="Folio visualizado"
                        style={{
                          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                          cursor: magnifier.active ? "crosshair" : isDragging ? "grabbing" : "grab",
                          transition: isDragging ? "none" : "transform 0.1s ease-out",
                          maxHeight: "85%",
                          maxWidth: "85%",
                          objectFit: "contain",
                          filter: filterString,
                        }}
                        draggable={false}
                        className="shadow-2xl rounded-xs pointer-events-none"
                      />

                      <MagnifierLens
                        imageSrc={selectedRecord.view_url}
                        imgRef={modalImgRef}
                        magnifier={magnifier}
                        filterString={filterString}
                        imageRect={modalImageRect}
                        rotation={rotation}
                      />
                    </>
                  ) : (
                    <div className="text-center text-gray-500 p-8">
                      <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto mb-2" />
                      <p className="text-sm">No se pudo cargar la vista previa de la imagen.</p>
                      <p className="text-xs text-gray-600 mt-1">El archivo podría no estar disponible en Storage.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Quality Arbitration & Record Edit Form */}
              <div className="w-full md:w-[480px] bg-gray-900 flex flex-col justify-between overflow-hidden">
                <form onSubmit={handleSaveChanges} className="flex-1 flex flex-col justify-between overflow-hidden">
                  <div className="flex-1 p-6 overflow-y-auto space-y-5">
                    {/* Quality Arbitration Bar */}
                    {canArbitrate && (
                      <div className="p-3.5 bg-gray-950 border border-gray-800 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                            Control de Calidad / Arbitraje
                          </span>
                          {updatingStatus && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-blue-400">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Actualizando...
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            disabled={Boolean(updatingStatus) || saving}
                            onClick={() => handleArbitrateStatus("verified")}
                            className="inline-flex items-center justify-center gap-1 px-2.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                            <span>✔ Verificar Acta</span>
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(updatingStatus) || saving}
                            onClick={() => handleArbitrateStatus("revision")}
                            className="inline-flex items-center justify-center gap-1 px-2.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>⚠ Enviar a Dudoso</span>
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(updatingStatus) || saving}
                            onClick={() => handleArbitrateStatus("pending")}
                            className="inline-flex items-center justify-center gap-1 px-2.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-lg text-xs font-medium transition cursor-pointer disabled:opacity-50"
                          >
                            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                            <span>↩ Devolver a Pendiente</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Nota de Revisión / Escalamiento del Evaluador */}
                    {(selectedRecord.review_notes ||
                      selectedRecord.metadata?.review_notes ||
                      selectedRecord.escalated_to_archivist ||
                      selectedRecord.metadata?.escalated_to_archivist) && (
                      <div className="p-3 bg-orange-950/60 border border-orange-800/80 rounded-xl text-xs text-orange-200 space-y-1">
                        <div className="font-bold flex items-center gap-2 text-orange-300">
                          <span>
                            {selectedRecord.escalated_to_archivist ||
                            selectedRecord.metadata?.escalated_to_archivist
                              ? "🔔 Escalado al Archivista"
                              : "⚠️ Nota de Control de Calidad"}
                          </span>
                          {(selectedRecord.escalated_by ||
                            selectedRecord.metadata?.escalated_by) && (
                            <span className="text-[10px] font-normal text-orange-400">
                              por{" "}
                              {selectedRecord.escalated_by ||
                                selectedRecord.metadata?.escalated_by}
                            </span>
                          )}
                        </div>
                        {(selectedRecord.review_notes ||
                          selectedRecord.metadata?.review_notes) && (
                          <p className="italic">
                            &ldquo;
                            {selectedRecord.review_notes ||
                              selectedRecord.metadata?.review_notes}
                            &rdquo;
                          </p>
                        )}
                      </div>
                    )}

                    {/* Status Alert if in_progress */}
                    {selectedRecord.status === "in_progress" && (
                      <div className="p-3 bg-yellow-950/80 border border-yellow-800/80 rounded-xl space-y-3 text-yellow-200 text-xs">
                        <div className="flex items-start gap-2.5">
                          <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                          <div>
                            <strong className="block font-semibold">Documento bloqueado</strong>
                            Este folio está actualmente en proceso de indexación. Las modificaciones están deshabilitadas
                            hasta que sea completado.
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1 border-t border-yellow-800/60">
                          <button
                            type="button"
                            onClick={() => {
                              router.push(`/${subdomain}/visor?folio_id=${selectedRecord.folio_id || selectedRecord.id}`);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 hover:bg-yellow-400 text-gray-950 font-semibold rounded-lg text-xs transition cursor-pointer shadow-xs"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            Abrir en Visor de Indexación
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReleaseFolio(selectedRecord.folio_id || selectedRecord.id)}
                            disabled={releasingId === (selectedRecord.folio_id || selectedRecord.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium rounded-lg text-xs transition cursor-pointer border border-gray-700 disabled:opacity-50"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            {releasingId === (selectedRecord.folio_id || selectedRecord.id)
                              ? "Liberando..."
                              : "Liberar folio a la cola"}
                          </button>
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
                  <div className="p-4 bg-gray-950 border-t border-gray-800 flex items-center justify-between gap-3">
                    {canDelete ? (
                      <button
                        type="button"
                        onClick={() => setRecordToDelete(selectedRecord)}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-950/80 hover:bg-red-900 border border-red-800/80 text-red-300 rounded-lg text-xs font-medium transition cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        Eliminar Registro
                      </button>
                    ) : (
                      <div />
                    )}
                    <div className="flex items-center gap-3">
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
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 animate-fade-in backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-full bg-red-100 text-red-600 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-gray-900">
                  ¿Eliminar este registro?
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  ¿Estás seguro de que deseas eliminar permanentemente el folio con archivo{" "}
                  <strong className="text-gray-900">
                    {recordToDelete.canonical_filename || recordToDelete.file_name || recordToDelete.id.slice(0, 8)}
                  </strong>
                  ? Esta acción borrará sus metadatos indexados y no se puede deshacer.
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRecordToDelete(null);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Sí, Eliminar Registro</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Exportación FamilySearch (DIP) */}
      <ExportFamilySearchModal
        isOpen={isFamilySearchModalOpen}
        onClose={() => setIsFamilySearchModalOpen(false)}
        folder={selectedTomeForExport}
        authToken={authToken}
      />
    </div>
  );
}


