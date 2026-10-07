"use client";

import React, { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Tenant {
  id: string;
  name: string;
  created_at: string;
  is_active: boolean;
  admin_email: string | null;
  last_sign_in_at: string | null;
  tenant_quotas: {
    weekly_limit: number;
    used_this_week: number;
  };
}

interface Orphan {
  user_id: string;
  email: string;
  role: string | null;
}

export default function SuperadminDashboard() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [orphans, setOrphans] = useState<Orphan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [newQuota, setNewQuota] = useState<number | "">("");
  
  const [resolvingUserId, setResolvingUserId] = useState<string | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("admin");
  const [newTenantName, setNewTenantName] = useState<string>("");

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
        setTenants(data.tenants || data.data || []);
      }
    } catch (error) {
      console.error("Error fetching tenants:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrphans = async () => {
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/superadmin/orphans", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrphans(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching orphans:", error);
    }
  };

  useEffect(() => {
    fetchTenants();
    fetchOrphans();
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

  const toggleTenantStatus = async (tenantId: string, currentStatus: boolean) => {
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/superadmin/tenants/${tenantId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: !currentStatus })
      });
      if (res.ok) {
        await fetchTenants();
      }
    } catch (error) {
      console.error("Error toggling status:", error);
    }
  };

  const resendInvite = async (tenantId: string, email: string) => {
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/superadmin/tenants/${tenantId}/resend-invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        alert("Invitación reenviada exitosamente a " + email);
      }
    } catch (error) {
      console.error("Error resending invite:", error);
    }
  };

  const handleResolve = async (userId: string, action: "assign" | "reject" | "create_tenant") => {
    try {
      const token = await getAuthToken();
      let body: any = { action };
      if (action === "assign") {
        body = { action, tenant_id: selectedTenantId, role: selectedRole };
      } else if (action === "create_tenant") {
        body = { action, tenant_name: newTenantName };
      }

      const res = await fetch(`/api/superadmin/orphans/${userId}/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        await fetchOrphans();
        setResolvingUserId(null);
      } else {
        console.error("Error resolving orphan");
      }
    } catch (error) {
      console.error("Error resolving orphan:", error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Panel Global — Superadmin</h1>
          <p className="text-gray-600 text-sm">Gestión de Organizaciones (Tenants), Cuotas y Onboarding</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/superadmin/tenants/new"
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
      
      {orphans.length > 0 && (
        <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-yellow-800">
                Usuarios Pendientes ({orphans.length})
              </h2>
              <p className="text-sm text-yellow-700">
                Hay usuarios que se han registrado y están esperando asignación a una organización.
              </p>
            </div>
          </div>
          
          <div className="mt-4 overflow-x-auto bg-white rounded shadow-sm border border-yellow-100">
            <table className="min-w-full table-auto">
              <thead className="bg-yellow-100/50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Email</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Estado</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-yellow-100">
                {orphans.map(orphan => (
                  <tr key={orphan.user_id}>
                    <td className="px-4 py-3 text-sm text-gray-900">{orphan.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Sin asignar</td>
                    <td className="px-4 py-3 text-sm">
                      {resolvingUserId === orphan.user_id ? (
                        <div className="flex items-center gap-2">
                          <select 
                            value={selectedTenantId} 
                            onChange={(e) => setSelectedTenantId(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 text-xs"
                          >
                            <option value="">Seleccionar ONG</option>
                            <option value="new">-- Crear Nueva ONG --</option>
                            {tenants.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                          {selectedTenantId === "new" ? (
                            <input 
                              type="text" 
                              placeholder="Nombre nueva ONG" 
                              value={newTenantName} 
                              onChange={(e) => setNewTenantName(e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1 text-xs w-32"
                            />
                          ) : (
                            <select 
                              value={selectedRole} 
                              onChange={(e) => setSelectedRole(e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1 text-xs"
                            >
                              <option value="admin">Admin</option>
                              <option value="operador">Operador</option>
                            </select>
                          )}
                          <button 
                            onClick={() => {
                              if (selectedTenantId === "new") handleResolve(orphan.user_id, "create_tenant");
                              else handleResolve(orphan.user_id, "assign");
                            }}
                            disabled={!selectedTenantId || (selectedTenantId === "new" && !newTenantName) || (selectedTenantId !== "new" && !selectedRole)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs disabled:opacity-50"
                          >
                            {selectedTenantId === "new" ? "Crear y Asignar" : "Asignar"}
                          </button>
                          <button 
                            onClick={() => {
                              setResolvingUserId(null);
                              setNewTenantName("");
                            }}
                            className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-3 py-1 rounded text-xs"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              setResolvingUserId(orphan.user_id);
                              setSelectedTenantId("");
                              setSelectedRole("admin");
                            }}
                            className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1 rounded text-xs font-medium"
                          >
                            Resolver
                          </button>
                          <button 
                            onClick={() => handleResolve(orphan.user_id, "reject")}
                            className="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1 rounded text-xs font-medium"
                          >
                            Rechazar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-gray-500">Cargando organizaciones...</div>
      ) : (
        <div className="overflow-x-auto bg-white shadow-md rounded-lg">
          <table className="min-w-full table-auto">
            <thead className="bg-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Organización (Tenant)</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Estado</th>
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
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${tenant.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {tenant.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{new Date(tenant.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{tenant.tenant_quotas?.weekly_limit || 0}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{tenant.tenant_quotas?.used_this_week || 0}</td>
                  <td className="px-4 py-3 text-sm flex gap-2 flex-wrap">
                    <button
                      onClick={() => handleEditClick(tenant)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs transition"
                    >
                      Editar Cuota
                    </button>
                    <button
                      onClick={() => toggleTenantStatus(tenant.id, tenant.is_active)}
                      className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-xs transition"
                    >
                      {tenant.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                    {!tenant.last_sign_in_at && tenant.admin_email && (
                      <button
                        onClick={() => resendInvite(tenant.id, tenant.admin_email as string)}
                        className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1 rounded text-xs transition"
                      >
                        Reenviar Invitación
                      </button>
                    )}
                    <Link
                      href={`/${tenant.name}/dashboard?impersonate=${tenant.id}`}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-xs transition"
                    >
                      Ver Dashboard
                    </Link>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
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
