'use client';

import React from 'react';
import { StickyHeader, Footer } from '@/components/landing';
import ManualView from '@/components/manual/ManualView';

export default function PublicManualPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      <StickyHeader onOpenDemoModal={() => { window.location.href = '/login'; }} />
      <main className="flex-grow pt-24 pb-12">
        <ManualView isEmbedded={false} />
      </main>
      <Footer onOpenDemoModal={() => { window.location.href = '/login'; }} />
    </div>
  );
}
