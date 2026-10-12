'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpen, Shield, Heart, Lock, ExternalLink } from 'lucide-react';

interface FooterProps {
  onOpenDemoModal: () => void;
}

export default function Footer({ onOpenDemoModal }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-950 border-t border-slate-800 text-slate-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Columna 1: Marca y Misión */}
          <div className="md:col-span-1 space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <BookOpen className="w-4 h-4" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                Codex<span className="text-emerald-400">Flow</span>
              </span>
            </Link>
            <p className="text-xs text-slate-400 leading-relaxed">
              Plataforma tecnológica para la digitalización, transcripción ergonómica e indexación
              inteligente de fondos archivísticos históricos y colecciones sacramentales.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono">
              <Shield className="w-3.5 h-3.5" />
              <span>Soberanía de Datos & Aislamiento RLS</span>
            </div>
          </div>

          {/* Columna 2: Plataforma */}
          <div>
            <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-200 mb-4 font-mono">
              Plataforma
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <a href="#caracteristicas" className="hover:text-white transition-colors">
                  Ergonomía de Digitador
                </a>
              </li>
              <li>
                <a href="#caracteristicas" className="hover:text-white transition-colors">
                  IA & Active Learning
                </a>
              </li>
              <li>
                <a href="#seguridad" className="hover:text-white transition-colors">
                  Aislamiento Multi-Tenancy
                </a>
              </li>
              <li>
                <a href="#caracteristicas" className="hover:text-white transition-colors">
                  Exportación Nativa .xlsx y CSV
                </a>
              </li>
            </ul>
          </div>

          {/* Columna 3: Sectores y Fondos */}
          <div>
            <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-200 mb-4 font-mono">
              Sectores Patrimoniales
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <a href="#casos-de-uso" className="hover:text-white transition-colors">
                  Curias Diocesanas y Parroquias
                </a>
              </li>
              <li>
                <a href="#casos-de-uso" className="hover:text-white transition-colors">
                  Archivos Notariales e Históricos
                </a>
              </li>
              <li>
                <a href="#casos-de-uso" className="hover:text-white transition-colors">
                  Registros Civiles y Bibliotecas
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition-colors">
                  Preguntas Frecuentes (FAQ)
                </a>
              </li>
            </ul>
          </div>

          {/* Columna 4: Acceso y Soporte */}
          <div>
            <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-200 mb-4 font-mono">
              Acceso Institucional
            </h4>
            <ul className="space-y-2.5 text-xs mb-4">
              <li>
                <Link href="/login" className="hover:text-white transition-colors">
                  Portal de Operadores (Login)
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenDemoModal}
                  className="hover:text-emerald-400 transition-colors cursor-pointer text-left"
                >
                  Solicitar Demostración Técnica
                </button>
              </li>
            </ul>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                <Lock className="w-3.5 h-3.5 text-blue-400" />
                Custodia Criptográfica
              </div>
              <p>Facsímiles protegidos en almacenamiento inmutable de alta disponibilidad.</p>
            </div>
          </div>
        </div>

        {/* Separador y Copyright */}
        <div className="pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <p className="text-slate-500">
            © {currentYear} CodexFlow. Todos los derechos reservados. Preservación del Patrimonio Documental.
          </p>
          <div className="flex items-center gap-6 text-slate-500">
            <span>Privacidad y Confidencialidad RLS</span>
            <span>Normas ISAD(G)</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
