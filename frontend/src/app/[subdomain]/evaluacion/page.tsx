"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { useTenant } from "@/context/TenantContext";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Bell,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  ListFilter,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  UserCheck,
  MapPin,
  BookOpen,
  FileText,
  Sparkles,
  CheckSquare,
  Loader2,
} from "lucide-react";
import { useImageViewerFilters } from "../../../hooks/useImageViewerFilters";
import { MagnifierLens } from "../../../components/viewer/MagnifierLens";
import { FilterControlsPopover } from "../../../components/viewer/FilterControlsPopover";
import { DocumentFolder } from "@/components/folders/types";

interface EvaluationCounts {
  to_verify: number;
  doubtful: number;
  escalated_to_archivist: number;
  verified_today: number;
  total_verified: number;
}

interface EntrySummary {
  id: string;
  entry_number: number;
  act_number: string;
  principal_person: string;
  event_date: string;
  record_type: string;
  status: string;
}

interface QueueFolioItem {
  id: string;
  canonical_filename: string;
  original_filename?: string;
  status: string;
  folder_id?: string | null;
  tome_name: string;
  series: string;
  folio_number: number;
  folio_side: string;
  sequence_order: number;
  entries_count: number;
  entries_summary: EntrySummary[];
  digitized_by: string;
  digitized_at?: string;
  verified_by?: string;
  verified_at?: string;
  review_notes: string;
  escalated_to_archivist: boolean;
  escalated_by?: string;
  escalated_at?: string;
  updated_at?: string;
  created_at?: string;
}

interface EvaluationEntry {
  id?: string;
  folio_id?: string;
  entry_number: number;
  folio_number: number | null;
  folio_side: "recto" | "vuelto" | "unica" | string;
  act_number: string | null;
  is_continued?: boolean;
  continued_from_entry_id?: string | null;
  status: string;
  metadata: Record<string, any>;
  bounding_box?: Record<string, any> | null;
}

const SYSTEM_META_KEYS = new Set([
  "digitized_by",
  "digitized_at",
  "verified_by",
  "verified_at",
  "review_notes",
  "priority_returned",
  "returned_by",
  "returned_at",
  "escalated_to_archivist",
  "escalated_by",
  "escalated_at",
  "evaluation_locked_at",
  "evaluation_locked_by",
  "is_blank",
  "data",
]);

