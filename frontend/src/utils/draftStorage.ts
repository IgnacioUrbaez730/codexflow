import { LocalDraft } from "../types/autosave";

export const DRAFT_STORAGE_PREFIX = "codexflow_draft_";

/**
 * Builds the unique storage key for a tenant and folio draft.
 */
export function buildDraftStorageKey(tenantId: string, folioId: string): string {
  return `${DRAFT_STORAGE_PREFIX}${tenantId}_${folioId}`;
}

/**
 * Purges expired drafts older than `ttlDays` (default 7 days) or invalid items.
 */
export function purgeExpiredDrafts(ttlDays = 7): void {
  if (typeof window === "undefined" || !window.localStorage) return;

  const maxAgeMs = ttlDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const keysToRemove: string[] = [];

  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(DRAFT_STORAGE_PREFIX)) {
        const raw = window.localStorage.getItem(key);
        if (!raw) {
          keysToRemove.push(key);
          continue;
        }

        try {
          const parsed = JSON.parse(raw);
          const time = parsed.updatedAt || parsed.timestamp || 0;
          if (!time || now - time > maxAgeMs) {
            keysToRemove.push(key);
          }
        } catch {
          // Corrupt JSON draft should also be purged
          keysToRemove.push(key);
        }
      }
    }

    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
  } catch (error) {
    console.warn("Error while purging expired drafts:", error);
  }
}

/**
 * Safely retrieves a draft from localStorage.
 * If JSON parsing fails due to corruption, silently removes the item and returns null.
 */
export function safeGetDraft<T = Record<string, any>>(key: string): LocalDraft<T> | null {
  if (typeof window === "undefined" || !window.localStorage) return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as LocalDraft<T>;
      return parsed;
    } catch {
      // Corrupted JSON: silently clean up and log debug warning
      console.warn(`[safeGetDraft] Corrupted JSON detected for key "${key}". Purging silently.`);
      window.localStorage.removeItem(key);
      return null;
    }
  } catch (error) {
    console.warn(`[safeGetDraft] Failed to access localStorage for key "${key}":`, error);
    return null;
  }
}

/**
 * Safely saves a draft to localStorage.
 * Removes any previous drafts for other folios so only the currently active folio draft is retained.
 * Handles QuotaExceededError by executing preventive purgeExpiredDrafts() and retrying.
 */
export function safeSaveDraft<T = Record<string, any>>(key: string, draft: LocalDraft<T>): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;

  const serialized = JSON.stringify(draft);

  try {
    const otherDraftKeys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(DRAFT_STORAGE_PREFIX) && k !== key) {
        otherDraftKeys.push(k);
      }
    }
    for (const k of otherDraftKeys) {
      window.localStorage.removeItem(k);
    }

    window.localStorage.setItem(key, serialized);
    return true;
  } catch (error: any) {
    const isQuotaExceeded =
      error?.name === "QuotaExceededError" ||
      error?.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      error?.code === 22 ||
      error?.code === 1014;

    if (isQuotaExceeded) {
      console.warn("[safeSaveDraft] Quota exceeded. Executing preventive purge of expired drafts...");
      try {
        purgeExpiredDrafts(1); // Force aggressive purge of drafts older than 1 day
        window.localStorage.setItem(key, serialized);
        return true;
      } catch (retryError) {
        console.error("[safeSaveDraft] Failed to write draft even after purge:", retryError);
        return false;
      }
    }

    console.error("[safeSaveDraft] Unexpected error writing draft:", error);
    return false;
  }
}
