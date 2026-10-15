"use client";

import React from "react";
import { AIPrediction } from "../../types/aiIndexing";
import { Sparkles, Lock } from "lucide-react";

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
  disabled?: boolean;
  disabledReason?: string;
  onDuplicatePrevious?: (fieldId: string) => void;
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
  disabled = false,
  disabledReason = "Campo heredado del tomo",
  onDuplicatePrevious,
  className = "",
}: AIAssistedInputProps) {
  const confidence = prediction ? Math.round(prediction.confidence * 100) : null;

  const showGreenBadge = !disabled && isPrefilled && !isModified && confidence !== null;
  const showEditedBadge = !disabled && isPrefilled && isModified && confidence !== null;

  const borderClass = disabled
    ? "border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed select-none"
    : showGreenBadge
    ? "border-emerald-400 focus:border-emerald-500 focus:ring-emerald-200"
    : showEditedBadge
    ? "border-slate-300 focus:border-blue-500 focus:ring-blue-100"
    : "border-gray-300 focus:border-blue-500 focus:ring-blue-100";

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (disabled) return;
    if (e.ctrlKey && (e.key === "u" || e.key === "U")) {
      e.preventDefault();
      onChange("<Ilegible>");
    } else if (e.ctrlKey && (e.key === "b" || e.key === "B")) {
      e.preventDefault();
      onChange("<En Blanco>");
    } else if (e.ctrlKey && (e.key === "d" || e.key === "D")) {
      e.preventDefault();
      if (onDuplicatePrevious) {
        onDuplicatePrevious(field.id);
      }
    }
  };

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700" title={disabled ? disabledReason : undefined}>
          <span>{field.label}</span>
          {field.required && !disabled && <span className="text-red-500">*</span>}
          {disabled && (
            <span
              className="inline-flex items-center gap-0.5 text-xs text-gray-400 cursor-help"
              title={disabledReason}
            >
              <Lock className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[11px] font-normal">Heredado</span>
            </span>
          )}
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
          disabled={disabled}
          title={disabled ? disabledReason : undefined}
          className={`w-full border rounded-md p-2 text-sm transition-colors focus:outline-none focus:ring-2 ${borderClass}`}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
        />
      ) : field.type === "dropdown" ? (
        <select
          disabled={disabled}
          title={disabled ? disabledReason : undefined}
          className={`w-full border rounded-md p-2 text-sm bg-white transition-colors focus:outline-none focus:ring-2 ${borderClass}`}
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
          disabled={disabled}
          title={disabled ? disabledReason : undefined}
          className={`w-full border rounded-md p-2 text-sm transition-colors focus:outline-none focus:ring-2 ${borderClass}`}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <input
          type="text"
          disabled={disabled}
          title={disabled ? disabledReason : undefined}
          className={`w-full border rounded-md p-2 text-sm transition-colors focus:outline-none focus:ring-2 ${borderClass}`}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
        />
      )}
    </div>
  );
}

export default AIAssistedInput;
