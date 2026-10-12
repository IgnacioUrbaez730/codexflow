"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Search, Eye, EyeOff, Crosshair, Trash2 } from "lucide-react";
import { useImageViewerFilters } from "../../../hooks/useImageViewerFilters";
import { MagnifierLens } from "../../../components/viewer/MagnifierLens";
import { FilterControlsPopover } from "../../../components/viewer/FilterControlsPopover";
import { AIOverlayLayer } from "../../../components/viewer/AIOverlayLayer";
import { AIAssistedInput } from "../../../components/indexing/AIAssistedInput";
import { AutosaveBadge } from "../../../components/viewer/AutosaveBadge";
import { OfflineBanner } from "../../../components/viewer/OfflineBanner";
import { DiscardDraftModal } from "../../../components/viewer/DiscardDraftModal";
import { AutosaveRestoreToast } from "../../../components/viewer/AutosaveRestoreToast";
import { useLocalAutosave } from "../../../hooks/useLocalAutosave";
import { ViewerState, LocalDraft } from "../../../types/autosave";
import { AIPrediction, BoundingBoxNormalized } from "../../../types/aiIndexing";
import { shouldPrefillPrediction } from "../../../utils/aiGeometry";

function parseAIPredictions(raw: any, folioId?: string): AIPrediction[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((p, idx) => {
      const bbox = p.bbox || { x: 0.1, y: 0.12 + idx * 0.08, width: 0.76, height: 0.048 };
      const bboxArray: [number, number, number, number] =
        Array.isArray(p.bbox_array) && p.bbox_array.length === 4
          ? (p.bbox_array as [number, number, number, number])
          : [
              Number(bbox.x.toFixed(4)),
              Number(bbox.y.toFixed(4)),
              Number((bbox.x + bbox.width).toFixed(4)),
              Number((bbox.y + bbox.height).toFixed(4)),
            ];
      return {
        id: p.id || `pred-${idx}-${p.fieldKey || p.field_key}`,
        folioId: p.folioId || p.folio_id || folioId,
        fieldKey: p.fieldKey || p.field_key || "",
        field_key: p.field_key || p.fieldKey || "",
        fieldLabel: p.fieldLabel || p.field_label || p.fieldKey || p.field_key || "",
        suggestedText: p.suggestedText || p.suggested_text || p.value || "",
        suggested_text: p.suggested_text || p.suggestedText || p.value || "",
        confidence: typeof p.confidence === "number" ? p.confidence : 0.85,
        bbox,
        bbox_array: bboxArray,
        bbox_coords: bboxArray,
        isValidSyntax: p.isValidSyntax ?? true,
        modelVersion: p.modelVersion || p.model_version || "v2.0-active-learning",
      };
    });
  }
  if (typeof raw === "object") {
    return Object.entries(raw).map(([key, val]: [string, any], idx) => {
      if (typeof val === "object" && val !== null) {
        const bbox = val.bbox || { x: 0.1, y: 0.12 + idx * 0.08, width: 0.76, height: 0.048 };
        const bboxArray: [number, number, number, number] = [
          Number(bbox.x.toFixed(4)),
          Number(bbox.y.toFixed(4)),
          Number((bbox.x + bbox.width).toFixed(4)),
          Number((bbox.y + bbox.height).toFixed(4)),
        ];
        return {
          id: val.id || `pred-${key}-${idx}`,
          folioId: val.folioId || folioId,
          fieldKey: key,
          field_key: key,
          suggestedText: val.value || val.suggestedText || val.suggested_text || "",
          confidence: typeof val.confidence === "number" ? val.confidence : 0.85,
          bbox,
          bbox_array: bboxArray,
          bbox_coords: bboxArray,
          isValidSyntax: val.isValidSyntax ?? true,
          modelVersion: val.modelVersion || "v2.0-active-learning",
        };
      }
      const bbox = { x: 0.1, y: 0.14 + idx * 0.075, width: 0.76, height: 0.048 };
      const bboxArray: [number, number, number, number] = [
        Number(bbox.x.toFixed(4)),
        Number(bbox.y.toFixed(4)),
        Number((bbox.x + bbox.width).toFixed(4)),
        Number((bbox.y + bbox.height).toFixed(4)),
      ];
      return {
        id: `pred-${key}-${idx}`,
        folioId,
        fieldKey: key,
        field_key: key,
        suggestedText: String(val || ""),
        confidence: 0.88,
        bbox,
        bbox_array: bboxArray,
        bbox_coords: bboxArray,
        isValidSyntax: true,
        modelVersion: "v2.0-active-learning",
      };
    });
  }
  return [];
}

