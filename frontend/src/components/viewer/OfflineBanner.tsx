"use client";

import React from "react";
import { WifiOff } from "lucide-react";

interface OfflineBannerProps {
  isOnline: boolean;
}

export function OfflineBanner({ isOnline }: OfflineBannerProps) {
  if (isOnline) return null;

  return (
    <div
      role="alert"
      className="w-full bg-amber-500 text-amber-950 px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 shadow-md z-50 sticky top-0 transition-all duration-300 border-b border-amber-600"
    >
      <WifiOff className="w-4 h-4 shrink-0 animate-bounce" />
      <span>
        Sin conexión: Tu trabajo se sigue guardando localmente; podrás sincronizar cuando vuelva internet
      </span>
    </div>
  );
}
