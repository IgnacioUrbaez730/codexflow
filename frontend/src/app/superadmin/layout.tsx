export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerClient({ cookies });
  
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
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
    <div className="superadmin-layout">
      {/* Basic wrapper for superadmin views */}
      <header className="bg-gray-800 text-white p-4">
        <h1>Superadmin Panel</h1>
      </header>
      <main className="p-4">
        {children}
      </main>
    </div>
  );
}

