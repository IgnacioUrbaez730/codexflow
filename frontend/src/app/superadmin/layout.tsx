export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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
    redirect('/register');
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', session.user.id)
    .single();

  if (!profile || profile.role !== 'superadmin') {
    redirect('/');
  }

  return (
    <div className="superadmin-layout bg-gray-50 min-h-screen text-gray-900">
      <header className="bg-blue-800 text-white p-4 shadow-md">
        <h1 className="text-xl font-bold">Panel Global de CodexFlow</h1>
      </header>
      <main className="p-4">
        {children}
      </main>
    </div>
  );
}
