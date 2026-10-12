"use client";

import React from "react";
import { MagnifierState } from "../../hooks/useImageViewerFilters";
import { AIPrediction } from "../../types/aiIndexing";

interface MagnifierLensProps {
  imageSrc: string;
  magnifier: MagnifierState;
  filterString: string;
  imageRect?: DOMRect | null;
  imgRef?: React.RefObject<HTMLImageElement | null>;
  rotation?: number;
  predictions?: AIPrediction[];
  activeFieldKey?: string | null;
  showOverlay?: boolean;
}

export function MagnifierLens({
  imageSrc,
  magnifier,
  filterString,
  imageRect,
  imgRef,
  rotation = 0,
  predictions = [],
  activeFieldKey = null,
  showOverlay = true,
}: MagnifierLensProps) {
  const currentRect = imgRef?.current ? imgRef.current.getBoundingClientRect() : imageRect;

  if (!magnifier.active || !magnifier.visible || !currentRect || !imageSrc) {
    return null;
  }

  const relX = magnifier.cursorPos.x - currentRect.left;
  const relY = magnifier.cursorPos.y - currentRect.top;

  const isInside =
    relX >= 0 &&
    relX <= currentRect.width &&
    relY >= 0 &&
    relY <= currentRect.height;

  if (!isInside) {
    return null;
  }

  const lensSize = 180;
  const lensRadius = lensSize / 2; // 90px

  const magnifiedWidth = currentRect.width * magnifier.zoom;
  const magnifiedHeight = currentRect.height * magnifier.zoom;
  const offsetX = -relX * magnifier.zoom + lensRadius;
  const offsetY = -relY * magnifier.zoom + lensRadius;

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
          backgroundSize: `${magnifiedWidth}px ${magnifiedHeight}px`,
          backgroundPosition: `${offsetX}px ${offsetY}px`,
          filter: filterString,
          transform: rotation ? `rotate(${rotation}deg)` : undefined,
          transformOrigin: "center center",
        }}
      />

      {/* Synchronized Projected Bounding Boxes within Lens */}
      {showOverlay && predictions && predictions.length > 0 && (
        <div
          className="absolute pointer-events-none"
          style={{
            width: `${magnifiedWidth}px`,
            height: `${magnifiedHeight}px`,
            left: `${offsetX}px`,
            top: `${offsetY}px`,
            transform: rotation ? `rotate(${rotation}deg)` : undefined,
            transformOrigin: "center center",
          }}
        >
          <svg
            className="w-full h-full"
            viewBox="0 0 1000 1000"
            preserveAspectRatio="none"
          >
            {predictions.map((pred) => {
              const isActive = Boolean(
                activeFieldKey &&
                  (pred.fieldKey === activeFieldKey || pred.field_key === activeFieldKey)
              );
              const isHighConfidence = pred.confidence >= 0.8;
              const strokeColor = isActive
                ? "#F59E0B"
                : isHighConfidence
                ? "#10B981"
                : "#3B82F6";
              const fillColor = isActive
                ? "rgba(245, 158, 11, 0.35)"
                : isHighConfidence
                ? "rgba(16, 185, 129, 0.2)"
                : "rgba(59, 130, 246, 0.2)";

              return (
                <rect
                  key={`lens-${pred.id || pred.fieldKey}-${pred.bbox.x}`}
                  x={pred.bbox.x * 1000}
                  y={pred.bbox.y * 1000}
                  width={pred.bbox.width * 1000}
                  height={pred.bbox.height * 1000}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={isActive ? 3 : 1.5}
                  rx={2}
                />
              );
            })}
          </svg>
        </div>
      )}

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
