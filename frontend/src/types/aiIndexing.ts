export type RotationAngle = 0 | 90 | 180 | 270;

export interface BoundingBoxNormalized {
  x: number;       // [0.0, 1.0] porcentaje respecto al ancho de la imagen original
  y: number;       // [0.0, 1.0] porcentaje respecto al alto de la imagen original
  width: number;   // [0.0, 1.0]
  height: number;  // [0.0, 1.0]
}

export interface AIPrediction {
  id: string;
  folioId?: string;
  folio_id?: string;
  fieldKey: string;
  field_key?: string;
  fieldLabel?: string;
  suggestedText: string;
  suggested_text?: string;
  confidence: number; // 0.00 - 1.00
  entry_number?: number;
  entryNumber?: number;
  bbox: BoundingBoxNormalized;
  bbox_array?: [number, number, number, number];
  bbox_coords?: [number, number, number, number];
  isValidSyntax?: boolean;
  modelVersion?: string;
}

export interface FormFieldAIState {
  currentValue: string;
  initialAISuggestion: string | null;
  confidence: number | null;
  isAIPrefilled: boolean;
  isModifiedByUser: boolean;
  activePredictionId: string | null;
}

export interface TrainingDataPayload {
  folio_id: string;
  field_name: string;
  predicted_value: string;
  actual_value: string;
  confidence?: number;
  bbox?: BoundingBoxNormalized;
  action_type?: 'accepted_exact' | 'corrected_text' | 'rejected_blank' | 'manual_inserted';
}

export interface AIMetricsResponse {
  acceptance_rate: number;
  total_suggestions: number;
  total_accepted: number;
  total_corrected: number;
  total_rejected: number;
  by_field?: Record<string, {
    suggestions: number;
    accepted: number;
    corrected: number;
    accuracy: number;
  }>;
}

export interface ViewportTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: RotationAngle;
  naturalWidth: number;
  naturalHeight: number;
}
