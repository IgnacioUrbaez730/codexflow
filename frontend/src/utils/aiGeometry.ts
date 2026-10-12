import { BoundingBoxNormalized, RotationAngle } from "../types/aiIndexing";

/**
 * Rotates normalized bounding box coordinates for angles 0, 90, 180, 270 degrees clockwise.
 * Coords are in [0, 1] relative to the original image dimensions.
 */
export function transformBBoxRotation(
  bbox: BoundingBoxNormalized,
  rotation: RotationAngle | number
): BoundingBoxNormalized {
  const normRot = ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;
  const { x, y, width, height } = bbox;

  switch (normRot) {
    case 90:
      return {
        x: Math.max(0, 1 - y - height),
        y: x,
        width: height,
        height: width,
      };
    case 180:
      return {
        x: Math.max(0, 1 - x - width),
        y: Math.max(0, 1 - y - height),
        width,
        height,
      };
    case 270:
      return {
        x: y,
        y: Math.max(0, 1 - x - width),
        width: height,
        height: width,
      };
    case 0:
    default:
      return { x, y, width, height };
  }
}

/**
 * Validates syntax of prediction values, specifically checking ISO dates if field is date.
 */
export function isValidPredictionSyntax(value: string, fieldType?: string): boolean {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;

  if (fieldType === "date") {
    // Check YYYY-MM-DD or parseable valid date
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!isoDateRegex.test(trimmed)) {
      const parsed = Date.parse(trimmed);
      return !isNaN(parsed);
    }
    const [y, m, d] = trimmed.split("-").map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1500 || y > 2100) {
      return false;
    }
  }

  return true;
}

/**
 * Rule: prefill only if confidence is >= 0.80 (80%) AND syntax is valid.
 */
export function shouldPrefillPrediction(
  confidence: number,
  suggestedText: string,
  fieldType?: string
): boolean {
  if (confidence < 0.80) {
    return false;
  }
  return isValidPredictionSyntax(suggestedText, fieldType);
}
