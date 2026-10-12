'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, Clock, Zap, BookX, Archive, ShieldAlert, Sparkles } from 'lucide-react';

export default function ProblemSolutionSection() {
  const challenges = [
    {
      icon: BookX,
      title: 'Deterioro Físico de Tomos',
      description:
        'La consulta manual y el hojeado repetido de legajos de los siglos XVII-XIX aceleran la degradación de tintas ferrogálicas y papel de trapo.',
    },
    {
      icon: Clock,
      title: 'Cuellos de Botella y Semanas por Tomo',
      description:
        'La digitación artesanal en hojas de cálculo no estandarizadas toma meses por libro sacramental, propensa a erratas y pérdida de folios.',
    },
    {
      icon: ShieldAlert,
      title: 'Fatiga Visual y Descontextualización',
      description:
        'Alternar la mirada entre documentos físicos deteriorados y pantallas convencionales fatiga al transcriptor y eleva los errores de lectura.',
    },
    {
      icon: AlertCircle,
      title: 'Silos de Datos Inaccesibles',
      description:
        'Los índices en archivos locales impiden búsquedas genealógicas cruzadas y no ofrecen copias de resguardo ante siniestros.',
    },
  ];

  const solutions = [
    {
      icon: Archive,
      title: 'Preservación Digital de Alta Fidelidad',
      description:
        'Custodia perenne de facsímiles a 300 DPI en Cloudflare R2 sin costes ocultos de egress, eliminando la manipulación del original.',
    },
    {
      icon: Zap,
      title: 'Aceleración 5x con Prellenado IA',
      description:
        'Modelos especializados identifican partidas y prellenan el 80% de los campos, dejando al operador humano únicamente la validación final.',
    },
    {
      icon: Sparkles,
      title: 'Ergonomía Extrema y Lupa Óptica',
      description:
        'Visor dual sincronizado con lupa de 180px, binarización adaptativa para tintas desvanecidas y operación 100% libre de ratón.',
    },
    {
      icon: CheckCircle2,
      title: 'Índices Estandarizados y Multi-Tenancy',
      description:
        'Aislamiento estricto por parroquia con RLS de Supabase y exportación formal inmediata a libros Excel (.xlsx) y archivos CSV.',
    },
  ];

  return (
    <section className="py-20 md:py-28 bg-slate-900 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Cabecera de la sección */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-xs uppercase tracking-widest font-semibold text-emerald-400 mb-3 font-mono">
            Evolución del Trabajo Archivístico
          </h2>
          <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            De la Transcripción Artesanal a la Indexación Inteligente
          </p>
          <p className="mt-4 text-base sm:text-lg text-slate-400">
            Compare las limitaciones de los métodos tradicionales frente a la metodología
            ergonómica asistida por Inteligencia Artificial que introduce CodexFlow.
          </p>
        </div>

        {/* Grid de dos columnas: Retos vs. Solución */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Columna Izquierda: Retos Tradicionales */}
          <div className="bg-slate-950/70 border border-red-950/60 rounded-2xl p-6 sm:p-8 shadow-xl">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-red-950/70">
              <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-800/50 flex items-center justify-center text-red-400">
                <BookX className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-200">El Enfoque Tradicional</h3>
                <p className="text-xs text-red-400/80 font-medium">Métodos manuales lentos y vulnerables</p>
              </div>
            </div>

            <div className="space-y-6">
              {challenges.map((c, i) => {
                const IconComponent = c.icon;
                return (
                  <div key={i} className="flex gap-4 items-start">
                    <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-red-950/80 border border-red-800/40 flex items-center justify-center text-red-400 text-xs font-mono font-bold">
                      ✕
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-200">{c.title}</h4>
                      <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
                        {c.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Columna Derecha: CodexFlow */}
          <div className="bg-slate-950/70 border border-emerald-950/60 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-emerald-950/70 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-emerald-950/70 border border-emerald-800/50 flex items-center justify-center text-emerald-400 shadow-md shadow-emerald-500/10">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-emerald-200">La Solución CodexFlow</h3>
                <p className="text-xs text-emerald-400/80 font-medium">Plataforma ergonómica potenciada por IA</p>
              </div>
            </div>

            <div className="space-y-6 relative z-10">
              {solutions.map((s, i) => {
                const IconComponent = s.icon;
                return (
                  <div key={i} className="flex gap-4 items-start">
                    <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-emerald-950/90 border border-emerald-700/60 flex items-center justify-center text-emerald-400 text-xs font-mono font-bold">
                      ✓
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-100">{s.title}</h4>
                      <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                        {s.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
