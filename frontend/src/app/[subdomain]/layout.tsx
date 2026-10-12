"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useParams } from "next/navigation";
import { createBrowserClient } from '@supabase/ssr';
import { Menu } from 'lucide-react';
import Sidebar from "../../components/Sidebar";
import { SidebarProvider, useSidebar } from "../../context/SidebarContext";

function SubdomainContent({
  subdomain,
  role,
  children,
}: {
  subdomain: string;
  role: string | null;
  children: React.ReactNode;
}) {
  const { isCollapsed, toggleMobile } = useSidebar();

  return (
    <div className="subdomain-layout flex flex-col min-h-screen bg-gray-50 text-gray-900">
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-gray-900 text-white z-30 sticky top-0 shadow-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleMobile}
            className="p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
            aria-label="Abrir menú"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-bold tracking-tight text-base">CodexFlow</span>
        </div>
        <span className="text-xs text-gray-400 capitalize bg-gray-800 px-2 py-1 rounded">
          {role}
        </span>
      </div>

      {role && <Sidebar subdomain={subdomain} role={role} />}

      <main
        className={`flex-1 overflow-auto transition-all duration-300 ease-in-out ${
          isCollapsed ? "md:ml-16" : "md:ml-64"
        }`}
      >
        {children}
      </main>
    </div>
  );
}

export default function SubdomainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { subdomain } = useParams() as { subdomain: string };
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    async function checkAccess() {
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || '',
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        );
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          router.replace("/login");
          return;
        }

        const res = await fetch(`/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          setRole(data.role);

          // Si es digitizer, permitir únicamente /visor y /metrics
          if (data.role === "digitizer") {
            const isAllowed =
              pathname.startsWith(`/${subdomain}/visor`) ||
              pathname.startsWith(`/${subdomain}/metrics`);
            if (!isAllowed) {
              router.replace(`/${subdomain}/visor`);
              return;
            }
          }
        } else {
          await supabase.auth.signOut();
          router.replace("/login");
        }
      } catch (err) {
        console.error("Auth check failed:", err);
      } finally {
        setLoading(false);
      }
    }

    checkAccess();
  }, [pathname, subdomain, router]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Verificando accesos...</div>;
  }

  return (
    <SidebarProvider>
      <SubdomainContent subdomain={subdomain} role={role}>
        {children}
      </SubdomainContent>
    </SidebarProvider>
  );
}
