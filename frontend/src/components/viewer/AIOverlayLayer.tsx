"use client";

import React from "react";
import { AIPrediction, RotationAngle } from "../../types/aiIndexing";
import { transformBBoxRotation } from "../../utils/aiGeometry";
import { AIBoundingBoxItem } from "./AIBoundingBoxItem";

interface AIOverlayLayerProps {
  predictions: AIPrediction[];
  activeFieldKey?: string | null;
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

        return (
          <AIBoundingBoxItem
            key={pred.id || `${pred.fieldKey}-${pred.bbox.x}-${pred.bbox.y}`}
            prediction={pred}
            isActive={isActive}
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
