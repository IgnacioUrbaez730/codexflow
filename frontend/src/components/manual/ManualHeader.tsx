"use client";

import React from 'react';
import Link from 'next/link';
import {
  Search,
  X,
  Printer,
  ArrowLeft,
  LogIn,
  BookOpen,
  Users,
  Shield,
  FileCheck,
  Feather,
  LayoutGrid
} from 'lucide-react';
import { TargetRole } from '@/data/manualContent';

interface ManualHeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedRole: TargetRole;
  onRoleChange: (r: TargetRole) => void;
  isEmbedded?: boolean;
  subdomain?: string;
  userRole?: string | null;
  onPrint: () => void;
}

const ROLE_OPTIONS: Array<{
  id: TargetRole;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'all', label: 'Todos los Roles', icon: LayoutGrid },
  { id: 'admin', label: 'Administrador', icon: Shield },
  { id: 'archivist', label: 'Archivista', icon: Users },
  { id: 'digitizer', label: 'Digitador', icon: Feather },
  { id: 'evaluator', label: 'Evaluador', icon: FileCheck },
];

export default function ManualHeader({
  searchQuery,
  onSearchChange,
  selectedRole,
  onRoleChange,
  isEmbedded = false,
  subdomain,
  userRole,
  onPrint,
}: ManualHeaderProps) {
  // Determine return URL for authenticated user
  const getReturnHref = () => {
    if (!isEmbedded) return '/login';
    if (!subdomain) return '/';
    if (userRole === 'digitizer') return `/${subdomain}/visor`;
    if (userRole === 'evaluator') return `/${subdomain}/evaluacion`;
    return `/${subdomain}/dashboard`;
  };

  const returnHref = getReturnHref();

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-2xs print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 space-y-3">
        {/* Top bar: Brand title, Return button & Print button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm ring-4 ring-indigo-50 dark:ring-indigo-950/40">
              <BookOpen className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                  CodexFlow Manual
                </h1>
                <span className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-full">
                  Base de Conocimiento
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Guía técnica interactiva y operativa diocesana
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            {/* Print / Save PDF Button */}
            <button
              type="button"
              onClick={onPrint}
              aria-label="Imprimir manual o guardar como PDF"
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-300/80 dark:border-slate-700 transition-colors shadow-2xs"
            >
              <Printer className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              <span className="hidden sm:inline">Imprimir / Guardar PDF</span>
              <span className="sm:hidden">Imprimir</span>
            </button>

            {/* Contextual Return Button */}
            <Link
              href={returnHref}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors shadow-xs ${
                isEmbedded
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                  : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900'
              }`}
            >
              {isEmbedded ? (
                <>
                  <ArrowLeft className="h-4 w-4" />
                  <span>Volver a mi Consola</span>
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  <span>Ir a la Plataforma / Iniciar Sesión</span>
                </>
              )}
            </Link>
          </div>
        </div>

        {/* Lower bar: Search input + Role filter pills */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
          {/* Search Input */}
          <div className="relative flex-1 max-w-xl">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar en el manual (conceptos, atajos, folios, errores, roles)..."
              className="w-full pl-9 pr-9 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Limpiar búsqueda"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Role Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0 mr-1 hidden sm:inline">
              Rol:
            </span>
            {ROLE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isActive = selectedRole === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onRoleChange(opt.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}
