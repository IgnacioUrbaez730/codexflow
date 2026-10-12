'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { ArrowRight, Sparkles, Shield, Database, Layers } from 'lucide-react';
import DualViewerMockup from './DualViewerMockup';

interface HeroSectionProps {
  onOpenDemoModal: () => void;
}

export default function HeroSection({ onOpenDemoModal }: HeroSectionProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      );

      supabase.auth.getSession().then(({ data: { session } }) => {
        setIsAuthenticated(!!session);
      });
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden bg-slate-950">
      {/* Luces y degradados ambientales de fondo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-blue-600/15 blur-[140px] pointer-events-none rounded-full"></div>
      <div className="absolute top-1/3 left-1/4 w-[400px] h-[300px] bg-emerald-500/10 blur-[130px] pointer-events-none rounded-full"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-4xl mx-auto mb-14">
          {/* Badge institucional superior */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 mb-6 shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Preservación Patrimonial & Asistencia Neuronal Continua</span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            <span className="text-blue-400 font-semibold">v1.0 Oficial</span>
          </div>

          {/* Titular H1 de alto impacto */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15] mb-6">
            CodexFlow — Plataforma Inteligente de{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400">
              Digitalización e Indexación
            </span>{' '}
            de Archivos Históricos
          </h1>

          {/* Subtítulo institucional persuasivo */}
          <p className="text-lg sm:text-xl text-slate-300 font-normal leading-relaxed mb-10 max-w-3xl mx-auto">
            Acelere la transcripción de libros parroquiales, protocolos notariales y censos antiguos
            mediante un <strong>Visor Dual con ergonomía extrema</strong> e <strong>IA entrenada con Active Learning</strong>,
            manteniendo el aislamiento total de datos diocesanos con seguridad RLS.
          </p>

          {/* Botones CTA principales */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {isAuthenticated ? (
              <Link
                href="/batches"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-xl shadow-blue-600/30 transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Layers className="w-5 h-5" />
                Ir a mi Panel de Lotes
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            ) : (
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-xl shadow-blue-600/30 transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Iniciar Sesión
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}

            <button
              type="button"
              onClick={onOpenDemoModal}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl text-base font-semibold text-slate-100 bg-slate-900 border border-slate-700 hover:bg-slate-800 hover:border-slate-600 shadow-lg transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-slate-700 cursor-pointer"
            >
              <Database className="w-4 h-4 text-emerald-400" />
              Solicitar Acceso / Demo Institucional
            </button>
          </div>

          {/* Micro badges de confianza */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-400" /> Multi-Tenancy RLS por Diócesis
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span> 0% Costo de Egress en Cloudflare R2
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Exportación Oficial Excel .xlsx & CSV
            </span>
          </div>
        </div>

        {/* Mockup Interactivo del Visor Dual */}
        <div className="mt-8 max-w-5xl mx-auto">
          <DualViewerMockup />
        </div>
      </div>
    </section>
  );
}
