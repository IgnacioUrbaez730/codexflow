'use client';

import React, { useState } from 'react';
import { Sparkles, ZoomIn, CheckCircle2, ShieldCheck, FileText, ChevronRight, Check } from 'lucide-react';

interface DocumentSample {
  id: string;
  title: string;
  period: string;
  category: string;
  sourceTextExcerpt: string;
  fields: {
    label: string;
    value: string;
    confidence: number;
    highlighted?: boolean;
  }[];
}

const SAMPLES: DocumentSample[] = [
  {
    id: 'bautismo-1782',
    title: 'Partida de Bautismo Sacramental',
    period: 'Año 1782 (Siglo XVIII)',
    category: 'Libro V de Bautismos — Folio 84v',
    sourceTextExcerpt:
      'En la Parroquia de Santa Inés de Cumaná, en catorce días del mes de Mayo de mil setecientos ochenta y dos años, yo el infrascrito Cura Párroco bauticé solemnemente y puse óleo y crisma a Pedro Joseph, hijo legítimo de Don Manuel Gómez y Doña Juana de la Parra...',
    fields: [
      { label: 'Nombres del Bautizado', value: 'Pedro Joseph', confidence: 96, highlighted: true },
      { label: 'Apellidos de Familia', value: 'Gómez de la Parra', confidence: 92, highlighted: true },
      { label: 'Fecha del Sacramento', value: '14 de Mayo de 1782', confidence: 95 },
      { label: 'Parroquia Eclesiástica', value: 'Santa Inés de Cumaná', confidence: 99 },
      { label: 'Padrinos Registrados', value: 'Don Juan Manuel de Sucre', confidence: 88 },
    ],
  },
  {
    id: 'protocolo-1824',
    title: 'Protocolo Notarial de Obligación',
    period: 'Año 1824 (Siglo XIX)',
    category: 'Escribanía Mayor — Legajo 112',
    sourceTextExcerpt:
      'Sepan quantos esta carta de obligación vieren cómo yo el Capitán Don Rodrigo de Mendoza, vecino desta ciudad de Caracas, reconozco deber y confieso la venta de solar y trapiche en término de Chacao a favor de la testamentaría de...',
    fields: [
      { label: 'Otorgante Principal', value: 'Capitán Don Rodrigo de Mendoza', confidence: 94, highlighted: true },
      { label: 'Naturaleza del Acto', value: 'Venta de Solar y Trapiche', confidence: 91, highlighted: true },
      { label: 'Fecha de Otorgamiento', value: '28 de Noviembre de 1824', confidence: 97 },
      { label: 'Escribano Mayor Actuante', value: 'Alonso de Ribas', confidence: 93 },
      { label: 'Testigos Instrumentales', value: 'Mateo del Castillo, Luis de la Hoz', confidence: 87 },
    ],
  },
];

