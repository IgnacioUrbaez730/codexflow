'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirigir inmediatamente a /login con recarga dura para que Supabase procese el hash del Enlace Magico
    if (typeof window !== 'undefined') {
      window.location.replace('/login' + window.location.hash);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p className="mt-4 text-gray-600 font-medium">Cargando CodexFlow...</p>
    </div>
  );
}
