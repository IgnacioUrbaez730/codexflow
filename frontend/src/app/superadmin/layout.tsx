export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import LogoutButton from '../../components/LogoutButton';

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignorar en server components
          }
        },
      },
    }
  );
  
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    redirect('/login');
  }

  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://codexflow-backend.onrender.com';
    const res = await fetch(`${backendUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`
      },
      cache: 'no-store'
    });
    
    if (!res.ok) {
      redirect('/');
    }
    
    const data = await res.json();
    if (data.role !== 'superadmin') {
      redirect('/');
    }
  } catch (error) {
    redirect('/');
  }

  return (
    <div className="superadmin-layout bg-gray-50 min-h-screen text-gray-900">
      <header className="bg-blue-800 text-white p-4 shadow-md flex justify-between items-center">
        <h1 className="text-xl font-bold">Panel Global de CodexFlow</h1>
        <LogoutButton className="bg-red-500 hover:bg-red-600 px-3 py-1 text-sm" />
      </header>
      <main className="p-4">
        {children}
      </main>
    </div>
  );
}
