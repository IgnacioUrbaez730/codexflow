import { getSupabaseBrowserClient } from "./supabaseClient";

/**
 * apiFetch: Envoltorio para fetch con inyección automática de credenciales Supabase y x-subdomain.
 *
 * @param url URL del endpoint relativo o absoluto.
 * @param options Opciones estándar de RequestInit.
 * @param subdomain Subdominio opcional para contexto multitenant e impersonación de superadmin.
 * @returns Promise<Response>
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {},
  subdomain?: string
): Promise<Response> {
  const headers = new Headers(options.headers || {});

  if (subdomain && !headers.has("x-subdomain")) {
    headers.set("x-subdomain", subdomain);
  }

  if (!headers.has("Authorization")) {
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers.set("Authorization", `Bearer ${session.access_token}`);
      }
    } catch (err) {
      console.warn("apiFetch: no se pudo obtener token de sesión de Supabase:", err);
    }
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
