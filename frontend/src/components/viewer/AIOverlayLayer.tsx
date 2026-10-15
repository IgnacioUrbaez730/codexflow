"use client";

import React from "react";
import { AIPrediction, RotationAngle } from "../../types/aiIndexing";
import { transformBBoxRotation } from "../../utils/aiGeometry";
import { AIBoundingBoxItem } from "./AIBoundingBoxItem";

interface AIOverlayLayerProps {
  predictions: AIPrediction[];
  activeFieldKey?: string | null;
  activeEntryNumber?: number;
  activeEntryBoundingBox?: {
    ymin?: number;
    xmin?: number;
    ymax?: number;
    xmax?: number;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  } | null;
  hasMultipleEntries?: boolean;
  visible?: boolean;
  rotation?: number | RotationAngle;
  imageWidth: number;
  imageHeight: number;
  onSelectPrediction: (prediction: AIPrediction) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function AIOverlayLayer({
  predictions = [],
  activeFieldKey,
  activeEntryNumber,
  activeEntryBoundingBox,
  hasMultipleEntries = false,
  visible = true,
  rotation = 0,
  imageWidth,
  imageHeight,
  onSelectPrediction,
  className = "",
  style = {},
}: AIOverlayLayerProps) {
  if (!visible || !predictions || predictions.length === 0 || !imageWidth || !imageHeight) {
    return null;
  }

  const isRotated90or270 = rotation % 180 !== 0;
  const effW = isRotated90or270 ? imageHeight : imageWidth;
  const effH = isRotated90or270 ? imageWidth : imageHeight;

  return (
    <svg
      viewBox={`0 0 ${effW} ${effH}`}
      className={`absolute inset-0 w-full h-full pointer-events-none select-none z-10 ${className}`}
      style={style}
    >
      <defs>
        <filter id="ai-active-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {predictions.map((pred) => {
        // Compensate coordinates for 0, 90, 180, 270 degrees
        const rotBBox = transformBBoxRotation(pred.bbox, (rotation as RotationAngle) || 0);
        const boxX = rotBBox.x * effW;
        const boxY = rotBBox.y * effH;
        const boxWidth = rotBBox.width * effW;
        const boxHeight = rotBBox.height * effH;

        const isActive = Boolean(
          activeFieldKey &&
            (pred.fieldKey === activeFieldKey || pred.field_key === activeFieldKey)
        );

        let isDimmed = false;
        if (hasMultipleEntries && activeEntryNumber && !isActive) {
          const predEntry = pred.entry_number || pred.entryNumber;
          if (predEntry !== undefined) {
            isDimmed = predEntry !== activeEntryNumber;
          } else if (activeEntryBoundingBox) {
            const minX = activeEntryBoundingBox.xmin ?? activeEntryBoundingBox.x ?? 0;
            const minY = activeEntryBoundingBox.ymin ?? activeEntryBoundingBox.y ?? 0;
            const maxX = activeEntryBoundingBox.xmax ?? (minX + (activeEntryBoundingBox.width ?? 1));
            const maxY = activeEntryBoundingBox.ymax ?? (minY + (activeEntryBoundingBox.height ?? 1));
            const centerX = pred.bbox.x + pred.bbox.width / 2;
            const centerY = pred.bbox.y + pred.bbox.height / 2;
            const isInside = centerX >= minX && centerX <= maxX && centerY >= minY && centerY <= maxY;
            isDimmed = !isInside;
          }
        }

        return (
          <AIBoundingBoxItem
            key={pred.id || `${pred.fieldKey}-${pred.bbox.x}-${pred.bbox.y}`}
            prediction={pred}
            isActive={isActive}
            isDimmed={isDimmed}
            boxX={boxX}
            boxY={boxY}
            boxWidth={boxWidth}
            boxHeight={boxHeight}
            onClick={onSelectPrediction}
          />
        );
      })}
    </svg>
  );
}

export default AIOverlayLayer;
