export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerComponentClient({ cookies });
  
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
