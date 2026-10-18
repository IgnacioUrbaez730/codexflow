"use client";

import React from 'react';
import { Info, AlertTriangle, Lightbulb, BookMarked } from 'lucide-react';
import { CalloutBox } from '@/data/manualContent';

interface ManualCalloutProps {
  callout: CalloutBox;
}

export default function ManualCallout({ callout }: ManualCalloutProps) {
  const getCalloutConfig = (type: CalloutBox['type']) => {
    switch (type) {
      case 'note':
        return {
          wrapperClass: 'bg-blue-50/70 border-blue-200 text-blue-950 dark:bg-blue-950/20 dark:border-blue-800 dark:text-blue-200',
          badgeClass: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/60 dark:text-blue-300 dark:border-blue-700',
          iconClass: 'text-blue-600 dark:text-blue-400',
          Icon: Info,
          defaultLabel: 'Nota Operativa',
        };
      case 'warning':
        return {
          wrapperClass: 'bg-amber-50/70 border-amber-200 text-amber-950 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-200',
          badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/60 dark:text-amber-300 dark:border-amber-700',
          iconClass: 'text-amber-600 dark:text-amber-400',
          Icon: AlertTriangle,
          defaultLabel: 'Advertencia Crítica',
        };
      case 'tip':
        return {
          wrapperClass: 'bg-emerald-50/70 border-emerald-200 text-emerald-950 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-200',
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-300 dark:border-emerald-700',
          iconClass: 'text-emerald-600 dark:text-emerald-400',
          Icon: Lightbulb,
          defaultLabel: 'Consejo Práctico',
        };
      case 'archival':
      default:
        return {
          wrapperClass: 'bg-indigo-50/70 border-indigo-200 text-indigo-950 dark:bg-indigo-950/20 dark:border-indigo-800 dark:text-indigo-200',
          badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/60 dark:text-indigo-300 dark:border-indigo-700',
          iconClass: 'text-indigo-600 dark:text-indigo-400',
          Icon: BookMarked,
          defaultLabel: 'Criterio Archivístico Canónico',
        };
    }
  };

  const config = getCalloutConfig(callout.type);
  const IconComponent = config.Icon;

  return (
    <div
      role="region"
      aria-label={callout.title || config.defaultLabel}
      className={`my-4 rounded-xl border p-4 sm:p-5 transition-all shadow-xs ${config.wrapperClass}`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 shrink-0 rounded-lg p-1.5 ${config.iconClass}`}>
          <IconComponent className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <h4 className="text-sm font-semibold tracking-tight">
              {callout.title}
            </h4>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border uppercase tracking-wider ${config.badgeClass}`}
            >
              {config.defaultLabel}
            </span>
          </div>
          <p className="text-sm leading-relaxed opacity-90 font-normal">
            {callout.content}
          </p>
        </div>
      </div>
    </div>
  );
}
