"use client";

import React, { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Tenant {
  id: string;
  name: string;
  created_at: string;
  tenant_quotas: {
    weekly_limit: number;
    used_this_week: number;
  };
}

export default function SuperadminDashboard() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [newQuota, setNewQuota] = useState<number | "">("");
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || "";
  };

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/superadmin/tenants", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setTenants(data.tenants || data);
      }
    } catch (error) {
      console.error("Error fetching tenants:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleEditClick = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setNewQuota(tenant.tenant_quotas?.weekly_limit || 0);
  };

  const handleSaveQuota = async () => {
    if (!editingTenant || newQuota === "") return;

    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/superadmin/tenants/${editingTenant.id}/quota`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ weekly_limit: Number(newQuota) })
      });

      if (res.ok) {
        await fetchTenants();
        setEditingTenant(null);
        setNewQuota("");
      } else {
        console.error("Error updating quota");
      }
    } catch (error) {
      console.error("Error updating quota:", error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Panel Global — Superadmin</h1>
          <p className="text-gray-600 text-sm">Gestión de Organizaciones (Tenants), Cuotas y Onboarding</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/superadmin/new"
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-medium text-sm transition"
          >
            + Nueva Organización
          </Link>
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-medium text-sm transition"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="p-12 text-center text-gray-500">Cargando organizaciones...</div>
      ) : (
        <div className="overflow-x-auto bg-white shadow-md rounded-lg">
          <table className="min-w-full table-auto">
            <thead className="bg-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Organización (Tenant)</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Fecha Alta</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Límite Semanal</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Consumo Actual</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tenants.map(tenant => (
                <tr key={tenant.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{tenant.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{new Date(tenant.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{tenant.tenant_quotas?.weekly_limit || 0}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{tenant.tenant_quotas?.used_this_week || 0}</td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={() => handleEditClick(tenant)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs transition"
                    >
                      Editar Cuota
                    </button>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No hay organizaciones registradas todavía. Crea la primera con el botón de arriba.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Editar Cuota */}
      {editingTenant && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Editar Cuota</h2>
            <p className="mb-4 text-sm text-gray-600">
              Organización: <strong>{editingTenant.name}</strong>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nuevo Límite Semanal (Folios)
              </label>
              <input
                type="number"
                value={newQuota}
                onChange={(e) => setNewQuota(e.target.value ? Number(e.target.value) : "")}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-300 text-gray-900"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setEditingTenant(null)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveQuota}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
