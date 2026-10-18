"use client";

import React, { useState, useEffect } from "react";
import { WifiOff, CheckCircle2 } from "lucide-react";

export default function NetworkStatusIndicator() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [justReconnected, setJustReconnected] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setJustReconnected(true);
      // Disparar evento para reintentar sincronización de borradores locales
      window.dispatchEvent(new CustomEvent("network-status-online"));
      const timer = setTimeout(() => {
        setJustReconnected(false);
      }, 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setJustReconnected(false);
      window.dispatchEvent(new CustomEvent("network-status-offline"));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3.5 py-1.5 bg-amber-600 text-white rounded-full shadow-lg text-xs font-medium animate-pulse"
        title="Sin conexión a Internet. Todos tus cambios y transcripciones se resguardan de forma segura en memoria local."
      >
        <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
        <span>Modo Local (Sin Conexión) — Tus cambios se respaldan en memoria</span>
      </div>
    );
  }

  if (justReconnected) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600 text-white rounded-full shadow-lg text-xs font-medium"
      >
        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
        <span>Conexión Restablecida</span>
      </div>
    );
  }

  return null;
}
