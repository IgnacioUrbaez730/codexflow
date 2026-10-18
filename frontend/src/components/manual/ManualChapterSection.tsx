"use client";

import React from 'react';
import {
  ShieldCheck,
  Users,
  UploadCloud,
  Scan,
  CheckSquare,
  Download,
  LifeBuoy,
  Building2,
  FolderTree,
  FileText,
  HelpCircle,
  Hash,
  CheckCircle2,
  Lightbulb,
  ArrowRight,
  Sparkles,
  LucideIcon
} from 'lucide-react';
import { ManualChapter, ManualSection, TargetRole } from '@/data/manualContent';
import ManualCallout from './ManualCallout';

const ICON_MAP: Record<string, LucideIcon> = {
  ShieldCheck,
  Users,
  UploadCloud,
  Scan,
  CheckSquare,
  Download,
  LifeBuoy,
  Building2,
  FolderTree,
  FileText,
  HelpCircle,
};

const ROLE_LABELS: Record<TargetRole, { label: string; badgeClass: string }> = {
  all: {
    label: 'Todos los Roles',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
  admin: {
    label: 'Administrador',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
  },
  archivist: {
    label: 'Archivista',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
  },
  digitizer: {
    label: 'Digitador',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
  },
  evaluator: {
    label: 'Evaluador',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  },
};

interface ManualChapterSectionProps {
  chapter: ManualChapter;
}

export default function ManualChapterSection({ chapter }: ManualChapterSectionProps) {
  const IconComponent = ICON_MAP[chapter.iconName] || FileText;
  const roleConfig = ROLE_LABELS[chapter.targetRole] || ROLE_LABELS.all;

  return (
    <article
      id={chapter.id}
      className="scroll-mt-24 mb-16 pb-12 border-b border-slate-200 dark:border-slate-800 last:border-b-0"
    >
      {/* Chapter Header */}
      <header className="mb-8 p-6 sm:p-8 rounded-2xl bg-linear-to-br from-slate-900 to-indigo-950 text-white shadow-lg relative overflow-hidden">
        {/* Subtle decorative background pattern */}
        <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none">
          <IconComponent className="w-56 h-56" />
        </div>

        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2.5 mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 backdrop-blur-xs text-white border border-white/20">
              <IconComponent className="w-3.5 h-3.5" />
              Capítulo {chapter.number}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
              {chapter.badge}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800/80 text-slate-300 border border-slate-700">
              {roleConfig.label}
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-3">
            {chapter.title}
          </h2>

          <p className="text-sm sm:text-base text-slate-200/90 leading-relaxed max-w-4xl">
            {chapter.summary}
          </p>
        </div>
      </header>

      {/* Sections List */}
      <div className="space-y-12">
        {chapter.sections.map((section: ManualSection, sIdx: number) => {
          const sectionRole = ROLE_LABELS[section.targetRole] || ROLE_LABELS.all;

          return (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-24 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/40 p-6 sm:p-8 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              {/* Section Header */}
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-4 mb-5 border-b border-slate-100 dark:border-slate-800/70">
                <div className="flex items-center gap-2">
                  <a
                    href={`#${section.id}`}
                    className="group inline-flex items-center gap-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    title="Enlace permanente a esta sección"
                  >
                    <Hash className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                      {section.title}
                    </h3>
                  </a>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${sectionRole.badgeClass}`}
                  >
                    {sectionRole.label}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                    § {chapter.number}.{sIdx + 1}
                  </span>
                </div>
              </div>

              {/* Section Summary */}
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-6 font-normal">
                {section.summary}
              </p>

              {/* Key Points */}
              {section.keyPoints && section.keyPoints.length > 0 && (
                <div className="my-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Puntos Clave y Directrices Canónicas
                  </h4>
                  <ul className="space-y-2">
                    {section.keyPoints.map((point, pIdx) => (
                      <li
                        key={pIdx}
                        className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 mt-2 shrink-0" />
                        <span className="leading-relaxed">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Steps */}
              {section.steps && section.steps.length > 0 && (
                <div className="my-7">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-4 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Procedimiento Paso a Paso
                  </h4>
                  <div className="space-y-4">
                    {section.steps.map((step) => (
                      <div
                        key={step.stepNumber}
                        className="flex items-start gap-3.5 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-xs shadow-xs">
                          {step.stepNumber}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {step.title}
                          </h5>
                          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                            {step.description}
                          </p>

                          {step.tips && step.tips.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {step.tips.map((tip, tIdx) => (
                                <div
                                  key={tIdx}
                                  className="inline-flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-2.5 py-1 rounded-lg"
                                >
                                  <Lightbulb className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                  <span>{tip}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Data Table */}
              {section.table && (
                <div className="my-7 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 font-semibold text-xs uppercase tracking-wider">
                        <tr>
                          {section.table.headers.map((header, hIdx) => (
                            <th key={hIdx} className="px-4 py-3">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                        {section.table.rows.map((row, rIdx) => (
                          <tr
                            key={rIdx}
                            className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            {row.map((cell, cIdx) => (
                              <td
                                key={cIdx}
                                className={`px-4 py-3 text-slate-700 dark:text-slate-300 text-xs sm:text-sm ${
                                  cIdx === 0 ? 'font-semibold text-slate-900 dark:text-slate-100' : ''
                                }`}
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Section Shortcuts */}
              {section.shortcuts && section.shortcuts.length > 0 && (
                <div className="my-6 p-4 rounded-xl border border-indigo-100 dark:border-indigo-950/80 bg-indigo-50/40 dark:bg-indigo-950/20">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300 mb-3 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Atajos Rápidos de esta Sección
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {section.shortcuts.map((sc, scIdx) => (
                      <div
                        key={scIdx}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs"
                      >
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                          {sc.description}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {sc.keys.map((k, kIdx) => (
                            <React.Fragment key={kIdx}>
                              <kbd className="px-1.5 py-0.5 text-[11px] font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-xs font-mono">
                                {k}
                              </kbd>
                              {kIdx < sc.keys.length - 1 && (
                                <span className="text-slate-400 text-[10px]">+</span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Callout Boxes */}
              {section.callouts && section.callouts.length > 0 && (
                <div className="my-6 space-y-3">
                  {section.callouts.map((callout, cIdx) => (
                    <ManualCallout key={cIdx} callout={callout} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </article>
  );
}
