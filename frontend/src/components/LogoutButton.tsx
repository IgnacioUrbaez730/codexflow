"use client";

import { createBrowserClient } from '@supabase/ssr';

export default function LogoutButton({ className = '' }: { className?: string }) {
  const handleLogout = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <button 
      onClick={handleLogout}
      className={`px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors ${className}`}
    >
      Cerrar Sesión
    </button>
  );
}
