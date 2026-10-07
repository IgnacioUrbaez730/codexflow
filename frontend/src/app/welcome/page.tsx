'use client';

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from '@supabase/ssr';

function WelcomePageContent() {
  const router = useRouter();
  const [tenantName, setTenantName] = useState<string>("tu Organización");
  const [session, setSession] = useState<any>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    jobTitle: "",
    password: "",
    confirmPassword: ""
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );

  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');
        const errorCode = params.get('error_code');
        const errorDescription = params.get('error_description');

        if (errorCode) {
          setError(`Error en la invitación: ${errorDescription || errorCode}`);
          setLoading(false);
          return;
        }

        if (accessToken && refreshToken) {
          if (type !== 'invite') {
            setError("El enlace no es una invitación válida.");
            setLoading(false);
            return;
          }
          await supabase.auth.signOut();
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (sessionError) {
            setError("Error al establecer la sesión: " + sessionError.message);
            setLoading(false);
            return;
          }
          window.history.replaceState(null, '', window.location.pathname);
        }

        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (!currentSession) {
          setError("No se encontró una sesión válida. Por favor, usa el enlace de tu correo.");
          setLoading(false);
          return;
        }

        setSession(currentSession);

        try {
          const res = await fetch("/api/auth/me", {
            headers: {
              "Authorization": `Bearer ${currentSession.access_token}`
            }
          });
          
          if (!res.ok) {
            if (res.status === 403) {
              setError("Acceso denegado. Tu cuenta puede estar desactivada.");
            } else {
              setError("Error al obtener información del usuario.");
            }
            setLoading(false);
            return;
          }

          const data = await res.json();
          
          if (data.role === 'pending' || data.role === 'rejected') {
            setError("Tu cuenta no tiene los permisos necesarios.");
            setLoading(false);
            return;
          }
          
          if (!data.tenant_name) {
            setError("No se pudo identificar la organización a la que perteneces.");
            setLoading(false);
            return;
          }

          setTenantName(data.tenant_name);
          if (data.has_completed_onboarding) {
            setHasCompletedOnboarding(true);
          }
        } catch (fetchErr) {
          setError("Error de red: No se pudo conectar con el servidor.");
          setLoading(false);
          return;
        }

      } catch (err: any) {
        console.error("Error en inicialización:", err);
        setError(err.message || "Error desconocido");
      } finally {
        setLoading(false);
      }
    };
    
    initialize();
  }, [supabase]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/auth/complete-onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          first_name: formData.firstName,
          last_name: formData.lastName,
          job_title: formData.jobTitle,
          password: formData.password
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Error al completar el registro.");
      }

      router.push(`/${encodeURIComponent(tenantName)}/dashboard`);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <p>Cargando información...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-xl font-bold text-red-600 mb-4">Error de Acceso</h2>
          <p className="text-gray-700">{error}</p>
        </div>
      </div>
    );
  }

  if (hasCompletedOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Cuenta ya configurada</h2>
          <p className="text-gray-600 mb-6">Tu cuenta ya ha completado el proceso de configuración inicial.</p>
          <button
            onClick={() => router.push(`/${encodeURIComponent(tenantName)}/dashboard`)}
            className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Ir a mi Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Bienvenido a {tenantName}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Completa tu perfil para comenzar
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div className="mb-4">
              <label htmlFor="firstName" className="sr-only">Nombre</label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Nombre"
                value={formData.firstName}
                onChange={handleChange}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="lastName" className="sr-only">Apellido</label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Apellido"
                value={formData.lastName}
                onChange={handleChange}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="jobTitle" className="sr-only">Cargo (Opcional)</label>
              <input
                id="jobTitle"
                name="jobTitle"
                type="text"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Cargo"
                value={formData.jobTitle}
                onChange={handleChange}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="password" className="sr-only">Contraseña</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Contraseña"
                value={formData.password}
                onChange={handleChange}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="confirmPassword" className="sr-only">Confirmar Contraseña</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Confirmar Contraseña"
                value={formData.confirmPassword}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={saving}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
            >
              {saving ? "Guardando..." : "Guardar y Entrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <WelcomePageContent />
    </Suspense>
  );
}
