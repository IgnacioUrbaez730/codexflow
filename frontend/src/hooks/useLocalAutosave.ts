"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AutosaveStatus, LocalDraft, ViewerState } from "../types/autosave";
import {
  buildDraftStorageKey,
  purgeExpiredDrafts,
  safeGetDraft,
  safeSaveDraft,
} from "../utils/draftStorage";

export interface UseLocalAutosaveOptions<T = Record<string, any>> {
  tenantId?: string | null;
  folioId?: string | null;
  formData: T;
  viewerState: ViewerState;
  modifiedFields?: string[];
  onRestoreDraft?: (draft: LocalDraft<T>) => void;
  debounceMs?: number;
}

export interface UseLocalAutosaveReturn {
  status: AutosaveStatus;
  isOnline: boolean;
  hasDraft: boolean;
  hasLocalDraft: boolean;
  lastSavedAt: number | null;
  showToast: boolean;
  dismissToast: () => void;
  clearDraft: () => void;
  discardDraft: () => void;
}

export function useLocalAutosave<T = Record<string, any>>({
  tenantId,
  folioId,
  formData,
  viewerState,
  modifiedFields = [],
  onRestoreDraft,
  debounceMs = 500,
}: UseLocalAutosaveOptions<T>): UseLocalAutosaveReturn {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof window !== "undefined" && typeof navigator !== "undefined") {
      return navigator.onLine;
    }
    return true;
  });
  const [hasDraft, setHasDraft] = useState<boolean>(false);
  const [showToast, setShowToast] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialMountRef = useRef<boolean>(true);
  const isRestoringRef = useRef<boolean>(false);
  const currentKeyRef = useRef<string | null>(null);
  const lastSavedHashRef = useRef<string | null>(null);
  const latestPayloadRef = useRef({ formData, viewerState, modifiedFields });
  latestPayloadRef.current = { formData, viewerState, modifiedFields };

  const storageKey =
    tenantId && folioId ? buildDraftStorageKey(tenantId, folioId) : null;
  currentKeyRef.current = storageKey;

  const serializedForm = JSON.stringify(formData || {});
  const serializedMod = JSON.stringify(modifiedFields || []);
  const serializedViewer = JSON.stringify({
    z: viewerState?.zoom ?? 1,
    x: Math.round(viewerState?.panX ?? viewerState?.pan?.x ?? 0),
    y: Math.round(viewerState?.panY ?? viewerState?.pan?.y ?? 0),
    r: viewerState?.rotation ?? 0,
  });

  // Cleanup toast timer
  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setShowToast(false);
  }, []);

  // Remove local draft completely
  const clearDraft = useCallback(() => {
    if (typeof window === "undefined" || !currentKeyRef.current) return;
    try {
      window.localStorage.removeItem(currentKeyRef.current);
    } catch (e) {
      console.warn("Failed to clear draft from localStorage:", e);
    }
    lastSavedHashRef.current = null;
    setHasDraft(false);
    setStatus("idle");
  }, []);

  // Discard draft alias
  const discardDraft = useCallback(() => {
    clearDraft();
    dismissToast();
  }, [clearDraft, dismissToast]);

  // Online / Offline network status listeners
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Mount / Folio change: purge expired & check for existing draft
  useEffect(() => {
    if (typeof window === "undefined" || !storageKey) return;

    // Purge drafts older than 7 days
    purgeExpiredDrafts();
    lastSavedHashRef.current = null;

    const existingDraft = safeGetDraft<T>(storageKey);

    if (existingDraft) {
      setHasDraft(true);
      setLastSavedAt(existingDraft.updatedAt || existingDraft.timestamp || Date.now());
      setStatus("saved");

      if (onRestoreDraft) {
        isRestoringRef.current = true;
        onRestoreDraft(existingDraft);
        // Reset the restoring flag in the next tick
        setTimeout(() => {
          isRestoringRef.current = false;
        }, 100);
      }

      setShowToast(true);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => {
        setShowToast(false);
      }, 4000);
    } else {
      setHasDraft(false);
      setStatus("idle");
    }

    initialMountRef.current = false;

    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [storageKey]); // Only re-run when the storage key changes

  // Auto-save debounced effect upon changes to formData or viewerState
  useEffect(() => {
    // Avoid saving during SSR, without storageKey, or during initial restore
    if (typeof window === "undefined" || !storageKey || !tenantId || !folioId) {
      return;
    }

    const currentHash = `${storageKey}::${serializedForm}::${serializedMod}::${serializedViewer}`;

    if (isRestoringRef.current) {
      lastSavedHashRef.current = currentHash;
      return;
    }

    // Only autosave when the user has actually modified at least one field
    if (!modifiedFields || modifiedFields.length === 0) {
      return;
    }

    // Do not save empty/uninitialized form state on first mount if there are no values
    if (Object.keys((latestPayloadRef.current.formData as any) || {}).length === 0) {
      return;
    }

    // Skip if serialized content has not changed since last save
    if (lastSavedHashRef.current === currentHash) {
      return;
    }

    setStatus("saving");

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const now = Date.now();
      const {
        formData: latestForm,
        viewerState: latestViewer,
        modifiedFields: latestMod,
      } = latestPayloadRef.current;

      const draft: LocalDraft<T> = {
        version: 1,
        tenantId,
        folioId,
        formData: latestForm,
        modifiedFields: latestMod,
        viewerState: latestViewer,
        updatedAt: now,
        timestamp: now,
      };

      const success = safeSaveDraft(storageKey, draft);
      if (success) {
        lastSavedHashRef.current = currentHash;
        setStatus("saved");
        setHasDraft(true);
        setLastSavedAt(now);
      } else {
        setStatus("error");
      }
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [
    serializedForm,
    serializedMod,
    serializedViewer,
    modifiedFields?.length,
    storageKey,
    tenantId,
    folioId,
    debounceMs,
  ]);

  // Window beforeunload safety guard
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasDraft && status !== "saved") {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasDraft, status]);

  return {
    status,
    isOnline,
    hasDraft,
    hasLocalDraft: hasDraft,
    lastSavedAt,
    showToast,
    dismissToast,
    clearDraft,
    discardDraft,
  };
}
