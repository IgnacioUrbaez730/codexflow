"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sliders, RotateCcw, X } from "lucide-react";
import { ImageFilterState } from "../../hooks/useImageViewerFilters";

interface FilterControlsPopoverProps {
  filters: ImageFilterState;
  updateFilter: <K extends keyof ImageFilterState>(key: K, value: ImageFilterState[K]) => void;
  resetFilters: () => void;
  toggleInvert: () => void;
  toggleGrayscale: () => void;
  toggleBinarized: () => void;
}

export function FilterControlsPopover({
  filters,
  updateFilter,
  resetFilters,
  toggleInvert,
  toggleGrayscale,
  toggleBinarized,
}: FilterControlsPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  const hasActiveFilters =
    filters.brightness !== 100 ||
    filters.contrast !== 100 ||
    filters.sharpness !== 0 ||
    filters.invert ||
    filters.grayscale ||
    filters.binarized;

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`px-2.5 py-1 flex items-center gap-1.5 rounded text-xs font-medium transition-colors cursor-pointer select-none ${
          isOpen || hasActiveFilters
            ? "bg-purple-600 text-white shadow-sm"
            : "hover:bg-gray-700 text-gray-200"
        }`}
        title="Filtros de Legibilidad"
        aria-label="Filtros de Legibilidad"
      >
        <Sliders className="w-3.5 h-3.5" />
        <span>Filtros</span>
        {hasActiveFilters && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        )}
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div
          className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-72 bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-xl p-4 shadow-2xl text-xs text-gray-200 z-50 space-y-4 animate-in fade-in zoom-in-95 duration-100"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="font-semibold text-gray-100 border-b border-gray-700/80 pb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-purple-400" />
              Suite de Mejora Visual
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white p-0.5 rounded cursor-pointer"
              aria-label="Cerrar filtros"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Toggles */}
          <div className="space-y-2 pt-1 border-b border-gray-800 pb-3">
            <label className="flex items-center justify-between cursor-pointer hover:text-white select-none">
              <span className="flex items-center gap-1.5">
                Invertir
                <kbd className="text-[10px] bg-gray-800 border border-gray-700 px-1 py-0.2 rounded text-gray-300">
                  I
                </kbd>
              </span>
              <input
                type="checkbox"
                checked={filters.invert}
                onChange={toggleInvert}
                className="rounded bg-gray-800 border-gray-600 text-purple-600 focus:ring-0 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer hover:text-white select-none">
              <span>B/N (Escala de grises)</span>
              <input
                type="checkbox"
                checked={filters.grayscale}
                onChange={toggleGrayscale}
                className="rounded bg-gray-800 border-gray-600 text-purple-600 focus:ring-0 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer hover:text-white select-none">
              <span className="text-amber-300 font-medium">Modo Binarizado (Alto contraste)</span>
              <input
                type="checkbox"
                checked={filters.binarized}
                onChange={toggleBinarized}
                className="rounded bg-gray-800 border-gray-600 text-amber-500 focus:ring-0 cursor-pointer"
              />
            </label>
          </div>

          {/* Sliders */}
          <div className="space-y-3">
            {/* Brillo */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-gray-300">
                <span>Brillo</span>
                <span className="font-mono text-purple-300">{filters.brightness}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="200"
                value={filters.brightness}
                onChange={(e) => updateFilter("brightness", Number(e.target.value))}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            {/* Contraste */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-gray-300">
                <span>Contraste</span>
                <span className="font-mono text-purple-300">{filters.contrast}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="250"
                value={filters.contrast}
                onChange={(e) => updateFilter("contrast", Number(e.target.value))}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            {/* Nitidez */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-gray-300">
                <span>Nitidez</span>
                <span className="font-mono text-purple-300">{filters.sharpness}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={filters.sharpness}
                onChange={(e) => updateFilter("sharpness", Number(e.target.value))}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>
          </div>

          {/* Reset Filters */}
          <button
            type="button"
            onClick={resetFilters}
            className="w-full py-1.5 px-3 flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-gray-750 text-gray-300 hover:text-white rounded-lg text-xs border border-gray-700 transition cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            Restablecer Filtros
          </button>
        </div>
      )}
    </div>
  );
}

export default FilterControlsPopover;
