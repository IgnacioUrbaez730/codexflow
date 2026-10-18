"use client";

import React, { useState, useMemo } from 'react';
import { Keyboard, Command, Sparkles, Filter } from 'lucide-react';
import { ShortcutItem } from '@/data/manualContent';

interface ManualCheatSheetProps {
  shortcuts: ShortcutItem[];
  title?: string;
  description?: string;
}

export default function ManualCheatSheet({
  shortcuts,
  title = "Cheat Sheet de Atajos de Teclado",
  description = "Domina el flujo de indexación y arbitraje a máxima velocidad sin depender del ratón.",
}: ManualCheatSheetProps) {
  const [selectedContext, setSelectedContext] = useState<string>('all');

  // Extract unique contexts for filtering
  const contexts = useMemo(() => {
    const set = new Set<string>();
    shortcuts.forEach((s) => {
      if (s.context) {
        set.add(s.context);
      }
    });
    return Array.from(set);
  }, [shortcuts]);

  const filteredShortcuts = useMemo(() => {
    if (selectedContext === 'all') return shortcuts;
    return shortcuts.filter((s) => s.context === selectedContext);
  }, [shortcuts, selectedContext]);

  return (
    <div className="my-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-linear-to-b from-slate-50/80 to-white dark:from-slate-900/60 dark:to-slate-950 p-5 sm:p-7 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm ring-4 ring-indigo-50 dark:ring-indigo-950/50">
            <Keyboard className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              {title}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                <Sparkles className="w-3 h-3" />
                {shortcuts.length} atajos
              </span>
            </h3>
            {description && (
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Filter selector if multiple contexts */}
        {contexts.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0">
              <Filter className="w-3.5 h-3.5" />
              Filtrar:
            </span>
            <button
              type="button"
              onClick={() => setSelectedContext('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors shrink-0 ${
                selectedContext === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              Todos ({shortcuts.length})
            </button>
            {contexts.map((ctx) => (
              <button
                key={ctx}
                type="button"
                onClick={() => setSelectedContext(ctx)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors shrink-0 ${
                  selectedContext === ctx
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {ctx}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid of Shortcut Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-5">
        {filteredShortcuts.map((shortcut, idx) => (
          <div
            key={`${shortcut.context}-${shortcut.keys.join('+')}-${idx}`}
            className="flex items-start justify-between gap-3 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 hover:border-indigo-300 dark:hover:border-indigo-700/60 transition-colors shadow-2xs group"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">
                {shortcut.description}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                  {shortcut.context}
                </span>
              </div>
            </div>

            {/* Keys combination */}
            <div className="flex items-center gap-1 shrink-0 pt-0.5">
              {shortcut.keys.map((key, kIdx) => (
                <React.Fragment key={kIdx}>
                  <kbd className="px-2 py-1 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md shadow-xs font-mono group-hover:border-indigo-400 dark:group-hover:border-indigo-500 transition-colors">
                    {key}
                  </kbd>
                  {kIdx < shortcut.keys.length - 1 && (
                    <span className="text-xs text-slate-400 dark:text-slate-600 font-bold px-0.5">
                      +
                    </span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