function inferFolderSeries(folder: DocumentFolder, parentSeries?: string): string {
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

/**
 * Resuelve el valor canónico de un campo mediante sinónimos bidireccionales
 * para compatibilidad entre plantillas y datos transcritos (ej. singular <-> plural).
 */
export function resolveFieldValue(key: string, data: Record<string, any>): string {
  if (!data) return "";
  const val = data[key];
  if (val !== undefined && val !== null && String(val).trim() !== "") {
    return String(val);
  }

  switch (key) {
    case "abuelo_paterno": {
      if (data.abuelos_paternos) {
        const parts = String(data.abuelos_paternos).split(/\s+y\s+|\s+e\s+|,\s*/i);
        return parts[0]?.trim() || String(data.abuelos_paternos).trim();
      }
      return "";
    }
    case "abuela_paterna": {
      if (data.abuelos_paternos) {
        const parts = String(data.abuelos_paternos).split(/\s+y\s+|\s+e\s+|,\s*/i);
        return parts.length >= 2 ? parts.slice(1).join(" y ").trim() : "";
      }
      return "";
    }
    case "abuelos_paternos": {
      return [data.abuelo_paterno, data.abuela_paterna].filter(Boolean).join(" y ");
    }
    case "abuelo_materno": {
      if (data.abuelos_maternos) {
        const parts = String(data.abuelos_maternos).split(/\s+y\s+|\s+e\s+|,\s*/i);
        return parts[0]?.trim() || String(data.abuelos_maternos).trim();
      }
      return "";
    }
    case "abuela_materna": {
      if (data.abuelos_maternos) {
        const parts = String(data.abuelos_maternos).split(/\s+y\s+|\s+e\s+|,\s*/i);
        return parts.length >= 2 ? parts.slice(1).join(" y ").trim() : "";
      }
      return "";
    }
    case "abuelos_maternos": {
      return [data.abuelo_materno, data.abuela_materna].filter(Boolean).join(" y ");
    }
    case "padrino": {
      if (data.padrinos) {
        const parts = String(data.padrinos).split(/\s+y\s+|\s+e\s+|,\s*/i);
        return parts[0]?.trim() || String(data.padrinos).trim();
      }
      return "";
    }
    case "madrina": {
      if (data.padrinos) {
        const parts = String(data.padrinos).split(/\s+y\s+|\s+e\s+|,\s*/i);
        return parts.length >= 2 ? parts.slice(1).join(" y ").trim() : "";
      }
      return "";
    }
    case "padrinos": {
      return [data.padrino, data.madrina].filter(Boolean).join(" y ");
    }
    case "nombre_padre":
      return data.padre ? String(data.padre) : "";
    case "padre":
      return data.nombre_padre ? String(data.nombre_padre) : "";
    case "nombre_madre":
      return data.madre ? String(data.madre) : "";
    case "madre":
      return data.nombre_madre ? String(data.nombre_madre) : "";
    case "nombres":
      return (
        data.bautizado ||
        data.difunto ||
        data.novio_nombres ||
        data.persona_principal ||
        data.nombre ||
        ""
      );
    case "apellidos":
      return data.apellido || "";
    case "bautizado":
    case "difunto": {
      const full = [data.nombres, data.apellidos].filter(Boolean).join(" ").trim();
      return (
        full ||
        data.bautizado ||
        data.difunto ||
        data.novio_nombres ||
        data.persona_principal ||
        data.nombre ||
        ""
      );
    }
    case "novio_nombres":
      return data.nombres || data.bautizado || data.persona_principal || "";
    case "fecha_sacramento":
      return (
        data.fecha_bautismo ||
        data.fecha_matrimonio ||
        data.fecha_defuncion ||
        data.fecha_acta ||
        ""
      );
    case "fecha_bautismo":
    case "fecha_matrimonio":
    case "fecha_defuncion":
      return data.fecha_sacramento || data.fecha_acta || "";
    case "fecha_acta":
      return (
        data.fecha_sacramento ||
        data.fecha_bautismo ||
        data.fecha_matrimonio ||
        data.fecha_defuncion ||
        ""
      );
    default:
      return "";
  }
}

export default function EvaluacionDeskPage() {
  const params = useParams() as { subdomain: string };
  const subdomain = params.subdomain;
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFolioId = searchParams.get("folio_id");

  const supabase = getSupabaseBrowserClient();
  const { session: tenantSession, role: tenantRole } = useTenant();

  // Control Bar States
  const [queueType, setQueueType] = useState<"to_verify" | "doubtful" | "verified" | "all">("to_verify");
  const [series, setSeries] = useState<string>("");
  const [folderId, setFolderId] = useState<string>("");
  const [viewMode, setViewMode] = useState<"desk" | "list">("desk");
  const [availableTomes, setAvailableTomes] = useState<DocumentFolder[]>([]);

  // Live Counters
  const [counts, setCounts] = useState<EvaluationCounts>({
    to_verify: 0,
    doubtful: 0,
    escalated_to_archivist: 0,
    verified_today: 0,
    total_verified: 0,
  });

  // List Mode States
  const [queueItems, setQueueItems] = useState<QueueFolioItem[]>([]);
  const [loadingQueue, setLoadingQueue] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);

  // Desk Mode States
  const [folio, setFolio] = useState<any>(null);
  const [loadingDesk, setLoadingDesk] = useState<boolean>(true);
  const [entries, setEntries] = useState<EvaluationEntry[]>([]);
  const [originalEntriesMap, setOriginalEntriesMap] = useState<Record<number, Record<string, any>>>({});
  const [activeEntryIndex, setActiveEntryIndex] = useState<number>(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [modifiedFieldsByEntry, setModifiedFieldsByEntry] = useState<Record<number, Set<string>>>({});
  const [reviewNotes, setReviewNotes] = useState<string>("");
  const [submittingVerdict, setSubmittingVerdict] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "warning" | "info" } | null>(null);

  const reviewNotesRef = useRef<HTMLTextAreaElement>(null);

  // Image Viewer States
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [imageRect, setImageRect] = useState<DOMRect | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

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

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 3500);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // Reset viewer on folio change
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
    setMagnifier((m) => ({ ...m, active: false, visible: false }));
  }, [folio?.id, setMagnifier]);

  // Fetch folders / tomes y queue counts en paralelo (T03-F2-05)
  useEffect(() => {
    async function loadInitialData() {
      const activeSession = tenantSession || (await supabase.auth.getSession()).data.session;
      if (!activeSession) return;

      try {
        const [treeRes, queueRes] = await Promise.all([
          fetch("/api/v1/folders/tree", {
            headers: { Authorization: `Bearer ${activeSession.access_token}` },
          }),
          fetch(`/api/v1/evaluation/queue?queue_type=${queueType}&page=1&page_size=20`, {
            headers: { Authorization: `Bearer ${activeSession.access_token}` },
          }),
        ]);

        if (treeRes.ok) {
          const json = await treeRes.json();
          const treeData: DocumentFolder[] = json.data || [];
          const tomes: DocumentFolder[] = [];
          const traverse = (nodes: DocumentFolder[], inheritedSeries?: string) => {
            for (const n of nodes) {
              const curSeries =
                n.folder_type === "series" ? inferFolderSeries(n, inheritedSeries) : inheritedSeries;
              if (n.folder_type === "tome" && !n.metadata?.is_virtual_unclassified) {
                const resolvedSeries = inferFolderSeries(n, curSeries);
                tomes.push({
                  ...n,
                  metadata: {
                    ...(n.metadata || {}),
                    series: n.metadata?.series || resolvedSeries,
                  },
                });
              }
              if (n.children && n.children.length > 0) {
                traverse(n.children, curSeries);
              }
            }
          };
          traverse(treeData);
          setAvailableTomes(tomes);
        }

        if (queueRes.ok) {
          const qJson = await queueRes.json();
          if (qJson.counts) {
            setCounts(qJson.counts);
          }
          setQueueItems(qJson.items || qJson.data || []);
          setTotalItems(qJson.total || 0);
          setTotalPages(qJson.total_pages || 1);
        }
      } catch (err) {
        console.error("Error loading initial evaluation data concurrently:", err);
      }
    }
    loadInitialData();
  }, [tenantSession, supabase]);

  const filteredTomes = React.useMemo(() => {
    if (!series || series === "unclassified") {
      return series === "unclassified" ? [] : availableTomes;
    }
    return availableTomes.filter((t) => inferFolderSeries(t) === series);
  }, [availableTomes, series]);

  // Extract clean editable metadata from an entry
  const extractEntryEditableMeta = useCallback((entry: any, fallbackMeta?: any): Record<string, any> => {
    const raw = (entry?.metadata && typeof entry.metadata === "object" ? entry.metadata : fallbackMeta) || {};
    const inner = raw.data && typeof raw.data === "object" ? raw.data : {};
    const merged = { ...raw, ...inner };
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(merged)) {
      if (SYSTEM_META_KEYS.has(k)) continue;
      if (v !== null && typeof v === "object") continue;
      clean[k] = v ?? "";
    }

    // Normalización y sinónimos canónicos bidireccionales

    // 1. Abuelos paternos: abuelos_paternos <-> abuelo_paterno / abuela_paterna
    if (clean.abuelos_paternos && String(clean.abuelos_paternos).trim() !== "") {
      const pStr = String(clean.abuelos_paternos).trim();
      if (!clean.abuelo_paterno && !clean.abuela_paterna) {
        const parts = pStr.split(/\s+y\s+|\s+e\s+|,\s*/i);
        clean.abuelo_paterno = parts[0]?.trim() || pStr;
        if (parts.length >= 2) {
          clean.abuela_paterna = parts.slice(1).join(" y ").trim();
        }
      }
    } else if (clean.abuelo_paterno || clean.abuela_paterna) {
      const combined = [clean.abuelo_paterno, clean.abuela_paterna].filter(Boolean).join(" y ");
      if (combined && !clean.abuelos_paternos) clean.abuelos_paternos = combined;
    }

    // 2. Abuelos maternos: abuelos_maternos <-> abuelo_materno / abuela_materna
    if (clean.abuelos_maternos && String(clean.abuelos_maternos).trim() !== "") {
      const mStr = String(clean.abuelos_maternos).trim();
      if (!clean.abuelo_materno && !clean.abuela_materna) {
        const parts = mStr.split(/\s+y\s+|\s+e\s+|,\s*/i);
        clean.abuelo_materno = parts[0]?.trim() || mStr;
        if (parts.length >= 2) {
          clean.abuela_materna = parts.slice(1).join(" y ").trim();
        }
      }
    } else if (clean.abuelo_materno || clean.abuela_materna) {
      const combined = [clean.abuelo_materno, clean.abuela_materna].filter(Boolean).join(" y ");
      if (combined && !clean.abuelos_maternos) clean.abuelos_maternos = combined;
    }

    // 3. Padrinos: padrinos <-> padrino / madrina
    if (clean.padrinos && String(clean.padrinos).trim() !== "") {
      const padStr = String(clean.padrinos).trim();
      if (!clean.padrino && !clean.madrina) {
        const parts = padStr.split(/\s+y\s+|\s+e\s+|,\s*/i);
        clean.padrino = parts[0]?.trim() || padStr;
        if (parts.length >= 2) {
          clean.madrina = parts.slice(1).join(" y ").trim();
        }
      }
    } else if (clean.padrino || clean.madrina) {
      const combined = [clean.padrino, clean.madrina].filter(Boolean).join(" y ");
      if (combined && !clean.padrinos) clean.padrinos = combined;
    }

    // 4. Padres: nombre_padre <-> padre, nombre_madre <-> madre
    if (clean.padre && !clean.nombre_padre) clean.nombre_padre = clean.padre;
    if (clean.nombre_padre && !clean.padre) clean.padre = clean.nombre_padre;
    if (clean.madre && !clean.nombre_madre) clean.nombre_madre = clean.madre;
    if (clean.nombre_madre && !clean.madre) clean.madre = clean.nombre_madre;

    // 5. Sujetos: nombres + apellidos <-> bautizado / difunto / novio_nombres
    const personaPrincipal =
      clean.bautizado ||
      clean.difunto ||
      clean.novio_nombres ||
      clean.persona_principal ||
      "";
    if (personaPrincipal && !clean.nombres && !clean.apellidos) {
      clean.nombres = personaPrincipal;
    }
    if (clean.nombres || clean.apellidos) {
      const full = [clean.nombres, clean.apellidos].filter(Boolean).join(" ").trim();
      if (full) {
        if (!clean.bautizado) clean.bautizado = full;
        if (!clean.difunto) clean.difunto = full;
      }
    }

    // 6. Fechas: fecha_sacramento <-> fecha_bautismo, fecha_matrimonio, fecha_defuncion, fecha_acta
    const fechaEvento =
      clean.fecha_sacramento ||
      clean.fecha_bautismo ||
      clean.fecha_matrimonio ||
      clean.fecha_defuncion ||
      clean.fecha_acta ||
      "";
    if (fechaEvento) {
      if (!clean.fecha_sacramento) clean.fecha_sacramento = fechaEvento;
      if (!clean.fecha_bautismo) clean.fecha_bautismo = fechaEvento;
      if (!clean.fecha_matrimonio) clean.fecha_matrimonio = fechaEvento;
      if (!clean.fecha_defuncion) clean.fecha_defuncion = fechaEvento;
      if (!clean.fecha_acta) clean.fecha_acta = fechaEvento;
    }

    return clean;
  }, []);

  // Fetch queue list and live counters
  const fetchQueueAndCounts = useCallback(async () => {
    setLoadingQueue(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const qParams = new URLSearchParams();
      qParams.set("queue_type", queueType);
      if (series) qParams.set("series", series);
      if (folderId) qParams.set("folder_id", folderId);
      qParams.set("page", String(page));
      qParams.set("page_size", "20");

      const res = await fetch(`/api/v1/evaluation/queue?${qParams.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.counts) {
          setCounts(json.counts);
        }
        setQueueItems(json.items || json.data || []);
        setTotalItems(json.total || 0);
        setTotalPages(json.total_pages || 1);
      }
    } catch (err) {
      console.error("Error fetching evaluation queue:", err);
    } finally {
      setLoadingQueue(false);
    }
  }, [queueType, series, folderId, page]);

  // Load next folio in Desk mode (or specific folio)
  const loadNextFolio = useCallback(
    async (specificFolioId?: string) => {
      setLoadingDesk(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const payload: Record<string, any> = {
          queue_type: queueType === "doubtful" ? "doubtful" : "to_verify",
        };
        if (series) payload.series = series;
        if (folderId) payload.folder_id = folderId;
        if (specificFolioId) payload.specific_folio_id = specificFolioId;

        const res = await fetch("/api/v1/evaluation/get_next", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(payload),
        });

        const json = await res.json();
        if (res.ok && json.status === "success" && json.data) {
          const fData = json.data;
          setFolio(fData);

          const rawEntries: any[] = Array.isArray(fData.entries) && fData.entries.length > 0
            ? fData.entries
            : [
                {
                  id: `synthetic-${fData.id}-1`,
                  entry_number: 1,
                  folio_number: fData.metadata?.folio_number || fData.sequence_order || 1,
                  folio_side: fData.metadata?.folio_side || "recto",
                  act_number: fData.metadata?.numero_acta || fData.metadata?.act_number || "",
                  is_continued: false,
                  status: fData.status || "completed",
                  metadata: fData.metadata || {},
                },
              ];

          const origMap: Record<number, Record<string, any>> = {};
          const normalizedEntries: EvaluationEntry[] = rawEntries.map((e, i) => {
            const eNum = Number(e.entry_number || i + 1);
            const cleanMeta = extractEntryEditableMeta(e, fData.metadata);
            origMap[eNum] = { ...cleanMeta };
            return {
              id: e.id,
              folio_id: fData.id,
              entry_number: eNum,
              folio_number:
                e.folio_number !== undefined && e.folio_number !== null
                  ? Number(e.folio_number)
                  : Number(fData.metadata?.folio_number || fData.sequence_order || 1),
              folio_side: e.folio_side || fData.metadata?.folio_side || "recto",
              act_number:
                e.act_number !== undefined && e.act_number !== null
                  ? String(e.act_number)
                  : String(cleanMeta.numero_acta || cleanMeta.act_number || ""),
              is_continued: Boolean(e.is_continued),
              continued_from_entry_id: e.continued_from_entry_id || null,
              status: e.status || fData.status || "completed",
              metadata: cleanMeta,
              bounding_box: e.bounding_box || null,
            };
          });

          setOriginalEntriesMap(origMap);
          setEntries(normalizedEntries);
          setActiveEntryIndex(0);
          setFormData({ ...(normalizedEntries[0]?.metadata || {}) });
          setModifiedFieldsByEntry({});
          setReviewNotes(fData.review_notes || fData.metadata?.review_notes || "");
        } else {
          setFolio(null);
          setEntries([]);
          setFormData({});
        }
      } catch (err) {
        console.error("Error loading next evaluation folio:", err);
        setFolio(null);
      } finally {
        setLoadingDesk(false);
        fetchQueueAndCounts();
      }
    },
    [queueType, series, folderId, extractEntryEditableMeta, fetchQueueAndCounts]
  );

  // Initial load
  const initialLoadedRef = useRef(false);
  useEffect(() => {
    if (!initialLoadedRef.current) {
      initialLoadedRef.current = true;
      if (initialFolioId) {
        setViewMode("desk");
        loadNextFolio(initialFolioId);
      } else {
        loadNextFolio();
      }
    }
  }, [initialFolioId, loadNextFolio]);

  // Reload queue when filters or page change
  useEffect(() => {
    fetchQueueAndCounts();
  }, [fetchQueueAndCounts]);

  // Switch active entry tab
  const handleSwitchEntry = useCallback(
    (newIdx: number) => {
      if (newIdx === activeEntryIndex || newIdx < 0 || newIdx >= entries.length) return;
      setEntries((prev) => {
        const next = [...prev];
        if (next[activeEntryIndex]) {
          next[activeEntryIndex] = {
            ...next[activeEntryIndex],
            metadata: { ...formData },
          };
        }
        return next;
      });
      setActiveEntryIndex(newIdx);
      setFormData({ ...(entries[newIdx]?.metadata || {}) });
    },
    [activeEntryIndex, entries, formData]
  );

  const activeEntry = entries[activeEntryIndex];
  const activeEntryNum = activeEntry?.entry_number || activeEntryIndex + 1;

  // Handle field edit
  const handleFieldChange = (fieldKey: string, val: string) => {
    setFormData((prev) => ({ ...prev, [fieldKey]: val }));
    const origRaw = originalEntriesMap[activeEntryNum]?.[fieldKey];
    const origResolved =
      origRaw !== undefined && origRaw !== ""
        ? origRaw
        : resolveFieldValue(fieldKey, originalEntriesMap[activeEntryNum] || {});
    const origVal = String(origResolved ?? "").trim();
    const newVal = String(val ?? "").trim();

    setModifiedFieldsByEntry((prev) => {
      const currentSet = new Set(prev[activeEntryNum] || []);
      if (origVal !== newVal) {
        currentSet.add(fieldKey);
      } else {
        currentSet.delete(fieldKey);
      }
      return { ...prev, [activeEntryNum]: currentSet };
    });
  };

  const updateActiveEntryArchivalField = (updates: Partial<EvaluationEntry>) => {
    setEntries((prev) => {
      const next = [...prev];
      if (next[activeEntryIndex]) {
        next[activeEntryIndex] = {
          ...next[activeEntryIndex],
          ...updates,
        };
      }
      return next;
    });
  };

  // Build entries payload synced with current formData
  const getSyncedEntriesPayload = useCallback(() => {
    return entries.map((e, idx) => {
      const syncedMeta = idx === activeEntryIndex ? { ...formData } : { ...e.metadata };
      return {
        entry_number: e.entry_number,
        metadata: syncedMeta,
        status: e.status,
        bounding_box: e.bounding_box || null,
        folio_number: e.folio_number,
        folio_side: e.folio_side || "recto",
        act_number: e.act_number || null,
        is_continued: Boolean(e.is_continued),
        continued_from_entry_id: e.continued_from_entry_id || null,
      };
    });
  }, [entries, activeEntryIndex, formData]);

  // Submit Verdict
  const submitVerdict = useCallback(
    async (
      verdictType: "verify_all" | "verify_entry" | "return_to_digitizer" | "mark_doubtful"
    ) => {
      if (!folio || submittingVerdict) return;

      if (verdictType === "return_to_digitizer" && !reviewNotes.trim()) {
        setToastMsg({
          text: "Escribe una nota explicando el motivo de devolución al Digitador.",
          type: "warning",
        });
        reviewNotesRef.current?.focus();
        return;
      }

      setSubmittingVerdict(verdictType);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const syncedEntries = getSyncedEntriesPayload();
        const bodyPayload: Record<string, any> = {
          verdict: verdictType,
          entry_id: activeEntry?.id,
          entry_number: activeEntry?.entry_number || 1,
          entries: syncedEntries,
          review_notes: reviewNotes.trim(),
        };

        const res = await fetch(`/api/v1/evaluation/${folio.id}/verdict`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(bodyPayload),
        });

        const resJson = await res.json().catch(() => ({}));
        if (!res.ok || resJson.status !== "success") {
          alert(resJson.detail || "No se pudo procesar el veredicto de evaluación.");
          return;
        }

        if (verdictType === "verify_entry" && !resJson.all_verified && entries.length > 1) {
          // Mark current entry verified locally and move to next unverified entry
          setEntries((prev) =>
            prev.map((e, i) =>
              i === activeEntryIndex ? { ...e, status: "verified", metadata: { ...formData } } : e
            )
          );
          const nextUnverifiedIdx = entries.findIndex(
            (e, i) => i !== activeEntryIndex && e.status !== "verified"
          );
          if (nextUnverifiedIdx !== -1) {
            setActiveEntryIndex(nextUnverifiedIdx);
            setFormData({ ...(entries[nextUnverifiedIdx]?.metadata || {}) });
            setToastMsg({
              text: `Partida ${activeEntryNum} verificada. Pasando a Partida ${entries[nextUnverifiedIdx].entry_number}.`,
              type: "success",
            });
            fetchQueueAndCounts();
            return;
          }
        }

        const verdictMsgMap: Record<string, string> = {
          verify_all: "✔ Folio aprobado y verificado (Gold Standard).",
          verify_entry: "✔ Folio verificado completamente.",
          return_to_digitizer: "↩ Acta devuelta al Digitador con prioridad alta.",
          mark_doubtful: "🔔 Folio escalado al Archivista en Bandeja de Dudosos.",
        };

        setToastMsg({
          text: verdictMsgMap[verdictType] || "Veredicto registrado.",
          type: verdictType === "return_to_digitizer" || verdictType === "mark_doubtful" ? "warning" : "success",
        });

        await loadNextFolio();
      } catch (err) {
        console.error("Error submitting verdict:", err);
        alert("Error de conexión al enviar el veredicto.");
      } finally {
        setSubmittingVerdict(null);
      }
    },
    [
      folio,
      submittingVerdict,
      reviewNotes,
      getSyncedEntriesPayload,
      activeEntry,
      entries,
      activeEntryIndex,
      activeEntryNum,
      formData,
      fetchQueueAndCounts,
      loadNextFolio,
    ]
  );

  // Keyboard shortcuts: Ctrl+Enter (Approve & Verify), Alt+R (Return to Digitizer), L (Magnifier)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewMode !== "desk" || !folio) return;

      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");

      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        submitVerdict("verify_all");
      } else if (e.altKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        submitVerdict("return_to_digitizer");
      } else if (!isInputFocused && (e.key === "l" || e.key === "L")) {
        e.preventDefault();
        toggleMagnifier();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode, folio, submitVerdict, toggleMagnifier]);

  // Image Viewer Controls
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 4));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);
  const handleResetViewer = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
    resetFilters();
    resetMagnifier();
  };

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

  const handleMouseUp = () => setIsDragging(false);
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
        setZoom((z) => Math.min(z + 0.15, 4));
      } else {
        setZoom((z) => Math.max(z - 0.15, 0.5));
      }
    }
  };

  // Resolve editable fields list from template or entry metadata
  const editableFields = React.useMemo(() => {
    const tplFields = folio?.template?.fields;
    const result: Array<{ key: string; label: string; type: string; required: boolean }> = [];
    const seenKeys = new Set<string>();

    if (Array.isArray(tplFields) && tplFields.length > 0) {
      for (const f of tplFields) {
        const k = f.id || f.key || f.name || "";
        if (!k) continue;
        seenKeys.add(k);
        result.push({
          key: k,
          label: f.label || f.name || f.id || k,
          type: f.type || (k.includes("fecha") ? "date" : "text"),
          required: Boolean(f.required),
        });
      }

      // Si en formData existen claves adicionales con texto no vacío que no están en la plantilla
      // (por ejemplo: abuelos_paternos, abuelos_maternos, padrinos, bautizado, notas_marginales),
      // ¡Añadirlas a la lista para que ningún dato transcrito quede oculto ni se pierda!
      for (const [k, v] of Object.entries(formData)) {
        if (SYSTEM_META_KEYS.has(k) || seenKeys.has(k)) continue;
        if (v !== null && v !== undefined && String(v).trim() !== "") {
          seenKeys.add(k);
          result.push({
            key: k,
            label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            type: k.includes("fecha") ? "date" : "text",
            required: false,
          });
        }
      }

      return result;
    }

    const keys = Object.keys(formData).filter((k) => !SYSTEM_META_KEYS.has(k));
    return keys.map((k) => ({
      key: k,
      label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      type: k.includes("fecha") ? "date" : "text",
      required: false,
    }));
  }, [folio?.template?.fields, formData]);

  const activeModifiedSet = modifiedFieldsByEntry[activeEntryNum] || new Set<string>();
  const totalModifiedCount = Object.values(modifiedFieldsByEntry).reduce(
    (acc, s) => acc + s.size,
    0
  );

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      {/* Floating Toast */}
      {toastMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2 border animate-in fade-in ${
            toastMsg.type === "success"
              ? "bg-indigo-950 text-indigo-100 border-indigo-700"
              : toastMsg.type === "warning"
              ? "bg-amber-950 text-amber-100 border-amber-700"
              : "bg-slate-900 text-white border-slate-700"
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* 1. Cabecera de Control Superior */}
      <header className="bg-white border-b border-slate-200 px-5 py-3 shrink-0 space-y-3 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-2xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h1 className="text-lg font-bold text-slate-900">
                Mesa de Arbitraje y Control de Calidad
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Verifica partidas completadas, corrige en línea con Active Learning o escala casos dudosos al Archivista.
            </p>
          </div>

          {/* Filtros de Serie, Tomo y Conmutador de Modo */}
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={series}
              onChange={(e) => {
                const val = e.target.value;
                setSeries(val);
                setFolderId("");
                setPage(1);
              }}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todas las series</option>
              <option value="bautismo">Bautismos</option>
              <option value="matrimonio">Matrimonios</option>
              <option value="defuncion">Defunciones</option>
            </select>

            <select
              value={folderId}
              onChange={(e) => {
                setFolderId(e.target.value);
                setPage(1);
              }}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 font-medium max-w-[220px] truncate focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todos los Tomos / Libros</option>
              {filteredTomes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            {/* Conmutador de Modo de Trabajo */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("desk")}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                  viewMode === "desk"
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>⚡ Mesa Dual (Cola Continua)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                  viewMode === "list"
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>📋 Lista de Selección por Tomo</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tarjetas de Contadores en Vivo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Card 1: Por Verificar (Completados) */}
          <button
            type="button"
            onClick={() => {
              setQueueType("to_verify");
              setPage(1);
              if (viewMode === "desk") {
                setTimeout(() => loadNextFolio(), 0);
              }
            }}
            className={`flex items-center justify-between px-3.5 py-2 rounded-xl border text-left transition cursor-pointer ${
              queueType === "to_verify"
                ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                : "bg-white text-slate-800 border-slate-200 hover:border-indigo-300"
            }`}
          >
            <div>
              <span
                className={`text-[11px] font-semibold uppercase tracking-wider block ${
                  queueType === "to_verify" ? "text-indigo-100" : "text-slate-500"
                }`}
              >
                Por Verificar (Completados)
              </span>
              <span className="text-lg font-bold">{counts.to_verify}</span>
            </div>
            <CheckCircle2
              className={`w-5 h-5 ${
                queueType === "to_verify" ? "text-indigo-200" : "text-emerald-600"
              }`}
            />
          </button>

          {/* Card 2: Dudosos / Ilegibles */}
          <button
            type="button"
            onClick={() => {
              setQueueType("doubtful");
              setPage(1);
              if (viewMode === "desk") {
                setTimeout(() => loadNextFolio(), 0);
              }
            }}
            className={`flex items-center justify-between px-3.5 py-2 rounded-xl border text-left transition cursor-pointer ${
              queueType === "doubtful"
                ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                : "bg-white text-slate-800 border-slate-200 hover:border-amber-300"
            }`}
          >
            <div>
              <span
                className={`text-[11px] font-semibold uppercase tracking-wider block ${
                  queueType === "doubtful" ? "text-amber-100" : "text-slate-500"
                }`}
              >
                Dudosos / Ilegibles
              </span>
              <span className="text-lg font-bold">{counts.doubtful}</span>
            </div>
            <AlertTriangle
              className={`w-5 h-5 ${
                queueType === "doubtful" ? "text-amber-100" : "text-amber-600"
              }`}
            />
          </button>

          {/* Card 3: Escalados al Archivista */}
          <button
            type="button"
            onClick={() => {
              setQueueType("doubtful");
              setViewMode("list");
              setPage(1);
            }}
            className="flex items-center justify-between px-3.5 py-2 rounded-xl border border-orange-200 bg-orange-50/60 text-slate-800 text-left hover:bg-orange-50 transition cursor-pointer"
          >
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-orange-800 block">
                Escalados al Archivista
              </span>
              <span className="text-lg font-bold text-orange-900">
                {counts.escalated_to_archivist}
              </span>
            </div>
            <Bell className="w-5 h-5 text-orange-600" />
          </button>

          {/* Card 4: Verificados Hoy / Total Verificados */}
          <button
            type="button"
            onClick={() => {
              setQueueType("verified");
              setViewMode("list");
              setPage(1);
            }}
            className={`flex items-center justify-between px-3.5 py-2 rounded-xl border text-left transition cursor-pointer ${
              queueType === "verified"
                ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                : "bg-white text-slate-800 border-slate-200 hover:border-emerald-300"
            }`}
          >
            <div>
              <span
                className={`text-[11px] font-semibold uppercase tracking-wider block ${
                  queueType === "verified" ? "text-emerald-100" : "text-slate-500"
                }`}
              >
                Verificados Hoy / Total
              </span>
              <span className="text-lg font-bold">
                {counts.verified_today}{" "}
                <span
                  className={`text-xs font-normal ${
                    queueType === "verified" ? "text-emerald-100" : "text-slate-400"
                  }`}
                >
                  / {counts.total_verified} total
                </span>
              </span>
            </div>
            <ShieldCheck
              className={`w-5 h-5 ${
                queueType === "verified" ? "text-emerald-100" : "text-indigo-600"
              }`}
            />
          </button>
        </div>
      </header>

      {/* 2. Modo Lista de Selección (viewMode === "list") */}
      {viewMode === "list" ? (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-800">
                  Cola de Evaluación:{" "}
                  {queueType === "to_verify"
                    ? "Por Verificar (Completados)"
                    : queueType === "doubtful"
                    ? "Dudosos / En Revisión"
                    : queueType === "verified"
                    ? "Verificados (Gold Standard)"
                    : "Todos"}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
                  {totalItems} folios
                </span>
              </div>
              <button
                type="button"
                onClick={() => fetchQueueAndCounts()}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
              >
                Actualizar lista
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-600 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Folio</th>
                    <th className="py-3 px-4">Tomo / Serie</th>
                    <th className="py-3 px-4">Partidas Resumidas</th>
                    <th className="py-3 px-4">Digitado por</th>
                    <th className="py-3 px-4">Estado / Notas de Calidad</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loadingQueue ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                        Cargando cola de evaluación...
                      </td>
                    </tr>
                  ) : queueItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        No hay folios en esta bandeja con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    queueItems.map((item) => {
                      const sideChar =
                        item.folio_side === "vuelto"
                          ? "v"
                          : item.folio_side === "unica"
                          ? "u"
                          : "r";
                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                                F.{item.folio_number || 1}
                                {sideChar}
                              </span>
                              <div>
                                <div className="font-mono text-slate-900 font-semibold">
                                  {item.canonical_filename}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  ID: {item.id.slice(0, 8)}...
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800">{item.tome_name}</div>
                            <div className="text-[10px] uppercase text-slate-400 font-semibold">
                              {item.series}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              {(item.entries_summary || []).map((es) => (
                                <div
                                  key={es.id || es.entry_number}
                                  className="flex items-center gap-1.5 text-xs"
                                >
                                  <span className="px-1.5 py-0.2 bg-indigo-50 text-indigo-700 rounded font-mono text-[10px] font-semibold">
                                    P.{es.entry_number} (Acta {es.act_number || "S/N"})
                                  </span>
                                  <span className="font-medium text-slate-800 truncate max-w-[180px]">
                                    {es.principal_person}
                                  </span>
                                  {es.event_date && es.event_date !== "—" && (
                                    <span className="text-slate-400 text-[10px]">
                                      • {es.event_date}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                              <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                              <span>{item.digitized_by || "Operador"}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 max-w-[260px]">
                            <div className="flex flex-col items-start gap-1">
                              <div className="flex flex-wrap items-center gap-1">
                                {item.status === "verified" ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                                    ✔ Verificado
                                  </span>
                                ) : item.status === "revision" ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                    ⚠ Dudoso / Revisión
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    Por Verificar
                                  </span>
                                )}
                                {item.escalated_to_archivist && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-300">
                                    🔔 Escalado al Archivista
                                  </span>
                                )}
                              </div>
                              {item.review_notes && (
                                <p
                                  className="text-[11px] text-slate-600 italic truncate max-w-full"
                                  title={item.review_notes}
                                >
                                  &ldquo;{item.review_notes}&rdquo;
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setViewMode("desk");
                                loadNextFolio(item.id);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
                            >
                              <span>Evaluar Folio</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-slate-50">
              <span>
                Página <strong>{page}</strong> de <strong>{totalPages}</strong> ({totalItems}{" "}
                folios)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loadingQueue}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 border rounded bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages || loadingQueue}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 border rounded bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  Siguiente
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* 3. Modo Mesa Dual de Evaluación (viewMode === "desk") */
        <div className="flex-1 flex overflow-hidden">
          {loadingDesk ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
              <p className="text-sm font-medium">Cargando folio en la Mesa de Arbitraje...</p>
            </div>
          ) : !folio ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-8 text-center">
              <div className="p-4 rounded-full bg-indigo-50 text-indigo-600 mb-4">
                <ShieldCheck className="w-12 h-12" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                ¡Cola de evaluación al día!
              </h2>
              <p className="text-sm text-slate-500 max-w-md mb-6">
                No hay más folios pendientes en la bandeja{" "}
                <strong>
                  {queueType === "doubtful" ? "Dudosos / Ilegibles" : "Por Verificar"}
                </strong>{" "}
                con los filtros actuales.
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
                >
                  Ver Lista por Tomo
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/${subdomain}/records`)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition cursor-pointer"
                >
                  Ir a Explorador de Registros
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Panel Izquierdo: Visor de Alta Resolución */}
              <div
                className="w-1/2 bg-slate-950 border-r border-slate-800 relative flex items-center justify-center p-4 overflow-hidden select-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onWheel={handleWheel}
              >
                {/* Controles Superiores Flotantes */}
                <div
                  className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur border border-slate-700 text-white px-3 py-1.5 rounded-full shadow-xl text-xs"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    className="p-1 hover:bg-slate-800 rounded-full text-slate-200"
                    title="Alejar (-)"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="font-mono text-[11px] min-w-[3rem] text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={handleZoomIn}
                    className="p-1 hover:bg-slate-800 rounded-full text-slate-200"
                    title="Acercar (+)"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <span className="h-4 w-px bg-slate-700 mx-1" />
                  <button
                    type="button"
                    onClick={handleRotate}
                    className="px-2 py-1 hover:bg-slate-800 rounded text-slate-200 flex items-center gap-1"
                    title="Rotar 90°"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>90°</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetViewer}
                    className="px-2 py-1 hover:bg-slate-800 rounded text-slate-200 flex items-center gap-1"
                    title="Restablecer vista"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                  <span className="h-4 w-px bg-slate-700 mx-1" />
                  <button
                    type="button"
                    onClick={toggleMagnifier}
                    className={`px-2.5 py-1 rounded flex items-center gap-1 font-semibold transition cursor-pointer ${
                      magnifier.active
                        ? "bg-indigo-600 text-white"
                        : "hover:bg-slate-800 text-slate-200"
                    }`}
                    title="Lupa Interactiva [L]"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Lupa [L]</span>
                  </button>
                  <FilterControlsPopover
                    filters={filters}
                    updateFilter={updateFilter}
                    resetFilters={resetFilters}
                    toggleInvert={toggleInvert}
                    toggleGrayscale={toggleGrayscale}
                    toggleBinarized={toggleBinarized}
                  />
                </div>

                {/* Indicador inferior de nombre de archivo */}
                <div className="absolute bottom-3 left-4 z-20 bg-slate-900/80 backdrop-blur border border-slate-700 text-slate-300 px-3 py-1 rounded-lg text-[11px] font-mono flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  <span>
                    {folio.canonical_filename || folio.original_filename || `Folio ${folio.id.slice(0, 8)}`}
                  </span>
                </div>

                {folio.view_url ? (
                  <>
                    <div
                      className="relative flex items-center justify-center max-h-full max-w-full"
                      style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                        transformOrigin: "center center",
                        transition: isDragging ? "none" : "transform 0.1s ease-out",
                      }}
                    >
                      <img
                        ref={imgRef}
                        src={folio.view_url}
                        alt="Folio en evaluación"
                        draggable={false}
                        onLoad={(e) => setImageRect(e.currentTarget.getBoundingClientRect())}
                        style={{
                          cursor: magnifier.active
                            ? "crosshair"
                            : isDragging
                            ? "grabbing"
                            : "grab",
                          filter: filterString,
                        }}
                        className="max-h-full max-w-full object-contain rounded shadow-2xl"
                      />
                    </div>
                    <MagnifierLens
                      imageSrc={folio.view_url}
                      imgRef={imgRef}
                      magnifier={magnifier}
                      filterString={filterString}
                      imageRect={imageRect}
                      rotation={rotation}
                    />
                  </>
                ) : (
                  <div className="text-slate-400 text-xs">
                    Imagen no disponible en Storage para este folio.
                  </div>
                )}
              </div>

              {/* Panel Derecho: Arbitraje, Trazabilidad y Edición En Línea */}
              <div className="w-1/2 bg-white flex flex-col overflow-hidden">
                {/* Tarjeta de Trazabilidad del Folio */}
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 space-y-2 shrink-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                        <UserCheck className="w-4 h-4 text-indigo-600" />
                        Digitado por:{" "}
                        <span className="text-indigo-700">
                          {folio.metadata?.digitized_by || folio.digitized_by || "Operador"}
                        </span>
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="inline-flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                        Tomo:{" "}
                        <strong className="text-slate-800">
                          {folio.inherited_context?.folder_name ||
                            folio.inherited_context?.tome_name ||
                            folio.inherited_context?.tome_number ||
                            "—"}
                        </strong>
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        Localidad:{" "}
                        <strong className="text-slate-800">
                          {folio.inherited_context?.canonical_place ||
                            folio.inherited_context?.parish_name ||
                            "—"}
                        </strong>
                      </span>
                    </div>

                    {/* Badges de Estado de Arbitraje */}
                    <div className="flex items-center gap-1.5">
                      {(folio.metadata?.escalated_to_archivist || folio.escalated_to_archivist) && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-300">
                          🔔 Escalado al Archivista por{" "}
                          {folio.metadata?.escalated_by || folio.escalated_by || "Evaluador"}
                        </span>
                      )}
                      {folio.status === "verified" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
                          ✔ Verificado por{" "}
                          {folio.metadata?.verified_by || folio.verified_by || "Evaluador"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Selector de Pestañas Multi-Partida */}
                <div className="px-5 py-2.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    {entries.map((entry, idx) => {
                      const isActive = idx === activeEntryIndex;
                      const eStatus = entry.status || "completed";
                      const dotColor =
                        eStatus === "verified"
                          ? "bg-indigo-500"
                          : eStatus === "completed"
                          ? "bg-emerald-500"
                          : "bg-amber-500";
                      return (
                        <button
                          key={`eval-tab-${entry.entry_number}-${idx}`}
                          type="button"
                          onClick={() => handleSwitchEntry(idx)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                            isActive
                              ? "bg-indigo-600 text-white shadow-2xs"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isActive ? "bg-white" : dotColor
                            }`}
                          />
                          <span>Partida {entry.entry_number}</span>
                        </button>
                      );
                    })}
                  </div>

                  {entries.length > 1 && (
                    <button
                      type="button"
                      disabled={Boolean(submittingVerdict)}
                      onClick={() => submitVerdict("verify_all")}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>✔ Verificar Todas las Partidas</span>
                    </button>
                  )}
                </div>

                {/* Formulario Editable de la Partida Activa ("Corregir y Verificar") */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {/* Barra de Foliación y Acta de la Partida Activa */}
                  <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">
                        Acta / Partida N°
                      </label>
                      <input
                        type="text"
                        value={activeEntry?.act_number ?? ""}
                        onChange={(e) =>
                          updateActiveEntryArchivalField({ act_number: e.target.value })
                        }
                        placeholder="Ej. 45 o S/N"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">
                        Folio Físico
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={activeEntry?.folio_number ?? 1}
                        onChange={(e) =>
                          updateActiveEntryArchivalField({
                            folio_number: e.target.value ? parseInt(e.target.value, 10) : 1,
                          })
                        }
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">
                        Cara del Folio
                      </label>
                      <select
                        value={activeEntry?.folio_side || "recto"}
                        onChange={(e) =>
                          updateActiveEntryArchivalField({ folio_side: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="recto">Recto (Frente)</option>
                        <option value="vuelto">Vuelto (Dorso)</option>
                        <option value="unica">Única</option>
                      </select>
                    </div>
                  </div>

                  {/* Aviso si el Evaluador ha modificado campos */}
                  {totalModifiedCount > 0 && (
                    <div className="px-3.5 py-2 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between text-xs text-indigo-900">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>
                          Has corregido <strong>{totalModifiedCount}</strong> campo(s). Al aprobar, se guardarán en <strong>Active Learning (Gold Standard)</strong>.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Campos del Esquema de la Plantilla */}
                  <div className="space-y-3">
                    {editableFields.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                        No hay campos adicionales registrados en esta partida.
                      </div>
                    ) : (
                      editableFields.map((field) => {
                        const isCorrected = activeModifiedSet.has(field.key);
                        const val = isCorrected
                          ? (formData[field.key] ?? "")
                          : (formData[field.key] !== undefined && formData[field.key] !== ""
                              ? formData[field.key]
                              : resolveFieldValue(field.key, formData));
                        return (
                          <div key={field.key} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <label className="font-semibold text-slate-700">
                                {field.label}
                                {field.required && <span className="text-rose-500 ml-1">*</span>}
                              </label>
                              {isCorrected && (
                                <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                  Campo corregido por Evaluador — se registrará en Active Learning
                                </span>
                              )}
                            </div>
                            <input
                              type={field.type === "date" ? "date" : "text"}
                              value={val}
                              onChange={(e) => handleFieldChange(field.key, e.target.value)}
                              className={`w-full px-3 py-2 rounded-lg text-sm transition focus:outline-hidden ${
                                isCorrected
                                  ? "border-2 border-indigo-500 bg-indigo-50/30 text-slate-900 ring-2 ring-indigo-500/20"
                                  : "border border-slate-300 bg-white text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                              }`}
                            />
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Campo de Nota de Revisión / Observación */}
                  <div className="pt-2 border-t border-slate-200">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nota de Revisión / Observación de Calidad (review_notes)
                    </label>
                    <textarea
                      ref={reviewNotesRef}
                      rows={2}
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Escribe una observación para el Digitador (si devuelves el acta) o dictamen para el Archivista (si escalas como dudoso)..."
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Barra Inferior de 3 Botones de Veredicto + Atajos de Teclado */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2.5 shrink-0">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* 1. Aprobar y Verificar */}
                    <button
                      type="button"
                      disabled={Boolean(submittingVerdict)}
                      onClick={() => submitVerdict("verify_all")}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>✔ Aprobar y Verificar (Ctrl+Enter)</span>
                    </button>

                    {/* 2. Devolver al Digitador */}
                    <button
                      type="button"
                      disabled={Boolean(submittingVerdict)}
                      onClick={() => submitVerdict("return_to_digitizer")}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw className="w-4 h-4 shrink-0" />
                      <span>↩ Devolver al Digitador (Alt+R)</span>
                    </button>

                    {/* 3. Escalar al Archivista / Dudoso */}
                    <button
                      type="button"
                      disabled={Boolean(submittingVerdict)}
                      onClick={() => submitVerdict("mark_doubtful")}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>⚠ Escalar al Archivista / Dudoso</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <div className="flex items-center gap-3">
                      {entries.length > 1 && (
                        <button
                          type="button"
                          disabled={Boolean(submittingVerdict)}
                          onClick={() => submitVerdict("verify_entry")}
                          className="text-indigo-600 hover:underline font-semibold cursor-pointer"
                        >
                          Verificar solo Partida {activeEntryNum}
                        </button>
                      )}
                      <span>
                        Atajos: <kbd className="px-1 py-0.5 bg-slate-200 rounded">Ctrl+Enter</kbd>{" "}
                        Verificar • <kbd className="px-1 py-0.5 bg-slate-200 rounded">Alt+R</kbd>{" "}
                        Devolver • <kbd className="px-1 py-0.5 bg-slate-200 rounded">L</kbd> Lupa
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={Boolean(submittingVerdict)}
                      onClick={() => loadNextFolio()}
                      className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                    >
                      <span>Saltar / Siguiente →</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
