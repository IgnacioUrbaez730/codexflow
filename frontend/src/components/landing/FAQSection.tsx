'use client';

import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    question: '¿Qué formatos de imagen y niveles de resolución admite la plataforma?',
    answer:
      'CodexFlow procesa archivos TIFF sin compresión, JPEG de alta densidad, PNG y WebP con resoluciones recomendadas a partir de 300 DPI. El motor genera una pirámide de teselas optimizada que permite inspección con zoom fluido y lupa óptica de 180px sin saturar el ancho de banda del operador.',
  },
  {
    question: '¿Cómo se garantiza la confidencialidad, propiedad y aislamiento de los datos diocesanos?',
    answer:
      'La institución custodia conserva el 100% de la propiedad legal y patrimonial de sus facsímiles y metadatos. La plataforma implementa Row-Level Security (RLS) en PostgreSQL, garantizando aislamiento criptográfico absoluto entre parroquias y curias. Las imágenes se almacenan en buckets privados de Cloudflare R2 sin transferencia a terceros ni re-entrenamiento público no autorizado.',
  },
  {
    question: '¿Qué ocurre si se interrumpe la conexión a internet durante una sesión de transcripción?',
    answer:
      'El editor dual incorpora un búfer de estado reactivo local que conserva cada carácter escrito en los campos del formulario. Si la red oscila o se corta momentáneamente, el operador puede continuar digitando el folio activo y el sistema realiza un reintento transparente de guardado en cuanto se restablece la conectividad, previniendo la pérdida de avances.',
  },
  {
    question: '¿Qué grado de precisión ofrece la Inteligencia Artificial en caligrafías procesales de los siglos XVII al XIX?',
    answer:
      'Los modelos de CodexFlow están calibrados específicamente sobre grafías históricas hispanoamericanas y españolas (letra cortesana tardía, procesal encadenada e itálica). Alcanzan un prellenado consistente de al menos el 80% en fórmulas sacramentales y notariales (nombres, fechas, parroquias). Además, gracias a la arquitectura de Active Learning, cada corrección realizada por el digitador refina automáticamente la precisión sobre el lote en curso.',
  },
  {
    question: '¿En qué formatos se pueden exportar los libros de índices y qué compatibilidad ofrecen?',
    answer:
      'Se generan con un solo clic libros nativos de Microsoft Excel estilizados (.xlsx) con encabezados oficiales formateados, metadatos de custodia y validación de tipos, así como archivos CSV estructurados delimitados por punto y coma (;). Son plenamente compatibles con hojas de cálculo, sistemas de archivo histórico, bases de datos SQL y software genealógico estándar.',
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-20 md:py-28 bg-slate-950 scroll-mt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-semibold text-emerald-400 mb-3">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Respuestas Claras & Transparencia Técnica</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Preguntas Frecuentes
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-300">
            Todo lo que administradores patrimoniales, archiveros y digitadores necesitan saber
            acerca de la infraestructura y operación de CodexFlow.
          </p>
        </div>

        {/* Acordeón accesible */}
        <div className="space-y-4">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden transition-all duration-200"
              >
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 text-slate-100 hover:text-white hover:bg-slate-850 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${idx}`}
                  id={`faq-question-${idx}`}
                >
                  <span className="text-base sm:text-lg font-semibold">{faq.question}</span>
                  <div
                    className={`w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 transition-transform duration-200 text-slate-300 ${
                      isOpen ? 'transform rotate-180 bg-blue-600/30 text-blue-400' : ''
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {isOpen && (
                  <div
                    id={`faq-answer-${idx}`}
                    role="region"
                    aria-labelledby={`faq-question-${idx}`}
                    className="px-6 pb-6 pt-1 text-sm sm:text-base text-slate-300 leading-relaxed border-t border-slate-800/60 bg-slate-950/40"
                  >
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
