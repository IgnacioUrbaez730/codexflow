"use client";

import React from "react";
import { Check, Cloud, RefreshCw, AlertCircle } from "lucide-react";
import { AutosaveStatus } from "../../types/autosave";

interface AutosaveBadgeProps {
  status: AutosaveStatus;
  lastSavedAt?: number | null;
  className?: string;
}

export function AutosaveBadge({ status, lastSavedAt, className = "" }: AutosaveBadgeProps) {
  if (status === "idle" && !lastSavedAt) {
    return null;
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-300 ${
        status === "saving"
          ? "bg-blue-50 text-blue-700 border border-blue-200"
          : status === "saved"
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs"
          : status === "error"
          ? "bg-rose-50 text-rose-700 border border-rose-200"
          : "bg-gray-100 text-gray-600 border border-gray-200"
      } ${className}`}
      title={
        lastSavedAt
          ? `Último guardado local: ${new Date(lastSavedAt).toLocaleTimeString()}`
          : undefined
      }
    >
      {status === "saving" ? (
        <>
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
          <span>Guardando...</span>
        </>
      ) : status === "saved" ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
          <span>Guardado local</span>
        </>
      ) : status === "error" ? (
        <>
          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          <span>Error guardado local</span>
        </>
      ) : (
        <>
          <Cloud className="w-3.5 h-3.5 text-gray-500" />
          <span>Guardado local</span>
        </>
      )}
    </div>
  );
}
