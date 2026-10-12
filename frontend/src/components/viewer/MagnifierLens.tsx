"use client";

import React from "react";
import { MagnifierState } from "../../hooks/useImageViewerFilters";

interface MagnifierLensProps {
  imageSrc: string;
  magnifier: MagnifierState;
  filterString: string;
  imageRect: DOMRect | null;
  rotation?: number;
}

export function MagnifierLens({
  imageSrc,
  magnifier,
  filterString,
  imageRect,
  rotation = 0,
}: MagnifierLensProps) {
  if (!magnifier.active || !magnifier.visible || !imageRect || !imageSrc) {
    return null;
  }

  const relX = magnifier.cursorPos.x - imageRect.left;
  const relY = magnifier.cursorPos.y - imageRect.top;

  const isInside =
    relX >= 0 &&
    relX <= imageRect.width &&
    relY >= 0 &&
    relY <= imageRect.height;

  if (!isInside) {
    return null;
  }

  const lensSize = 180;
  const lensRadius = lensSize / 2; // 90px

  return (
    <div
      className="fixed pointer-events-none rounded-full overflow-hidden border-2 border-white/50 shadow-2xl backdrop-blur-xs z-50 select-none bg-black"
      style={{
        width: `${lensSize}px`,
        height: `${lensSize}px`,
        left: `${magnifier.cursorPos.x - lensRadius}px`,
        top: `${magnifier.cursorPos.y - lensRadius}px`,
        willChange: "transform, left, top",
      }}
    >
      {/* Magnified Image Replica */}
      <div
        className="w-full h-full"
        style={{
          backgroundImage: `url(${imageSrc})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: `${imageRect.width * magnifier.zoom}px ${imageRect.height * magnifier.zoom}px`,
          backgroundPosition: `${-relX * magnifier.zoom + lensRadius}px ${-relY * magnifier.zoom + lensRadius}px`,
          filter: filterString,
          transform: rotation ? `rotate(${rotation}deg)` : undefined,
          transformOrigin: "center center",
        }}
      />

      {/* Retícula sutil central */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        {/* Línea horizontal */}
        <div className="absolute w-8 h-[1px] bg-white/40 shadow-xs" />
        {/* Línea vertical */}
        <div className="absolute h-8 w-[1px] bg-white/40 shadow-xs" />
        {/* Anillo central */}
        <div className="w-1.5 h-1.5 rounded-full border border-white/60 bg-white/20" />
      </div>

      {/* Insignia con el aumento actual */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/75 backdrop-blur-xs text-white text-[10px] font-mono px-2 py-0.5 rounded-full border border-white/20 shadow-md">
        {magnifier.zoom.toFixed(1)}x
      </div>
    </div>
  );
}

export default MagnifierLens;
