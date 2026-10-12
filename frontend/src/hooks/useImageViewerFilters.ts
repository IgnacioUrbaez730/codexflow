"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

export interface ImageFilterState {
  brightness: number; // 50 to 200 (default: 100)
  contrast: number;   // 50 to 250 (default: 100)
  sharpness: number;  // 0 to 100 (default: 0)
  invert: boolean;    // default: false
  grayscale: boolean; // default: false
  binarized: boolean; // default: false
}

export interface MagnifierState {
  active: boolean;
  zoom: number;       // 1.5 to 5.0 (default: 2.5)
  cursorPos: { x: number; y: number };
  imagePos: { x: number; y: number };
  visible: boolean;
}

export const initialFilterState: ImageFilterState = {
  brightness: 100,
  contrast: 100,
  sharpness: 0,
  invert: false,
  grayscale: false,
  binarized: false,
};

export const initialMagnifierState: MagnifierState = {
  active: false,
  zoom: 2.5,
  cursorPos: { x: 0, y: 0 },
  imagePos: { x: 0, y: 0 },
  visible: false,
};

export function buildCSSFilterString(filters: ImageFilterState): string {
  if (filters.binarized) {
    const parts = [
      "contrast(200%)",
      "grayscale(100%)",
      `brightness(${Math.round(filters.brightness * 1.1)}%)`,
    ];
    if (filters.invert) {
      parts.push("invert(100%)");
    }
    return parts.join(" ");
  }

  const effectiveContrast = filters.contrast * (1 + filters.sharpness / 200);
  const parts = [
    `brightness(${filters.brightness}%)`,
    `contrast(${effectiveContrast}%)`,
  ];

  if (filters.grayscale) {
    parts.push("grayscale(100%)");
  }

  if (filters.invert) {
    parts.push("invert(100%)");
  }

  return parts.join(" ");
}

export function useImageViewerFilters() {
  const [filters, setFilters] = useState<ImageFilterState>(initialFilterState);
  const [magnifier, setMagnifier] = useState<MagnifierState>(initialMagnifierState);

  const resetFilters = useCallback(() => {
    setFilters(initialFilterState);
  }, []);

  const resetMagnifier = useCallback(() => {
    setMagnifier(initialMagnifierState);
  }, []);

  const updateFilter = useCallback(<K extends keyof ImageFilterState>(
    key: K,
    value: ImageFilterState[K]
  ) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const toggleMagnifier = useCallback(() => {
    setMagnifier((prev) => ({
      ...prev,
      active: !prev.active,
      visible: !prev.active ? prev.visible : false,
    }));
  }, []);

  const toggleInvert = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      invert: !prev.invert,
    }));
  }, []);

  const toggleGrayscale = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      grayscale: !prev.grayscale,
    }));
  }, []);

  const toggleBinarized = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      binarized: !prev.binarized,
    }));
  }, []);

  const setMagnifierZoom = useCallback((zoomOrFn: number | ((prev: number) => number)) => {
    setMagnifier((prev) => {
      const nextZoom = typeof zoomOrFn === "function" ? zoomOrFn(prev.zoom) : zoomOrFn;
      const clampedZoom = Math.max(1.5, Math.min(5.0, Math.round(nextZoom * 100) / 100));
      return {
        ...prev,
        zoom: clampedZoom,
      };
    });
  }, []);

  // Global Keyboard Shortcuts (L for Magnifier, I for Invert)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (typeof document === "undefined") return;

      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          activeEl.getAttribute("contenteditable") === "true");

      if (isInput) return;

      if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        toggleMagnifier();
      } else if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        toggleInvert();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleMagnifier, toggleInvert]);

  const filterString = useMemo(() => buildCSSFilterString(filters), [filters]);

  return {
    filters,
    setFilters,
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
  };
}
