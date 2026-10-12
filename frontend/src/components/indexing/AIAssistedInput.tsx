"use client";

import React from "react";
import { AIPrediction } from "../../types/aiIndexing";
import { Sparkles } from "lucide-react";

interface AIAssistedInputProps {
  field: {
    id: string;
    label: string;
    type?: string;
    required?: boolean;
    options?: string[];
  };
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  prediction?: AIPrediction;
  isPrefilled?: boolean;
  isModified?: boolean;
  className?: string;
}

export function AIAssistedInput({
  field,
  value,
  onChange,
  onFocus,
  onBlur,
  prediction,
  isPrefilled = false,
  isModified = false,
  className = "",
}: AIAssistedInputProps) {
  const confidence = prediction ? Math.round(prediction.confidence * 100) : null;

  // Badge state:
  // - Prefilled by IA and untouched: Green badge "IA: X%"
  // - Prefilled by IA but edited: Gray/slate badge "Editado" or subtle tag
  // - Low confidence (<80%): discrete clickable suggestion pill if user wants to use it
  const showGreenBadge = isPrefilled && !isModified && confidence !== null;
  const showEditedBadge = isPrefilled && isModified && confidence !== null;

  const borderClass = showGreenBadge
    ? "border-emerald-400 focus:border-emerald-500 focus:ring-emerald-200"
    : showEditedBadge
    ? "border-slate-300 focus:border-blue-500 focus:ring-blue-100"
    : "border-gray-300 focus:border-blue-500 focus:ring-blue-100";

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          {field.label} {field.required && <span className="text-red-500">*</span>}
        </label>

        {/* AI Origin Badge */}
        {showGreenBadge && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 transition-colors shadow-2xs"
            title={`Sugerido por IA con ${confidence}% de confianza`}
          >
            <Sparkles className="w-3 h-3 text-emerald-600" />
            IA: {confidence}%
          </span>
        )}

        {showEditedBadge && (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono text-gray-400 bg-gray-100 border border-gray-200"
            title={`Originalmente sugerido por IA (${confidence}%) y editado por el usuario`}
          >
            Editado (IA: {confidence}%)
          </span>
        )}
      </div>

      {field.type === "long_text" ? (
        <textarea
          rows={3}
          className={`w-full border rounded-md p-2 text-sm text-gray-900 transition-colors focus:outline-none focus:ring-2 ${borderClass}`}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      ) : field.type === "dropdown" ? (
        <select
          className={`w-full border rounded-md p-2 text-sm text-gray-900 bg-white transition-colors focus:outline-none focus:ring-2 ${borderClass}`}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
        >
          <option value="">-- Seleccionar --</option>
          {field.options?.map((opt: string, idx: number) => (
            <option key={idx} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : field.type === "date" ? (
        <input
          type="date"
          className={`w-full border rounded-md p-2 text-sm text-gray-900 transition-colors focus:outline-none focus:ring-2 ${borderClass}`}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      ) : (
        <input
          type="text"
          className={`w-full border rounded-md p-2 text-sm text-gray-900 transition-colors focus:outline-none focus:ring-2 ${borderClass}`}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      )}
    </div>
  );
}

export default AIAssistedInput;
