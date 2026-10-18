'use client';

import React from 'react';
import { Eye, Cpu, ClipboardCheck, FolderTree, FileSpreadsheet, Zap } from 'lucide-react';

export default function KeyPillarsSection() {
  const pillars = [
    {
      id: 'ergonomia',
      badge: 'Pilar 01',
      icon: Eye,
      title: 'Ergonomía Extrema de Digitador & Visor Dual',
      description:
        'Diseñado para sesiones intensivas de transcripción histórica sin fatiga ocular ni interrupciones de flujo.',
      features: [
        'Visor dual sincronizado con manipulación de facsímil al 100% de nitidez.',
        'Lupa virtual circular con activación instantánea por tecla [L].',
        'Navegación y guardado mediante atajos globales de teclado 100% libres de ratón.',
        'Filtros de contraste, inversión y binarización para tintas ferrogálicas atenuadas.',
      ],
      gradient: 'from-blue-600/20 to-indigo-600/10',
      border: 'border-blue-500/30',
      iconColor: 'text-blue-400',
      gridColClass: 'col-span-1 md:col-span-1 lg:col-span-2',
    },
    {
      id: 'ia-active-learning',
      badge: 'Pilar 02',
      icon: Cpu,
      title: 'IA Asistida & Active Learning',
      description:
        'Modelos especializados en paleografía hispánica colonial y republicana que aprenden de las correcciones del operador.',
      features: [
        'Detección automática de Bounding Boxes por cada asiento sacramental o partida.',
        'Prellenado inteligente asistido de al menos el 80% de campos (nombres, fechas, sacramentados).',
        'Active Learning continuo: aprendizaje y calibración diocesana por tomo y escribano.',
        'Métricas de confianza porcentuales por campo (IA: 85% – 99%).',
      ],
      gradient: 'from-emerald-600/20 to-teal-600/10',
      border: 'border-emerald-500/30',
      iconColor: 'text-emerald-400',
      gridColClass: 'col-span-1 md:col-span-1 lg:col-span-2',
    },
    {
      id: 'mesa-evaluacion',
      badge: 'Pilar 03',
      icon: ClipboardCheck,
      title: 'Mesa de Evaluación & Control de Calidad (Arbitraje)',
      description:
        'Doble filtro institucional con rol dedicado evaluator para blindar la fidelidad del archivo antes de su certificación.',
      features: [
        'Rol dedicado evaluator con mesa dual y panel retráctil ergonómico de cotejo.',
        'Doble filtro de calidad estricto antes de certificar y sellar cualquier tomo.',
        'Veredictos ágiles: aprobación inmediata (Ctrl+Enter) y devolución prioritaria (Alt+R).',
        'Devolución estructurada con notas de corrección y escalamiento directo al Archivista.',
      ],
      gradient: 'from-purple-600/20 to-violet-600/10',
      border: 'border-purple-500/30',
      iconColor: 'text-purple-400',
      gridColClass: 'col-span-1 md:col-span-1 lg:col-span-2',
    },
    {
      id: 'estructura-foliacion',
      badge: 'Pilar 04',
      icon: FolderTree,
      title: 'Estructura Archivística DCam & Foliación Recto / Vuelto',
      description:
        'Modelado archivístico riguroso acorde a las directrices de conservación y catalogación patrimonial.',
      features: [
        'Organización jerárquica: Diócesis > Parroquia > Serie Sacramental > Tomo.',
        'Foliación física real con distinción de cara: F.14r (Recto) y F.14v (Vuelto).',
        'Desglose multi-partida y detección de actas continuadas interfolio.',
        'Herencia territorial automática de localidad, parroquia y jurisdicción eclesiástica.',
      ],
      gradient: 'from-sky-600/20 to-blue-600/10',
      border: 'border-sky-500/30',
      iconColor: 'text-sky-400',
      gridColClass: 'col-span-1 md:col-span-1 lg:col-span-3',
    },
    {
      id: 'familysearch-interoperabilidad',
      badge: 'Pilar 05',
      icon: FileSpreadsheet,
      title: 'Interoperabilidad FamilySearch DIP & Exportación',
      description:
        'Generación de entregables conformes a los estándares internacionales de preservación e investigación genealógica.',
      features: [
        'Generación de paquetes DIP .ZIP estándar FamilySearch con facsímiles y metadatos.',
        'Matrices de indexación en Excel (.xlsx) estilizado y CSV delimitado por (;) con BOM UTF-8.',
        'Generación de linajes bajo la norma internacional genealógica GEDCOM 5.5.1.',
        'Filtro switch only_verified para descargar únicamente partidas 100% auditadas.',
      ],
      gradient: 'from-amber-600/20 to-orange-600/10',
      border: 'border-amber-500/30',
      iconColor: 'text-amber-400',
      gridColClass: 'col-span-1 md:col-span-2 lg:col-span-3',
    },
  ];

  return (
    <section id="caracteristicas" className="py-20 md:py-28 bg-slate-950 relative scroll-mt-20">
      {/* Marcador ancla para seguridad */}
      <div id="seguridad" className="absolute top-1/2 scroll-mt-20"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-semibold text-blue-400 mb-4">
            <Zap className="w-3.5 h-3.5" />
            <span>Fundamentos de Ingeniería Archivística</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Los Cinco Pilares de CodexFlow
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-300">
            Una arquitectura integral pensada desde la paleografía práctica hasta los requerimientos
            de soberanía de datos, arbitraje de calidad y homologación internacional de curias e instituciones históricas.
          </p>
        </div>

        {/* Grid responsivo equilibrado de 5 pilares (3 en fila superior, 2 en fila inferior) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 sm:gap-8">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.id}
                className={`${pillar.gridColClass} bg-slate-900/90 rounded-2xl p-6 sm:p-8 border ${pillar.border} bg-gradient-to-br ${pillar.gradient} shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.01] flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-xs font-mono font-bold tracking-wider uppercase px-2.5 py-1 rounded-md bg-slate-950/80 text-slate-300 border border-slate-800">
                      {pillar.badge}
                    </span>
                    <div className={`p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 ${pillar.iconColor}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2">{pillar.title}</h3>
                  <p className="text-sm text-slate-300 mb-6 leading-relaxed">
                    {pillar.description}
                  </p>

                  <div className="space-y-3 pt-4 border-t border-slate-800/80">
                    {pillar.features.map((feature, fIdx) => (
                      <div key={fIdx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-300">
                        <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
