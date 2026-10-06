'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

export default function PendingPage() {
  const [status, setStatus] = useState<'loading' | 'pending' | 'rejected'>('loading');
  const [userEmail, setUserEmail] = useState('');
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );

  useEffect(() => {
    const checkStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUserEmail(session.user.email || '');

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();

      if (profile?.role === 'rejected') {
        setStatus('rejected');
      } else {
        setStatus('pending');
      }
    };
    checkStatus();
  }, [router, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center">Cargando...</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded shadow-md text-center text-gray-900">
        {status === 'pending' ? (
          <>
            <h2 className="text-2xl font-bold text-yellow-600">En revisión</h2>
            <p className="text-gray-600">Tu cuenta está a la espera de ser asignada a una organización. Te notificaremos cuando tu acceso haya sido aprobado.</p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-red-600">Acceso Denegado Permanentemente</h2>
            <p className="text-gray-600">Tu solicitud de acceso ha sido rechazada.</p>
          </>
        )}

        <div className="pt-4 space-y-4">
          <a
            href={`mailto:soporte@codexflow.com?subject=Consulta sobre cuenta: ${userEmail}`}
            className="block w-full px-4 py-2 text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 transition"
          >
            Contactar Soporte
          </a>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 text-white bg-gray-800 rounded-md hover:bg-gray-900 transition"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
  );
}