function buildFallbackTemplatePredictions(fields: any[], folioId?: string): AIPrediction[] {
  if (!Array.isArray(fields) || fields.length === 0) return [];
  const total = Math.max(1, fields.length);
  const stepY = Math.min(0.085, 0.72 / total);

  return fields.map((field: any, idx: number) => {
    const fieldKey = String(field.id || field.name || `field_${idx}`);
    const fieldLabel = String(field.label || field.name || fieldKey);
    const fieldType = String(field.type || "short_text").toLowerCase();
    const x = 0.1;
    const y = Number(Math.min(0.88, 0.14 + idx * stepY).toFixed(4));
    const width = 0.76;
    const height = fieldType === "long_text" ? 0.08 : 0.048;
    const bbox = { x, y, width, height };
    const bboxArray: [number, number, number, number] = [
      x,
      y,
      Number((x + width).toFixed(4)),
      Number((y + height).toFixed(4)),
    ];
    const suggestedText =
      (fieldType === "dropdown" || fieldType === "select") &&
      Array.isArray(field.options) &&
      field.options.length > 0
        ? String(field.options[0])
        : "";
    const confidence = suggestedText ? 0.82 : 0.76;

    return {
      id: `pred-${folioId ? String(folioId).slice(0, 8) : "doc"}-${idx}`,
      folioId,
      fieldKey,
      field_key: fieldKey,
      fieldLabel,
      suggestedText,
      suggested_text: suggestedText,
      confidence,
      bbox,
      bbox_array: bboxArray,
      bbox_coords: bboxArray,
      isValidSyntax: true,
      modelVersion: "v2.0-active-learning",
    };
  });
}