export default function DualViewerMockup() {
  const [activeSampleId, setActiveSampleId] = useState<string>('bautismo-1782');
  const [lensActive, setLensActive] = useState<boolean>(true);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const sample = SAMPLES.find((s) => s.id === activeSampleId) || SAMPLES[0];

  const handleSaveSimulated = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300">
      {/* Barra de control superior del Mockup */}
      <div className="bg-slate-950/90 border-b border-slate-800 px-4 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-3">
        {/* Selector de muestras */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:inline">
            Fondo Documental:
          </span>
          <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
            {SAMPLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setActiveSampleId(s.id);
                  setIsSaved(false);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  activeSampleId === s.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s.title}
              </button>
            ))}
          </div>
        </div>

        {/* Indicadores de estado de digitalización */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-full font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            OCR Neuronal 300 DPI
          </div>
          <button
            type="button"
            onClick={() => setLensActive(!lensActive)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors cursor-pointer ${
              lensActive
                ? 'bg-blue-950/80 border-blue-700 text-blue-300'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <ZoomIn className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Lupa Óptica (180px)</span>
          </button>
        </div>
      </div>

      {/* Contenedor Dual: Lado Izquierdo (Facsímil) + Lado Derecho (Transcripción) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[480px]">
        {/* PANEL IZQUIERDO: Facsímil Histórico */}
        <div className="lg:col-span-7 bg-[#1c1815] relative p-6 flex flex-col justify-between overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-800">
          {/* Textura de pergamino / manuscrito de fondo con diseño caligráfico */}
          <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#d4af37_1px,transparent_1px)] [background-size:16px_16px]"></div>

          {/* Encabezado del documento */}
          <div className="flex items-center justify-between text-xs text-amber-200/70 border-b border-amber-900/40 pb-3 mb-4 z-10">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <span className="font-serif italic font-medium">{sample.category}</span>
            </div>
            <span className="font-mono text-[11px] bg-amber-950/60 text-amber-300 px-2 py-0.5 rounded border border-amber-800/40">
              {sample.period}
            </span>
          </div>

          {/* Área de Visualización del Manuscrito con Bounding Box */}
          <div className="relative my-auto py-4 px-3 sm:px-6 z-10">
            <div className="font-serif text-slate-300 text-base sm:text-lg leading-relaxed sm:leading-loose tracking-wide italic select-none">
              &ldquo;{sample.sourceTextExcerpt}&rdquo;
            </div>

            {/* Bounding Box destacado en Verde Esmeralda */}
            <div className="relative mt-4 p-3.5 rounded-lg border-2 border-emerald-400/90 bg-emerald-950/20 backdrop-blur-[1px] shadow-lg shadow-emerald-500/10">
              <div className="absolute -top-3 left-3 bg-emerald-600 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded shadow">
                DETECCIÓN IA • Bounding Box #01
              </div>
              <p className="text-sm font-serif text-emerald-200 font-semibold italic">
                {activeSampleId === 'bautismo-1782'
                  ? '...Pedro Joseph, hijo legítimo de Don Manuel Gómez y Doña Juana de la Parra...'
                  : '...Capitán Don Rodrigo de Mendoza, vecino desta ciudad de Caracas...'}
              </p>
            </div>

            {/* Simulación visual de Lupa Óptica Circular (180px) */}
            {lensActive && (
              <div className="hidden sm:flex absolute right-4 bottom-2 w-44 h-44 rounded-full border-4 border-emerald-400 bg-amber-950/95 shadow-2xl shadow-emerald-500/30 flex-col items-center justify-center p-3 text-center pointer-events-none z-20 backdrop-blur-md animate-pulse">
                <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold mb-1">
                  Lupa Óptica 2.5x
                </span>
                <span className="font-serif text-sm font-bold text-amber-100 italic leading-snug">
                  {sample.fields[0].value}
                </span>
                <span className="text-[10px] font-mono text-emerald-300 mt-1">
                  Alineación 180px
                </span>
              </div>
            )}
          </div>

          {/* Pie del visor del manuscrito */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-amber-900/30 pt-3 mt-4 z-10 font-mono">
            <span>Filtro: Binarización Adaptativa</span>
            <span className="text-emerald-400">Escala 100% • Libre de aberración</span>
          </div>
        </div>

        {/* PANEL DERECHO: Formulario de Indexación y Badges IA */}
        <div className="lg:col-span-5 bg-slate-900 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">Campos Prellenados por IA</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">80% Aceleración</span>
            </div>

            {/* Listado de campos */}
            <div className="space-y-3">
              {sample.fields.map((f, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-lg border transition-all ${
                    f.highlighted
                      ? 'bg-slate-800/90 border-emerald-500/50 shadow-sm'
                      : 'bg-slate-950/50 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-300">{f.label}</label>
                    <span
                      className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                        f.confidence >= 90
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/80'
                          : 'bg-blue-950 text-blue-300 border border-blue-800/80'
                      }`}
                    >
                      IA: {f.confidence}%
                    </span>
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={f.value}
                    className="w-full bg-slate-900/80 border border-slate-700/60 rounded px-2.5 py-1.5 text-xs font-medium text-slate-100 focus:outline-none select-all"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Atajos de teclado y Botón de Acción */}
          <div className="mt-6 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-3 font-mono">
              <span>Atajo: [Ctrl + Enter] Validar</span>
              <span>[Tab] Siguiente</span>
            </div>

            <button
              type="button"
              onClick={handleSaveSimulated}
              className={`w-full py-2.5 px-4 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isSaved
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20'
              }`}
            >
              {isSaved ? (
                <>
                  <Check className="w-4 h-4" />
                  ¡Folio Validado y Sincronizado en R2!
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Validar Folio y Avanzar al Siguiente
                  <ChevronRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
