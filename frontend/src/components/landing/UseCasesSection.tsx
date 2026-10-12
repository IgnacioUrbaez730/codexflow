'use client';

import React from 'react';
import { Church, Landmark, Library, CheckCircle, ArrowUpRight } from 'lucide-react';

interface UseCasesSectionProps {
  onOpenDemoModal: () => void;
}

export default function UseCasesSection({ onOpenDemoModal }: UseCasesSectionProps) {
  const useCases = [
    {
      icon: Church,
      title: 'Curias Diocesanas & Parroquias',
      subtitle: 'Libros Sacramentales y Archivo Canónico',
      description:
        'Resguardo digital e indexación exhaustiva de libros de bautismo, matrimonio, confirmación y defunción desde el periodo colonial hasta la modernidad.',
      benefits: [
        'Búsqueda inmediata de partidas para trámites de nacionalidad o genealogía.',
        'Preservación de los tomos parroquiales originales contra la manipulación física.',
        'Aislamiento estricto de expedientes matrimoniales bajo secreto canónico.',
      ],
      tag: 'Sector Eclesiástico',
      color: 'blue',
    },
    {
      icon: Landmark,
      title: 'Archivos Históricos & Notariales',
      subtitle: 'Protocolos, Testamentos y Legajos',
      description:
        'Procesamiento masivo de escrituras públicas, compraventas, dispensas, cartas de dote y juicios del siglo XVI al XIX con tipología documental compleja.',
      benefits: [
        'Segmentación automática de protocolos por escribano y año documental.',
        'Reconocimiento de abreviaturas paleográficas comunes en la administración virreinal.',
        'Generación de índices notariales conformes a directrices de Archivos Generales.',
      ],
      tag: 'Sector Notarial & Jurídico',
      color: 'emerald',
    },
    {
      icon: Library,
      title: 'Registros Civiles & Bibliotecas',
      subtitle: 'Censos, Padrones y Manuscritos Raros',
      description:
        'Catalogación sistemática de series demográficas, censos de población, pasaportes antiguos y colecciones especiales de consulta pública o académica.',
      benefits: [
        'Integración con plataformas públicas de consulta ciudadana e interoperabilidad.',
        'Exportación estructurada en CSV/Excel para investigaciones estadísticas y sociológicas.',
        'Visualización fluida de fojas de gran formato sin pérdida de resolución.',
      ],
      tag: 'Sector Público & Académico',
      color: 'purple',
    },
  ];

  return (
    <section id="casos-de-uso" className="py-20 md:py-28 bg-slate-900 border-t border-slate-800 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-mono font-semibold text-emerald-400 uppercase tracking-widest">
            Aplicaciones en Fondos Reales
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mt-2">
            Especializado para Cada Tipología Documental
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-300">
            CodexFlow se adapta a las particularidades normativas, archivísticas y de custodia
            de diversas instituciones custodias de la memoria colectiva.
          </p>
        </div>

        {/* Tarjetas de Casos de Uso */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {useCases.map((uc, idx) => {
            const Icon = uc.icon;
            return (
              <div
                key={idx}
                className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col justify-between hover:border-slate-700 transition-all duration-300 shadow-xl group"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-xs font-mono text-slate-400 uppercase tracking-wider bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800">
                      {uc.tag}
                    </span>
                    <div className="p-2.5 rounded-xl bg-slate-900 text-slate-300 group-hover:text-emerald-400 group-hover:bg-slate-850 transition-colors">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-1">{uc.title}</h3>
                  <p className="text-xs text-emerald-400 font-medium mb-4">{uc.subtitle}</p>
                  <p className="text-sm text-slate-300 mb-6 leading-relaxed">
                    {uc.description}
                  </p>

                  <div className="space-y-2.5 pt-4 border-t border-slate-850">
                    {uc.benefits.map((b, bIdx) => (
                      <div key={bIdx} className="flex items-start gap-2 text-xs text-slate-400">
                        <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-slate-850">
                  <button
                    type="button"
                    onClick={onOpenDemoModal}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-lg text-xs font-semibold text-slate-200 bg-slate-900 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer border border-slate-800"
                  >
                    Consultar para este sector
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
