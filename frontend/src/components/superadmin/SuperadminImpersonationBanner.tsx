"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

interface TenantOption {
  id: string;
  name: string;
  subdomain?: string;
  is_active?: boolean;
}

export default function SuperadminImpersonationBanner({
  currentSubdomain,
}: {
  currentSubdomain: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadTenants() {
      try {
        setLoading(true);
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        const res = await fetch("/api/superadmin/tenants", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (res.ok) {
          const json = await res.json();
          const list: TenantOption[] = Array.isArray(json)
            ? json
            : json.data || [];
          setTenants(list.filter((t) => t.is_active !== false));
        }
      } catch (err) {
        console.error("Error fetching tenants for impersonation banner:", err);
      } finally {
        setLoading(false);
      }
    }

    loadTenants();
  }, []);

  const handleTenantChange = (newSubdomain: string) => {
    if (!newSubdomain || newSubdomain === currentSubdomain) return;
    // Preservar la subruta activa al alternar de organización
    const regex = new RegExp(`^/${currentSubdomain}(/|$)`);
    const newPath = pathname.replace(regex, `/${newSubdomain}$1`);
    router.push(newPath || `/${newSubdomain}/dashboard`);
  };

  return (
    <div className="sticky top-0 z-40 bg-indigo-950 border-b border-indigo-800 text-white px-4 py-2 shadow-md flex items-center justify-between text-xs">
      {/* Izquierda: Modo Auditoría y Selector de Diócesis */}
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="font-semibold text-indigo-200">
          Modo Auditoría Global (Superadmin) — Viendo:
        </span>
        <select
          value={currentSubdomain}
          onChange={(e) => handleTenantChange(e.target.value)}
          disabled={loading}
          className="bg-indigo-900 border border-indigo-700 text-white rounded px-2 py-1 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
        >
          {!tenants.some((t) => (t.name || t.subdomain) === currentSubdomain) && (
            <option value={currentSubdomain}>{currentSubdomain}</option>
          )}
          {tenants.map((t) => {
            const val = t.name || t.subdomain || t.id;
            return (
              <option key={t.id} value={val}>
                {t.name}
              </option>
            );
          })}
        </select>
      </div>

      {/* Derecha: Botón Volver al Panel Global */}
      <button
        type="button"
        onClick={() => router.push("/superadmin")}
        className="flex items-center gap-1.5 bg-indigo-800 hover:bg-indigo-700 text-indigo-100 px-3 py-1 rounded transition-colors font-medium cursor-pointer"
        title="Volver a la consola central de Superadmin"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Volver al Panel Global</span>
      </button>
    </div>
  );
}
