'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role, tenant_id, tenants(subdomain)')
          .eq('user_id', session.user.id)
          .single();
        
        if (profile?.role === 'rejected' || (!profile?.tenant_id && !profile?.role)) {
          try {
            const res = await fetch('/api/auth/self-heal', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`
              }
            });
            if (res.ok) {
              router.push('/superadmin');
              return;
            }
          } catch (e) {
            console.error('Self-heal failed', e);
          }
          router.push('/pending');
        } else if (profile?.role === 'superadmin') {
          router.push('/superadmin');
        } else if (profile?.tenants?.subdomain) {
          router.push(`/${profile.tenants.subdomain}/dashboard`);
        } else {
          router.push('/dashboard');
        }
      }
    };
    checkSession();
  }, [router, supabase]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setIsLoading(false);
        return;
      }

      if (data.user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role, tenant_id, tenants(subdomain)')
          .eq('user_id', data.user.id)
          .single();

        if (profile?.role === 'rejected' || (!profile?.tenant_id && !profile?.role)) {
          try {
            const res = await fetch('/api/auth/self-heal', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${data.session?.access_token}`
              }
            });
            if (res.ok) {
              router.push('/superadmin');
              router.refresh();
              return;
            }
          } catch (e) {
            console.error('Self-heal failed', e);
          }
          router.push('/pending');
        } else if (profile?.role === 'superadmin') {
          router.push('/superadmin');
        } else if (profile?.tenants?.subdomain) {
          router.push(`/${profile.tenants.subdomain}/dashboard`);
        } else {
          router.push('/dashboard');
        }
        router.refresh();
      }
      
    } catch (err) {
      console.error(err);
      setError('Ocurrió un error inesperado al iniciar sesión.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded shadow-md text-gray-900">
        <h2 className="text-2xl font-bold text-center text-blue-600">Iniciar Sesión</h2>
        <p className="text-sm text-center text-gray-600">Ingresa a tu cuenta de Superadmin u Organización.</p>
        
        {error && (
          <div className="p-3 text-sm text-red-500 bg-red-100 rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-200 text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-200 text-gray-900"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Entrando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
