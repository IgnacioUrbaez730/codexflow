"use client";

import React, { useState } from "react";
import { AIPrediction } from "../../types/aiIndexing";

interface AIBoundingBoxItemProps {
  prediction: AIPrediction;
  isActive: boolean;
  boxX: number;
  boxY: number;
  boxWidth: number;
  boxHeight: number;
  onClick: (prediction: AIPrediction) => void;
}

export function AIBoundingBoxItem({
  prediction,
  isActive,
  boxX,
  boxY,
  boxWidth,
  boxHeight,
  onClick,
}: AIBoundingBoxItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const confidencePercent = Math.round(prediction.confidence * 100);

  // Styling based on state:
  // Active: yellow glowing #F59E0B
  // Normal high confidence (>= 80%): green #10B981
  // Normal medium confidence (< 80%): blue #3B82F6
  const isHighConfidence = prediction.confidence >= 0.8;
  const strokeColor = isActive
    ? "#F59E0B"
    : isHighConfidence
    ? "#10B981"
    : "#3B82F6";
  const fillColor = isActive
    ? "rgba(245, 158, 11, 0.28)"
    : isHighConfidence
    ? "rgba(16, 185, 129, 0.18)"
    : "rgba(59, 130, 246, 0.18)";

  const strokeWidth = isActive ? 3 : isHovered ? 2.5 : 1.5;

  return (
    <g
      className="cursor-pointer transition-all duration-150 select-none group"
      style={{ pointerEvents: "auto" }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onClick(prediction);
      }}
    >
      {/* Glow effect for active box */}
      {isActive && (
        <rect
          x={boxX - 2}
          y={boxY - 2}
          width={boxWidth + 4}
          height={boxHeight + 4}
          fill="none"
          stroke="#F59E0B"
          strokeWidth={5}
          strokeOpacity={0.4}
          rx={3}
          style={{ filter: "drop-shadow(0 0 6px rgba(245, 158, 11, 0.75))" }}
        />
      )}

      {/* Main bounding box rectangle */}
      <rect
        x={boxX}
        y={boxY}
        width={boxWidth}
        height={boxHeight}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={!isHighConfidence && !isActive ? "4,2" : undefined}
        rx={2}
      />

      {/* Badge on hover or active */}
      {(isActive || isHovered) && (
        <g transform={`translate(${boxX}, ${Math.max(16, boxY - 6)})`}>
          <rect
            x={0}
            y={-14}
            width={Math.max(60, (prediction.suggestedText?.length || 5) * 7.5 + 45)}
            height={16}
            rx={3}
            fill={isActive ? "#B45309" : "#1F2937"}
            opacity={0.92}
          />
          <text
            x={5}
            y={-3}
            fill="#FFFFFF"
            fontSize="10"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {prediction.fieldKey}: {confidencePercent}%
          </text>
        </g>
      )}
    </g>
  );
}

export default AIBoundingBoxItem;
