import {
  transformBBoxRotation,
  isValidPredictionSyntax,
  shouldPrefillPrediction,
} from "./aiGeometry";
import { BoundingBoxNormalized } from "../types/aiIndexing";

describe("aiGeometry utils", () => {
  const originalBox: BoundingBoxNormalized = {
    x: 0.1,
    y: 0.2,
    width: 0.3,
    height: 0.4,
  };

  test("rotation 0 degrees preserves coordinates", () => {
    const result = transformBBoxRotation(originalBox, 0);
    expect(result).toEqual(originalBox);
  });

  test("rotation 90 degrees transforms clockwise", () => {
    // 90deg CW: x' = 1 - y - h = 1 - 0.2 - 0.4 = 0.4, y' = x = 0.1, w' = h = 0.4, h' = w = 0.3
    const result = transformBBoxRotation(originalBox, 90);
    expect(result.x).toBeCloseTo(0.4);
    expect(result.y).toBeCloseTo(0.1);
    expect(result.width).toBeCloseTo(0.4);
    expect(result.height).toBeCloseTo(0.3);
  });

  test("rotation 180 degrees transforms coordinates", () => {
    // 180deg: x' = 1 - x - w = 1 - 0.1 - 0.3 = 0.6, y' = 1 - y - h = 1 - 0.2 - 0.4 = 0.4
    const result = transformBBoxRotation(originalBox, 180);
    expect(result.x).toBeCloseTo(0.6);
    expect(result.y).toBeCloseTo(0.4);
    expect(result.width).toBeCloseTo(0.3);
    expect(result.height).toBeCloseTo(0.4);
  });

  test("rotation 270 degrees transforms coordinates", () => {
    // 270deg CW: x' = y = 0.2, y' = 1 - x - w = 0.6, w' = h = 0.4, h' = w = 0.3
    const result = transformBBoxRotation(originalBox, 270);
    expect(result.x).toBeCloseTo(0.2);
    expect(result.y).toBeCloseTo(0.6);
    expect(result.width).toBeCloseTo(0.4);
    expect(result.height).toBeCloseTo(0.3);
  });

  test("confidence threshold rule (80%)", () => {
    expect(shouldPrefillPrediction(0.85, "Pedro Perez", "text")).toBe(true);
    expect(shouldPrefillPrediction(0.80, "Pedro Perez", "text")).toBe(true);
    expect(shouldPrefillPrediction(0.79, "Pedro Perez", "text")).toBe(false);
    expect(shouldPrefillPrediction(0.50, "Pedro Perez", "text")).toBe(false);
  });

  test("date syntax validation", () => {
    expect(isValidPredictionSyntax("1845-05-12", "date")).toBe(true);
    expect(isValidPredictionSyntax("invalid-date", "date")).toBe(false);
    expect(shouldPrefillPrediction(0.95, "invalid-date", "date")).toBe(false);
    expect(shouldPrefillPrediction(0.95, "1845-05-12", "date")).toBe(true);
  });
});
