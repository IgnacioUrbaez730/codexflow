'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '../../../../lib/supabaseClient';

interface User {
  user_id: string;
  email: string;
  role: string;
  is_active: boolean;
  folios_today: number;
}

export default function UsersPage() {
  const params = useParams() as { subdomain: string };
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('digitizer');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (session?.user?.id) {
        setCurrentUserId(session.user.id);
      }
      
      const res = await fetch('/api/v1/team', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch team');
      const json = await res.json();
      const list = Array.isArray(json) ? json : (json.data || []);
      setUsers(list);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    setInviteMsg('');
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const res = await fetch('/api/v1/team/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || 'Failed to invite user');
      
      setInviteMsg('Invitación enviada exitosamente');
      setInviteEmail('');
      fetchUsers();
    } catch (err: any) {
      setInviteMsg(`Error: ${err.message}`);
    } finally {
      setInviting(false);
    }
  };

  const updateUser = async (userId: string, updates: Partial<User>) => {
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const res = await fetch(`/api/v1/team/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || 'Failed to update user');
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const userList = Array.isArray(users) ? users : [];
  const activeAdminCount = userList.filter(u => u.role === 'admin' && u.is_active).length;

  const filteredUsers = userList.filter(u => {
    const email = u.email || '';
    const matchesSearch = email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? u.is_active : !u.is_active);
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-8 max-w-6xl mx-auto font-sans">
      <h1 className="text-3xl font-bold mb-8">Gestión de Equipo - {params.subdomain}</h1>

      {/* Alerta preventiva si solo queda un administrador activo */}
      {activeAdminCount <= 1 && !loading && (
        <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 text-sm shadow-sm">
          <span className="text-xl">⚠️</span>
          <div>
            <span className="font-semibold block">Protección de Administración Activa</span>
            <span>
              Solo queda 1 administrador activo en la organización ({activeAdminCount}). Por motivos de continuidad operativa y seguridad institucional, no es posible degradar ni desactivar al último administrador.
            </span>
          </div>
        </div>
      )}
      
      <section className="p-6 bg-white rounded-lg shadow-md mb-8 border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Invitar Usuario</h2>
        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input 
              type="email" 
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="ejemplo@correo.com"
              className="w-full px-3 py-2 border rounded-md"
              required
            />
          </div>
          <div className="w-56">
            <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
            <select 
              value={inviteRole} 
              onChange={e => setInviteRole(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="admin">Admin</option>
              <option value="archivist">Archivista</option>
              <option value="evaluator">Evaluador de Calidad</option>
              <option value="digitizer">Digitador</option>
            </select>
          </div>
          <button 
            type="submit" 
            disabled={inviting}
            className="px-6 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {inviting ? 'Enviando...' : 'Invitar'}
          </button>
        </form>
        {inviteMsg && (
          <div className={`mt-4 p-3 rounded-md text-sm ${inviteMsg.startsWith('Error') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
            {inviteMsg}
          </div>
        )}
      </section>

      <section className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-4 justify-between bg-gray-50">
          <input 
            type="text"
            placeholder="Buscar por email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-2 border rounded-md w-full sm:w-64"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando equipo...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-4 font-semibold text-gray-700">Nombre (Email)</th>
                <th className="p-4 font-semibold text-gray-700">Rol</th>
                <th className="p-4 font-semibold text-gray-700">Folios Hoy</th>
                <th className="p-4 font-semibold text-gray-700">Estado</th>
                <th className="p-4 font-semibold text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => {
                const isSelf = Boolean(currentUserId && u.user_id === currentUserId);
                const isLastAdmin = Boolean(u.role === 'admin' && u.is_active && activeAdminCount <= 1);
                const disableRoleChange = isSelf || isLastAdmin;
                const disableStatusChange = isSelf || (u.is_active && isLastAdmin);

                const roleBadgeClass =
                  u.role === 'evaluator'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : u.role === 'archivist'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : u.role === 'admin'
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200';

                const roleLabel =
                  u.role === 'evaluator'
                    ? 'Evaluador de Calidad'
                    : u.role === 'archivist'
                    ? 'Archivista'
                    : u.role === 'admin'
                    ? 'Admin'
                    : 'Digitador';

                return (
                <tr key={u.user_id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{u.email}</span>
                      {isSelf && (
                        <span className="text-[10px] font-semibold bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded">
                          Tú
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${roleBadgeClass}`}>
                        {roleLabel}
                      </span>
                      <div className="flex flex-col">
                        <select 
                          value={u.role}
                          disabled={disableRoleChange}
                          onChange={e => updateUser(u.user_id, { role: e.target.value })}
                          className={`border rounded p-1 text-sm bg-white ${disableRoleChange ? 'opacity-60 cursor-not-allowed bg-gray-100' : ''}`}
                          title={
                            isSelf
                              ? "No puedes modificar tu propio rol"
                              : isLastAdmin
                              ? "No puedes degradar al único administrador activo"
                              : "Cambiar rol del usuario"
                          }
                        >
                          <option value="admin">Admin</option>
                          <option value="archivist">Archivista</option>
                          <option value="evaluator">Evaluador de Calidad</option>
                          <option value="digitizer">Digitador</option>
                        </select>
                        {isSelf ? (
                          <span className="text-[11px] text-gray-500 mt-0.5">
                            Tu cuenta
                          </span>
                        ) : isLastAdmin ? (
                          <span className="text-[11px] text-amber-700 font-medium mt-0.5">
                            Último admin
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">{u.folios_today || 0}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {u.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="p-4">
                    <button
                      disabled={disableStatusChange}
                      onClick={() => updateUser(u.user_id, { is_active: !u.is_active })}
                      title={
                        isSelf
                          ? "No puedes modificar el estado de tu propia cuenta"
                          : isLastAdmin
                          ? "No puedes desactivar al único administrador activo"
                          : u.is_active ? "Desactivar acceso" : "Reactivar acceso"
                      }
                      className={`text-sm px-3 py-1 rounded border transition-colors ${
                        disableStatusChange
                          ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed opacity-60'
                          : u.is_active
                          ? 'border-red-300 text-red-600 hover:bg-red-50'
                          : 'border-green-300 text-green-600 hover:bg-green-50'
                      }`}
                    >
                      {u.is_active ? 'Desactivar' : 'Reactivar'}
                    </button>
                  </td>
                </tr>
              );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">No se encontraron usuarios</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
