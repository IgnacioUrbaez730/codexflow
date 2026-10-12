'use client';

import React from 'react';
import { Eye, Cpu, ShieldCheck, FileSpreadsheet, Keyboard, Zap, Lock, DownloadCloud } from 'lucide-react';

export default function KeyPillarsSection() {
  const pillars = [
    {
      id: 'ergonomia',
      badge: 'Pilar 01',
      icon: Eye,
      title: 'Ergonomía Extrema de Digitador',
      description:
        'Diseñado para sesiones intensivas de transcripción histórica sin fatiga ocular ni interrupciones de flujo.',
      features: [
        'Visor dual sincronizado con manipulación de facsímil al 100% de nitidez.',
        'Lupa circular virtual de 180px para descifrar trazos caligráficos finos.',
        'Atajos globales de teclado que eliminan por completo la dependencia del ratón.',
        'Filtros de alto contraste y binarización adaptativa para tintas atenuadas.',
      ],
      gradient: 'from-blue-600/20 to-indigo-600/10',
      border: 'border-blue-500/30',
      iconColor: 'text-blue-400',
    },
    {
      id: 'ia-active-learning',
      badge: 'Pilar 02',
      icon: Cpu,
      title: 'IA Asistida & Active Learning',
      description:
        'Modelos especializados en paleografía colonial y republicana que aprenden de las correcciones del operador.',
      features: [
        'Detección automática de Bounding Boxes por cada asiento o partida.',
        'Prellenado inteligente de al menos el 80% de nombres, fechas y padrinos.',
        'Active Learning continuo: cada validación perfecciona el modelo.',
        'Métricas de confianza porcentuales por campo (IA: 85% – 99%).',
      ],
      gradient: 'from-emerald-600/20 to-teal-600/10',
      border: 'border-emerald-500/30',
      iconColor: 'text-emerald-400',
    },
    {
      id: 'seguridad-rls',
      badge: 'Pilar 03',
      icon: ShieldCheck,
      title: 'Seguridad & Multi-Tenancy Diocesano',
      description:
        'Blindaje criptográfico y aislamiento de datos por institución patrimonial con cumplimiento estricto.',
      features: [
        'Row-Level Security (RLS) en Supabase: ninguna parroquia ve datos ajenos.',
        'Custodia de imágenes en Cloudflare R2 con 0% costo de egress para siempre.',
        'Trazabilidad y auditoría completa por lote, usuario y estampilla de tiempo.',
        'Permisos por roles granulares (Administrador diocesano vs. Digitador).',
      ],
      gradient: 'from-purple-600/20 to-indigo-600/10',
      border: 'border-purple-500/30',
      iconColor: 'text-purple-400',
    },
    {
      id: 'exportacion',
      badge: 'Pilar 04',
      icon: FileSpreadsheet,
      title: 'Exportación Formal e Interoperabilidad',
      description:
        'Generación de índices listos para archivo físico, consulta civil o intercambio internacional.',
      features: [
        'Generación nativa de libros Excel estilizados (.xlsx) con plantillas oficiales.',
        'Archivos CSV estructurados delimitados por punto y coma (;) para importación masiva.',
        'Compatibilidad con estándares de catalogación histórica y genealógica.',
        'Descargas instantáneas por lote completo o por libro sacramental.',
      ],
      gradient: 'from-amber-600/20 to-orange-600/10',
      border: 'border-amber-500/30',
      iconColor: 'text-amber-400',
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
            Los Cuatro Pilares de CodexFlow
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-300">
            Una arquitectura integral pensada desde la paleografía práctica hasta los requerimientos
            de soberanía de datos de curias e instituciones históricas.
          </p>
        </div>

        {/* Grid de 4 tarjetas de pilares */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.id}
                className={`bg-slate-900/90 rounded-2xl p-6 sm:p-8 border ${pillar.border} bg-gradient-to-br ${pillar.gradient} shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.01] flex flex-col justify-between`}
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
