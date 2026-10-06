"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "../../lib/supabase";

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

  useEffect(() => {
    async function checkAccess() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        let role = localStorage.getItem("mock_role"); // fallback for dev
        
        if (session?.user) {
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("role")
            .eq("user_id", session.user.id)
            .single();
            
          if (profile) {
            role = profile.role;
            localStorage.setItem("mock_role", role);
          }
        }

        // Si es digitizer, forzar a /visor
        if (role === "digitizer") {
          if (!pathname.includes(`/${params.subdomain}/visor`)) {
            router.replace(`/${params.subdomain}/visor`);
            return;
          }
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

  return (
    <div className="subdomain-layout">
      {children}
    </div>
  );
}