export default function VisorDual() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const subdomain = params.subdomain as string;
  const folioIdParam = searchParams.get("folio_id");

  const [folio, setFolio] = useState<any>(null);
  const [template, setTemplate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<Record<string, any>>({});

  // AI-Assisted Indexing States
  const [aiPredictions, setAiPredictions] = useState<AIPrediction[]>([]);
  const [prefilledFields, setPrefilledFields] = useState<Set<string>>(new Set());
  const [modifiedFields, setModifiedFields] = useState<Set<string>>(new Set());
  const [activeFieldKey, setActiveFieldKey] = useState<string | null>(null);
  const [showAIOverlay, setShowAIOverlay] = useState(false);
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);
  const [isSavingServer, setIsSavingServer] = useState(false);

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
  const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number }>({
    width: 800,
    height: 1000,
  });
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
    setMagnifier((m) => ({ ...m, active: false, visible: false }));
  }, [folio?.id, setMagnifier]);

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
        setZoom((z) => Math.min(z + 0.15, 4));
      } else {
        setZoom((z) => Math.max(z - 0.15, 0.5));
      }
    }
  };

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Initialize form with intelligent prefilling (Confidence >= 80% and valid format)
  const initializeFormWithAI = useCallback(
    (currentTemplate: any, predictions: AIPrediction[], existingMetadata?: any) => {
      const newForm: Record<string, any> = {};
      const newPrefilled = new Set<string>();

      if (currentTemplate && currentTemplate.fields) {
        for (const field of currentTemplate.fields) {
          // If folio already has human metadata saved
          if (existingMetadata && existingMetadata[field.id] !== undefined) {
            newForm[field.id] = existingMetadata[field.id];
            continue;
          }

          // Search matching AI prediction
          const match = predictions.find(
            (p) =>
              p.fieldKey === field.id ||
              p.fieldKey === field.name ||
              p.field_key === field.id
          );

          if (
            match &&
            shouldPrefillPrediction(match.confidence, match.suggestedText, field.type)
          ) {
            newForm[field.id] = match.suggestedText;
            newPrefilled.add(field.id);
          } else {
            // Confidence < 80% or invalid format: leave empty!
            newForm[field.id] = "";
          }
        }
      }

      setFormData(newForm);
      setPrefilledFields(newPrefilled);
      setModifiedFields(new Set());
    },
    []
  );

  const applyPredictionsToEmptyFields = useCallback(
    (currentTemplate: any, predictions: AIPrediction[]) => {
      if (!currentTemplate || !Array.isArray(currentTemplate.fields) || predictions.length === 0) {
        return;
      }
      setFormData((prevForm) => {
        const updated = { ...prevForm };
        const nextPrefilled = new Set(prefilledFields);
        for (const field of currentTemplate.fields) {
          if (updated[field.id] === undefined || String(updated[field.id]).trim() === "") {
            const match = predictions.find(
              (p) =>
                p.fieldKey === field.id ||
                p.fieldKey === field.name ||
                p.field_key === field.id
            );
            if (
              match &&
              shouldPrefillPrediction(match.confidence, match.suggestedText, field.type)
            ) {
              updated[field.id] = match.suggestedText;
              nextPrefilled.add(field.id);
            }
          }
        }
        setPrefilledFields(nextPrefilled);
        return updated;
      });
    },
    [prefilledFields]
  );

  const handleToggleAI = useCallback(async () => {
    const nextState = !showAIOverlay;
    setShowAIOverlay(nextState);

    if (nextState && aiPredictions.length === 0 && folio?.id) {
      let resolvedPreds: AIPrediction[] = [];
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const res = await fetch(`/api/v1/folios/${folio.id}/analyze-ai`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session?.access_token}`,
          },
        });
        if (res.ok) {
          const resData = await res.json();
          resolvedPreds = parseAIPredictions(resData.ai_predictions, folio.id);
        }
      } catch (err) {
        console.warn("Notice analyzing AI on toggle:", err);
      }

      if (resolvedPreds.length === 0 && template?.fields?.length > 0) {
        resolvedPreds = buildFallbackTemplatePredictions(template.fields, folio.id);
      }

      if (resolvedPreds.length > 0) {
        setAiPredictions(resolvedPreds);
        applyPredictionsToEmptyFields(template, resolvedPreds);
      }
    }
  }, [
    showAIOverlay,
    aiPredictions.length,
    folio?.id,
    supabase,
    template,
    applyPredictionsToEmptyFields,
  ]);

  const fetchTemplate = useCallback(
    async (templateId: string, currentFolio?: any, predictions?: AIPrediction[]) => {
      const { data } = await supabase.from("templates").select("*").eq("id", templateId).single();
      if (data) {
        setTemplate(data);
        if (currentFolio) {
          let preds =
            predictions && predictions.length > 0
              ? predictions
              : parseAIPredictions(currentFolio.ai_predictions, currentFolio.id);

          if (preds.length === 0 && currentFolio.id) {
            try {
              const { data: sessionData } = await supabase.auth.getSession();
              const aiRes = await fetch(`/api/v1/folios/${currentFolio.id}/analyze-ai`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${sessionData.session?.access_token}`,
                },
              });
              if (aiRes.ok) {
                const aiData = await aiRes.json();
                preds = parseAIPredictions(aiData.ai_predictions, currentFolio.id);
              }
            } catch (err) {
              console.warn("Fallback to template bounding boxes:", err);
            }
          }

          if (preds.length === 0 && Array.isArray(data.fields) && data.fields.length > 0) {
            preds = buildFallbackTemplatePredictions(data.fields, currentFolio.id);
          }

          setAiPredictions(preds);
          initializeFormWithAI(data, preds, currentFolio.metadata);
        }
      }
    },
    [supabase, initializeFormWithAI]
  );

  const fetchNextFolio = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/v1/folios/get_next", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session?.access_token}`,
        },
      });
      const resData = await res.json();
      if (resData.status === "success" && resData.data) {
        const nextFolio = resData.data;
        setFolio(nextFolio);

        const parsedPreds = parseAIPredictions(nextFolio.ai_predictions, nextFolio.id);
        setAiPredictions(parsedPreds);

        const batchRes = await supabase
          .from("batches")
          .select("template_id")
          .eq("id", nextFolio.batch_id)
          .single();
        if (batchRes.data) {
          await fetchTemplate(batchRes.data.template_id, nextFolio, parsedPreds);
        }
      } else {
        setFolio(null);
      }
    } catch (e) {
      console.error(e);
      setFolio(null);
    }
    setLoading(false);
  }, [supabase, fetchTemplate]);

  const fetchSpecificFolio = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const res = await fetch(`/api/v1/folios/${id}`, {
          headers: {
            Authorization: `Bearer ${sessionData.session?.access_token}`,
          },
        });
        const resData = await res.json();
        if (res.ok && resData.status === "success" && resData.data) {
          const specFolio = resData.data;
          setFolio(specFolio);

          const parsedPreds = parseAIPredictions(specFolio.ai_predictions, specFolio.id);
          setAiPredictions(parsedPreds);

          const batchRes = await supabase
            .from("batches")
            .select("template_id")
            .eq("id", specFolio.batch_id)
            .single();
          if (batchRes.data) {
            await fetchTemplate(batchRes.data.template_id, specFolio, parsedPreds);
          }
        } else {
          setFolio(null);
        }
      } catch (e) {
        console.error(e);
        setFolio(null);
      }
      setLoading(false);
    },
    [supabase, fetchTemplate]
  );

  useEffect(() => {
    if (folioIdParam) {
      fetchSpecificFolio(folioIdParam);
    } else {
      fetchNextFolio();
    }
  }, [folioIdParam, fetchNextFolio, fetchSpecificFolio]);

  // Center camera smoothly onto bounding box
  const centerCameraOnBBox = useCallback(
    (bbox: BoundingBoxNormalized, currentZoom: number, force: boolean = false) => {
      // Ergonomics rule: if zoom > 2.5x and not forced, do NOT move camera!
      if (!force && currentZoom > 2.5) {
        return;
      }
      if (!imgRef.current) return;

      const imgW = imgRef.current.clientWidth || 800;
      const imgH = imgRef.current.clientHeight || 1000;

      // Coordinate offset from image center
      const dx = (bbox.x + bbox.width / 2 - 0.5) * imgW;
      const dy = (bbox.y + bbox.height / 2 - 0.5) * imgH;

      const rad = (rotation * Math.PI) / 180;
      const rotDx = dx * Math.cos(rad) - dy * Math.sin(rad);
      const rotDy = dx * Math.sin(rad) + dy * Math.cos(rad);

      setPan({
        x: -rotDx * currentZoom,
        y: -rotDy * currentZoom,
      });
    },
    [rotation]
  );

  // Field focus handler: triggers visual ergonomics & camera navigation
  const handleFieldFocus = useCallback(
    (fieldId: string) => {
      setActiveFieldKey(fieldId);
      const pred = aiPredictions.find(
        (p) => p.fieldKey === fieldId || p.field_key === fieldId
      );
      if (pred && pred.bbox) {
        centerCameraOnBBox(pred.bbox, zoom, false);
      }
    },
    [aiPredictions, centerCameraOnBBox, zoom]
  );

  // Force camera recentering on active field (Alt + C)
  const handleForceRecenter = useCallback(() => {
    if (!activeFieldKey) return;
    if (!showAIOverlay) {
      setShowAIOverlay(true);
    }
    const pred = aiPredictions.find(
      (p) => p.fieldKey === activeFieldKey || p.field_key === activeFieldKey
    );
    if (pred && pred.bbox) {
      centerCameraOnBBox(pred.bbox, zoom, true);
    }
  }, [activeFieldKey, showAIOverlay, aiPredictions, centerCameraOnBBox, zoom]);

  // Click on a bounding box directly inserts its text into the focused field
  const handleSelectPredictionBox = useCallback(
    (prediction: AIPrediction) => {
      const targetKey = activeFieldKey || prediction.fieldKey;
      if (!targetKey) return;

      setFormData((prev) => ({
        ...prev,
        [targetKey]: prediction.suggestedText,
      }));
      setModifiedFields((prev) => new Set(prev).add(targetKey));
    },
    [activeFieldKey]
  );

  const handleFieldChange = (fieldId: string, val: string) => {
    setFormData((prev) => ({ ...prev, [fieldId]: val }));
    setModifiedFields((prev) => new Set(prev).add(fieldId));
  };

  // Build Active Learning discrepancy payload
  const buildFeedbackPayload = useCallback(() => {
    if (!folio || !aiPredictions || aiPredictions.length === 0) return [];

    return aiPredictions.map((pred) => {
      const finalVal = String(formData[pred.fieldKey] || "").trim();
      const origVal = String(pred.suggestedText || "").trim();

      let action_type: "accepted_exact" | "corrected_text" | "rejected_blank" | "manual_inserted" =
        "accepted_exact";
      if (!finalVal && origVal) {
        action_type = "rejected_blank";
      } else if (finalVal && origVal && finalVal === origVal) {
        action_type = "accepted_exact";
      } else if (finalVal && (!origVal || finalVal !== origVal)) {
        action_type = "corrected_text";
      }

      return {
        field_name: pred.fieldKey,
        predicted_value: origVal,
        actual_value: finalVal,
        confidence: pred.confidence,
        action_type,
        bbox: pred.bbox,
      };
    });
  }, [folio, aiPredictions, formData]);

  // Restore local draft callback
  const handleRestoreDraft = useCallback((draft: LocalDraft) => {
    if (draft.formData) {
      setFormData(draft.formData);
    }
    if (draft.modifiedFields && Array.isArray(draft.modifiedFields)) {
      setModifiedFields(new Set(draft.modifiedFields));
    }
  }, []);

  // Centralized local autosave hook
  const {
    status: autosaveStatus,
    isOnline,
    hasDraft,
    lastSavedAt,
    showToast,
    dismissToast,
    clearDraft,
    discardDraft,
  } = useLocalAutosave({
    tenantId: folio?.tenant_id || (subdomain as string),
    folioId: folio?.id || null,
    formData,
    viewerState: {
      zoom,
      pan,
      panX: pan.x,
      panY: pan.y,
      rotation,
    },
    modifiedFields: Array.from(modifiedFields),
    onRestoreDraft: handleRestoreDraft,
    debounceMs: 500,
  });

  // Discard draft confirmation handler
  const handleConfirmDiscard = useCallback(() => {
    discardDraft();
    setIsDiscardModalOpen(false);
    if (template && folio) {
      const preds = parseAIPredictions(folio.ai_predictions, folio.id);
      initializeFormWithAI(template, preds, folio.metadata);
    }
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  }, [discardDraft, template, folio, initializeFormWithAI]);

  const handleSave = useCallback(async () => {
    if (!folio || isSavingServer) return;

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

    setIsSavingServer(true);
    try {
      const feedbackData = buildFeedbackPayload();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch("/api/v1/folios/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          folio_id: folio.id,
          metadata: formData,
          status: "completed",
          feedback: feedbackData,
        }),
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok || resData.status !== "success") {
        alert("Error: " + (resData.detail || "No se pudo guardar el folio"));
        return;
      }

      // Clear local draft after successful save
      clearDraft();

      // Also dispatch silent background feedback if needed
      if (feedbackData.length > 0) {
        fetch("/api/v1/ai/feedback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            folio_id: folio.id,
            items: feedbackData,
          }),
        }).catch((e) => console.warn("Background AI feedback failed:", e));
      }

      if (folioIdParam) {
        router.push(`/${subdomain}/ingest`);
      } else {
        await fetchNextFolio();
      }
    } catch (err: any) {
      console.error("Error saving folio:", err);
      alert("Error de conexión al guardar el folio. Tus cambios siguen respaldados localmente.");
    } finally {
      setIsSavingServer(false);
    }
  }, [
    folio,
    isSavingServer,
    formData,
    template,
    folioIdParam,
    router,
    subdomain,
    fetchNextFolio,
    supabase,
    buildFeedbackPayload,
    clearDraft,
  ]);

  const handleMarkRevision = useCallback(async () => {
    if (!folio || isSavingServer) return;

    setIsSavingServer(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/v1/folios/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          folio_id: folio.id,
          metadata: formData,
          status: "revision",
        }),
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok || resData.status !== "success") {
        alert("Error: " + (resData.detail || "No se pudo marcar el folio como dudoso"));
        return;
      }

      // Clear local draft after marking revision
      clearDraft();

      if (folioIdParam) {
        router.push(`/${subdomain}/ingest`);
      } else {
        await fetchNextFolio();
      }
    } catch (err: any) {
      console.error("Error marking folio as revision:", err);
      alert("Error de conexión al marcar el folio como dudoso.");
    } finally {
      setIsSavingServer(false);
    }
  }, [
    folio,
    isSavingServer,
    formData,
    folioIdParam,
    router,
    subdomain,
    fetchNextFolio,
    supabase,
    clearDraft,
  ]);

  // Global Keyboard Shortcuts (Alt+A, Alt+C, Alt+D, Ctrl+Enter, Ctrl+Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        handleToggleAI();
      } else if (e.altKey && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        handleForceRecenter();
      } else if (e.altKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        setIsDiscardModalOpen(true);
      } else if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        handleSave();
      } else if (e.ctrlKey && e.code === "Space") {
        e.preventDefault();
        handleMarkRevision();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, handleMarkRevision, handleToggleAI, handleForceRecenter]);

  if (loading) {
    return <div className="p-8 text-center text-gray-600 font-sans">Cargando folio e indexación...</div>;
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
    <div className="flex flex-col h-screen overflow-hidden">
      <OfflineBanner isOnline={isOnline} />
      <AutosaveRestoreToast show={showToast} onDismiss={dismissToast} />
      <DiscardDraftModal
        isOpen={isDiscardModalOpen}
        onConfirm={handleConfirmDiscard}
        onCancel={() => setIsDiscardModalOpen(false)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left side: Visor Dual (Document & AI Overlay) */}
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

          {/* AI Overlay Layer Toggle Button (Alt + A) */}
          <button
            type="button"
            onClick={handleToggleAI}
            className={`px-2.5 py-1 flex items-center gap-1.5 rounded text-xs font-medium transition-colors cursor-pointer select-none ${
              showAIOverlay ? "bg-emerald-600 text-white shadow-xs" : "hover:bg-gray-700 text-gray-300"
            }`}
            title="Alternar Capa IA (Alt + A)"
          >
            {showAIOverlay ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>IA [Alt+A]</span>
          </button>

          {/* Force Recenter Button (Alt + C) */}
          {activeFieldKey && (
            <button
              type="button"
              onClick={handleForceRecenter}
              className="px-2 py-1 flex items-center gap-1 rounded hover:bg-gray-700 text-xs text-amber-300 font-medium transition-colors"
              title="Recentrar en campo activo (Alt + C)"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Centrar [Alt+C]</span>
            </button>
          )}

          {/* Interactive Magnifier Toggle */}
          <button
            type="button"
            onClick={toggleMagnifier}
            className={`px-2.5 py-1 flex items-center gap-1.5 rounded text-xs font-medium transition-colors cursor-pointer select-none ${
              magnifier.active ? "bg-blue-600 text-white shadow-xs" : "hover:bg-gray-700 text-gray-200"
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
                alt="Documento para indexar"
                draggable={false}
                onLoad={(e) => {
                  const el = e.currentTarget;
                  setImgDimensions({
                    width: el.naturalWidth || el.clientWidth || 800,
                    height: el.naturalHeight || el.clientHeight || 1000,
                  });
                  setImageRect(el.getBoundingClientRect());
                }}
                style={{
                  cursor: magnifier.active ? "crosshair" : isDragging ? "grabbing" : "grab",
                  filter: filterString,
                }}
                className="max-h-full max-w-full object-contain rounded shadow-lg block"
              />

              {/* AI Vector Bounding Boxes Overlay */}
              <AIOverlayLayer
                predictions={aiPredictions}
                activeFieldKey={activeFieldKey}
                visible={showAIOverlay}
                rotation={0}
                imageWidth={
                  imgRef.current?.naturalWidth ||
                  imgRef.current?.clientWidth ||
                  imgDimensions.width ||
                  800
                }
                imageHeight={
                  imgRef.current?.naturalHeight ||
                  imgRef.current?.clientHeight ||
                  imgDimensions.height ||
                  1000
                }
                onSelectPrediction={handleSelectPredictionBox}
              />
            </div>

            {/* Interactive Magnifier Floating Lens */}
            <MagnifierLens
              imageSrc={folio.view_url}
              imgRef={imgRef}
              magnifier={magnifier}
              filterString={filterString}
              imageRect={imageRect}
              rotation={rotation}
              predictions={aiPredictions}
              activeFieldKey={activeFieldKey}
              showOverlay={showAIOverlay}
            />
          </>
        ) : (
          <div className="text-gray-400">Cargando documento...</div>
        )}
      </div>

      {/* Right side: Intelligent Indexing Form */}
      <div className="w-1/2 bg-white flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {folioIdParam ? "Modo: Revisión de Dudoso" : "Modo: Cola Global"}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-500">Folio ID: {folio.id}</span>
              {aiPredictions.length > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  {aiPredictions.length} campos detectados por IA
                </span>
              )}
              <AutosaveBadge status={autosaveStatus} lastSavedAt={lastSavedAt} />
            </div>
          </div>
          <div className="text-xs text-gray-500 space-y-1 text-right">
            <div>
              <kbd className="bg-gray-200 px-1 rounded">Alt + A</kbd> Capa IA On/Off
            </div>
            <div>
              <kbd className="bg-gray-200 px-1 rounded">Alt + C</kbd> Recentrar foco
            </div>
            <div>
              <kbd className="bg-gray-200 px-1 rounded">Alt + D</kbd> Descartar borrador
            </div>
            <div>
              <kbd className="bg-gray-200 px-1 rounded">Ctrl + Enter</kbd> Guardar
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-4">
          {template?.fields ? (
            template.fields.map((field: any) => {
              const pred = aiPredictions.find(
                (p) => p.fieldKey === field.id || p.fieldKey === field.name || p.field_key === field.id
              );
              const isPrefilled = prefilledFields.has(field.id);
              const isModified = modifiedFields.has(field.id);

              return (
                <AIAssistedInput
                  key={field.id}
                  field={field}
                  value={formData[field.id] || ""}
                  onChange={(val) => handleFieldChange(field.id, val)}
                  onFocus={() => handleFieldFocus(field.id)}
                  prediction={pred}
                  isPrefilled={isPrefilled}
                  isModified={isModified}
                />
              );
            })
          ) : (
            <div className="text-gray-500 text-sm">Cargando campos...</div>
          )}
        </div>

        <div className="p-4 border-t flex justify-between items-center bg-gray-50">
          <div>
            {hasDraft && (
              <button
                type="button"
                onClick={() => setIsDiscardModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-rose-200 text-rose-600 rounded hover:bg-rose-50 transition-colors"
                title="Descartar borrador local (Alt + D)"
              >
                <Trash2 className="w-4 h-4" />
                <span>Descartar borrador</span>
              </button>
            )}
          </div>
          <div className="flex space-x-4">
            <button
              onClick={handleMarkRevision}
              disabled={isSavingServer}
              className="px-4 py-2 border border-yellow-500 text-yellow-600 rounded hover:bg-yellow-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Marcar Dudoso
            </button>
            <button
              onClick={handleSave}
              disabled={isSavingServer}
              className="px-6 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSavingServer ? "Guardando..." : "Guardar y Continuar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}
