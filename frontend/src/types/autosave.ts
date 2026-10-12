export interface ViewerState {
  zoom: number;
  pan: { x: number; y: number };
  panX?: number;
  panY?: number;
  rotation: number;
}

export interface LocalDraft<T = Record<string, any>> {
  version: number;
  tenantId: string;
  folioId: string;
  formData: T;
  modifiedFields?: string[];
  viewerState: ViewerState;
  updatedAt: number;
  timestamp?: number;
}

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";
