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
        className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-600 text-xs font-medium animate-pulse"
        title="Sin conexión a Internet. Todos tus cambios y transcripciones se resguardan de forma segura en memoria local."
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        </span>
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
        className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-600 text-xs font-medium transition-all"
      >
        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-500" />
        <span>Conexión Restablecida</span>
      </div>
    );
  }

  // En modo online habitual, indicador discreto
  return (
    <div
      className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 text-gray-400 hover:text-emerald-600 transition-colors text-xs font-normal"
      title="Conectado al servidor"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
      <span className="text-[11px] text-gray-500">Conectado</span>
    </div>
  );
}
