import {
  buildDraftStorageKey,
  purgeExpiredDrafts,
  safeGetDraft,
  safeSaveDraft,
  DRAFT_STORAGE_PREFIX,
} from "./draftStorage";
import { LocalDraft } from "../types/autosave";

// Mock localStorage in Node environment if not present
class LocalStorageMock {
  private store: Record<string, string> = {};

  get length(): number {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

describe("draftStorage utility tests", () => {
  beforeEach(() => {
    (global as any).window = {
      localStorage: new LocalStorageMock(),
    };
  });

  afterEach(() => {
    if ((global as any).window?.localStorage) {
      (global as any).window.localStorage.clear();
    }
  });

  test("buildDraftStorageKey produces expected tenant and folio scoped key", () => {
    const key = buildDraftStorageKey("tenant_carupano", "folio_123");
    expect(key).toBe("codexflow_draft_tenant_carupano_folio_123");
  });

  test("safeSaveDraft writes and safeGetDraft reads correctly", () => {
    const key = buildDraftStorageKey("tenant_carupano", "folio_123");
    const draft: LocalDraft = {
      version: 1,
      tenantId: "tenant_carupano",
      folioId: "folio_123",
      formData: { nombres: "Juan", apellidos: "Perez" },
      viewerState: { zoom: 1.5, pan: { x: 10, y: 20 }, rotation: 0 },
      updatedAt: Date.now(),
    };

    const saved = safeSaveDraft(key, draft);
    expect(saved).toBe(true);

    const retrieved = safeGetDraft(key);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.formData.nombres).toBe("Juan");
    expect(retrieved?.viewerState.zoom).toBe(1.5);
  });

  test("safeGetDraft silently purges corrupted JSON and returns null", () => {
    const key = buildDraftStorageKey("tenant_carupano", "corrupt_folio");
    (global as any).window.localStorage.setItem(key, "not_valid_json{{{");

    const retrieved = safeGetDraft(key);
    expect(retrieved).toBeNull();
    expect((global as any).window.localStorage.getItem(key)).toBeNull();
  });

  test("purgeExpiredDrafts deletes drafts older than 7 days", () => {
    const now = Date.now();
    const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;
    const oneDayAgo = now - 1 * 24 * 60 * 60 * 1000;

    const expiredKey = buildDraftStorageKey("t1", "f_expired");
    const freshKey = buildDraftStorageKey("t1", "f_fresh");

    (global as any).window.localStorage.setItem(
      expiredKey,
      JSON.stringify({ tenantId: "t1", folioId: "f_expired", updatedAt: eightDaysAgo })
    );
    (global as any).window.localStorage.setItem(
      freshKey,
      JSON.stringify({ tenantId: "t1", folioId: "f_fresh", updatedAt: oneDayAgo })
    );

    purgeExpiredDrafts(7);

    expect((global as any).window.localStorage.getItem(expiredKey)).toBeNull();
    expect((global as any).window.localStorage.getItem(freshKey)).not.toBeNull();
  });
});
