"use client";

import React from "react";
import { History, X } from "lucide-react";

interface AutosaveRestoreToastProps {
  show: boolean;
  onDismiss: () => void;
  message?: string;
}

export function AutosaveRestoreToast({
  show,
  onDismiss,
  message = "Se restauró un borrador no guardado de tu sesión anterior",
}: AutosaveRestoreToastProps) {
  if (!show) return null;

  return (
    <div
      role="status"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl border border-gray-700 max-w-md animate-slide-up transition-all"
    >
      <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg shrink-0">
        <History className="w-5 h-5" />
      </div>
      <p className="text-sm font-medium leading-snug flex-1">{message}</p>
      <button
        onClick={onDismiss}
        className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-gray-800 transition-colors"
        aria-label="Cerrar notificación"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
