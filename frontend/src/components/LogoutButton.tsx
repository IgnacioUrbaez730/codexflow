"use client";

import { LogOut } from 'lucide-react';
import { getSupabaseBrowserClient } from '../lib/supabaseClient';

interface LogoutButtonProps {
  className?: string;
  isCollapsed?: boolean;
}

export default function LogoutButton({ className = '', isCollapsed = false }: LogoutButtonProps) {
  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  if (isCollapsed) {
    return (
      <button
        onClick={handleLogout}
        title="Cerrar Sesión"
        aria-label="Cerrar Sesión"
        className={`w-10 h-10 flex items-center justify-center rounded-lg relative group bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white transition-colors ${className}`}
      >
        <LogOut className="w-5 h-5 flex-shrink-0" />
        <div className="absolute left-full ml-3 px-2.5 py-1 bg-red-950 text-red-100 text-xs rounded-md shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 border border-red-800">
          Cerrar Sesión
        </div>
      </button>
    );
  }

  return (
    <button 
      onClick={handleLogout}
      className={`flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors ${className}`}
    >
      <LogOut className="w-4 h-4 flex-shrink-0" />
      <span>Cerrar Sesión</span>
    </button>
  );
}
