"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import {
  CalendarCheck,
  TrendingUp,
  Award,
  ArrowRight,
  Clock,
  FileText,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  AlertCircle
} from "lucide-react";

interface RecentFolio {
  id: string;
  filename: string;
  template_name: string;
  status: string;
  verified_at: string | null;
}

interface DigitizerMetrics {
  user_id: string;
  tenant_id: string;
  full_name: string | null;
  folios_today: number;
  folios_last_7_days: number;
  folios_total_verified: number;
  last_activity_at: string | null;
  recent_folios?: RecentFolio[];
}

export default function DigitizerMetricsPage() {
  const { subdomain } = useParams() as { subdomain: string };
  const router = useRouter();
  const [metrics, setMetrics] = useState<DigitizerMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
      );
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/v1/digitizer/metrics", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error("No se pudieron cargar las métricas.");
      }

      const json = await res.json();
      if (json.status === "success" && json.data) {
        setMetrics(json.data);
      } else {
        throw new Error(json.detail || "Error al procesar métricas.");
      }
    } catch (err: any) {
      setError(err.message || "Error de conexión con el servidor.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "Sin actividad reciente";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Mis Métricas de Indexación
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
              <Sparkles className="w-3.5 h-3.5" />
              Digitador
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {metrics?.full_name ? `Hola, ${metrics.full_name}. ` : ""}
            Consulta tu progreso diario, semanal y acumulado de transcripción.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchMetrics(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700 transition shadow-sm disabled:opacity-50"
            title="Actualizar datos"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-blue-600" : ""}`} />
            <span>Actualizar</span>
          </button>

          <Link
            href={`/${subdomain}/visor`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition shadow-sm shadow-blue-500/20"
          >
            <span>Ir al Visor de Indexación</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/40 text-red-800 dark:text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button
            onClick={() => fetchMetrics()}
            className="text-xs font-semibold underline hover:no-underline"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Loading Skeleton vs KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm animate-pulse space-y-4"
            >
              <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/3"></div>
              <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded w-1/2"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : metrics ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Folios Hoy */}
          <div className="p-6 rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-gradient-to-br from-blue-50/50 to-white dark:from-gray-900 dark:to-gray-900 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Folios Completados Hoy
              </span>
              <div className="p-2.5 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300">
                <CalendarCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                {metrics.folios_today}
              </span>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                folios
              </span>
            </div>
            <p className="mt-3 text-xs text-blue-600 dark:text-blue-400 font-medium">
              Calculado desde las 00:00 UTC de hoy
            </p>
          </div>

          {/* Últimos 7 Días */}
          <div className="p-6 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-br from-indigo-50/50 to-white dark:from-gray-900 dark:to-gray-900 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Últimos 7 Días
              </span>
              <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                {metrics.folios_last_7_days}
              </span>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                folios
              </span>
            </div>
            <p className="mt-3 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
              Rendimiento semanal consolidado
            </p>
          </div>

          {/* Total Histórico Verificado */}
          <div className="p-6 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50/50 to-white dark:from-gray-900 dark:to-gray-900 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Total Histórico Verificado
              </span>
              <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300">
                <Award className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                {metrics.folios_total_verified}
              </span>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                folios
              </span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>Último: {formatDate(metrics.last_activity_at)}</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Motivational Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold">¡Tu trabajo preserva la historia!</h2>
          <p className="text-sm text-blue-100">
            Cada folio transcrito con precisión acelera la indexación patrimonial y garantiza registros fidedignos.
          </p>
        </div>
        <Link
          href={`/${subdomain}/visor`}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white text-blue-700 font-semibold text-sm hover:bg-blue-50 transition shadow-sm flex-shrink-0"
        >
          <span>Continuar Transcribiendo</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Recent Activity Table */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Folios Recientes Transcritos
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Últimas partidas guardadas y verificadas
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
            {metrics?.recent_folios?.length || 0} mostrados
          </span>
        </div>

        {loading ? (
          <div className="p-6 space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded"></div>
            ))}
          </div>
        ) : metrics?.recent_folios && metrics.recent_folios.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase text-gray-400 font-medium">
                <tr>
                  <th scope="col" className="px-6 py-3">Folio / Documento</th>
                  <th scope="col" className="px-6 py-3">Plantilla</th>
                  <th scope="col" className="px-6 py-3">Fecha Verificación</th>
                  <th scope="col" className="px-6 py-3">Estado</th>
                  <th scope="col" className="px-6 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {metrics.recent_folios.map((folio) => (
                  <tr
                    key={folio.id}
                    className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <span className="truncate max-w-xs">{folio.filename}</span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400">
                      {folio.template_name}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(folio.verified_at)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Completado
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/${subdomain}/visor?folio_id=${folio.id}`}
                        className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        Ver en Visor
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 px-4 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              No hay folios transcritos aún
            </h4>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              Comienza a indexar folios en el Visor para registrar tu progreso y ver aquí tus estadísticas de productividad.
            </p>
            <div className="mt-4">
              <Link
                href={`/${subdomain}/visor`}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                <span>Empezar en el Visor</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
