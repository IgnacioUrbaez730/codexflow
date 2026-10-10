"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useParams } from "next/navigation";
import { createBrowserClient } from '@supabase/ssr';
import Sidebar from "../../components/Sidebar";

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

          // Si es digitizer, forzar a /visor
          if (data.role === "digitizer") {
            if (!pathname.includes(`/${subdomain}/visor`)) {
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

  const isDigitizer = role === "digitizer";

  return (
    <div className="subdomain-layout flex min-h-screen bg-gray-50">
      {!isDigitizer && role && <Sidebar subdomain={subdomain} role={role} />}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

