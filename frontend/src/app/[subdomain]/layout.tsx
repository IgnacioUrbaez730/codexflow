"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "../../lib/supabase";
import Sidebar from "../../components/Sidebar";

export default function SubdomainLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { subdomain: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    async function checkAccess() {
      try {
        const supabase = createClient();
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
            if (!pathname.includes(`/${params.subdomain}/visor`)) {
              router.replace(`/${params.subdomain}/visor`);
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
  }, [pathname, params.subdomain, router]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Verificando accesos...</div>;
  }

  const isDigitizer = role === "digitizer";

  return (
    <div className="subdomain-layout flex min-h-screen bg-gray-50">
      {!isDigitizer && role && <Sidebar subdomain={params.subdomain} role={role} />}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

