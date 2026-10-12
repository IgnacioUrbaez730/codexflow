'use client';

import React, { useState, useEffect } from 'react';
import StickyHeader from '@/components/landing/StickyHeader';
import HeroSection from '@/components/landing/HeroSection';
import ProblemSolutionSection from '@/components/landing/ProblemSolutionSection';
import KeyPillarsSection from '@/components/landing/KeyPillarsSection';
import UseCasesSection from '@/components/landing/UseCasesSection';
import FAQSection from '@/components/landing/FAQSection';
import Footer from '@/components/landing/Footer';
import DemoRequestModal from '@/components/landing/DemoRequestModal';

export default function LandingHomePage() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  useEffect(() => {
    // Si la URL contiene un token de enlace mágico de Supabase en el hash, redirigir a /login
    if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
      window.location.replace('/login' + window.location.hash);
    }
  }, []);

  const handleOpenDemoModal = () => {
    setIsDemoModalOpen(true);
  };

  const handleCloseDemoModal = () => {
    setIsDemoModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Navegación Fija con detector de sesión */}
      <StickyHeader onOpenDemoModal={handleOpenDemoModal} />

      {/* Contenido Principal */}
      <main className="flex-grow">
        {/* Sección Hero con Titular y Mockup Interactivo del Visor Dual */}
        <HeroSection onOpenDemoModal={handleOpenDemoModal} />

        {/* Retos Tradicionales vs Solución CodexFlow */}
        <ProblemSolutionSection />

        {/* 4 Pilares de Ingeniería Archivística (#caracteristicas, #seguridad) */}
        <KeyPillarsSection />

        {/* Casos de Uso por Tipología (#casos-de-uso) */}
        <UseCasesSection onOpenDemoModal={handleOpenDemoModal} />

        {/* Preguntas Frecuentes (#faq) */}
        <FAQSection />
      </main>

      {/* Pie de Página Institucional */}
      <Footer onOpenDemoModal={handleOpenDemoModal} />

      {/* Modal Accesible de Solicitud de Demostración */}
      <DemoRequestModal isOpen={isDemoModalOpen} onClose={handleCloseDemoModal} />
    </div>
  );
}
