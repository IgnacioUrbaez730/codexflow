'use client';
import { useState, useEffect } from 'react';

interface DashboardData {
  productivity: { date: string; folios: number }[];
  uploadedCount: number;
  verifiedCount: number;
  quota: { used_this_week: number; weekly_limit: number };
}

export default function DashboardPage({ params }: { params: { subdomain: string } }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('supabase.auth.token');
        const headers: Record<string, string> = {};
        if (token) {
          const parsed = JSON.parse(token);
          headers['Authorization'] = `Bearer ${parsed.currentSession.access_token}`;
        }
        
        // Mock token fallback
        if (!headers['Authorization']) {
          headers['Authorization'] = 'Bearer DUMMY';
        }

        const res = await fetch('/api/tenant/metrics', {
          headers
        });
        
        if (res.ok) {
          const json = await res.json();
          setData(json);
        } else {
          console.error("Failed to fetch metrics");
          // Fallback en caso de error
          setData({
            productivity: [],
            uploadedCount: 0,
            verifiedCount: 0,
            quota: { used_this_week: 0, weekly_limit: 1000 }
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.subdomain]);

  const isQuotaExpired = data && data.quota.used_this_week >= data.quota.weekly_limit;

  if (loading) return <div className="p-8 font-sans">Cargando dashboard...</div>;

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      {isQuotaExpired && (
        <div className="bg-red-500 text-white p-4 rounded mb-6 text-center font-bold">
          Procesamiento Congelado: Has alcanzado el límite de tu cuota semanal ({data.quota.used_this_week} / {data.quota.weekly_limit}). 
          Las subidas están deshabilitadas, pero aún puedes ver tus métricas históricas.
        </div>
      )}

      <h1 className="text-2xl font-bold mb-4">Dashboard del Tenant: {params.subdomain}</h1>
      <p className="mb-8">Bienvenido a tu espacio aislado de trabajo.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* KPI: Funnel */}
        <section className="p-6 bg-white rounded shadow-md border border-gray-100">
          <h2 className="text-xl font-semibold mb-4">Embudo: Subidos vs Verificados</h2>
          <div className="flex justify-between items-center bg-gray-50 p-4 rounded">
            <div className="text-center">
              <p className="text-gray-500 text-sm">Subidos</p>
              <p className="text-3xl font-bold text-blue-600">{data?.uploadedCount}</p>
            </div>
            <div className="text-gray-400 text-2xl">➔</div>
            <div className="text-center">
              <p className="text-gray-500 text-sm">Verificados</p>
              <p className="text-3xl font-bold text-green-600">{data?.verifiedCount}</p>
            </div>
            <div className="text-gray-400 text-2xl">➔</div>
            <div className="text-center">
              <p className="text-gray-500 text-sm">Conversión</p>
              <p className="text-3xl font-bold text-purple-600">
                {data && data.uploadedCount > 0 ? Math.round((data.verifiedCount / data.uploadedCount) * 100) : 0}%
              </p>
            </div>
          </div>
        </section>

        {/* KPI: Quota */}
        <section className="p-6 bg-white rounded shadow-md border border-gray-100">
          <h2 className="text-xl font-semibold mb-4">Consumo de Cuotas (Freemium)</h2>
          <div className="mb-2 flex justify-between text-sm font-medium">
            <span className="text-gray-600">{data?.quota.used_this_week} folios usados</span>
            <span className="text-gray-600">{data?.quota.weekly_limit} folios límite</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden relative">
            <div 
              className={`h-full transition-all duration-500 ${isQuotaExpired ? 'bg-red-500' : 'bg-blue-500'}`} 
              style={{ width: `${Math.min(((data?.quota.used_this_week || 0) / (data?.quota.weekly_limit || 1)) * 100, 100)}%` }}
            ></div>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md">
              {Math.round(Math.min(((data?.quota.used_this_week || 0) / (data?.quota.weekly_limit || 1)) * 100, 100))}%
            </span>
          </div>
        </section>
      </div>

      {/* Gráfica de Tendencia */}
      <section className="p-6 bg-white rounded shadow-md mb-8 border border-gray-100">
        <h2 className="text-xl font-semibold mb-4">Tendencia Global de Productividad (Últimos Días)</h2>
        <div className="h-64 flex items-end gap-2 border-b-2 border-gray-200 pb-2 pt-8">
          {data?.productivity.map((item) => {
            const maxCount = Math.max(...(data?.productivity.map(p => p.folios) || [0]));
            const height = maxCount === 0 ? '10%' : `${(item.folios / maxCount) * 100}%`;
            return (
              <div key={item.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                <div 
                  className="w-full max-w-sm bg-indigo-500 rounded-t hover:bg-indigo-400 transition-colors relative" 
                  style={{ height, minHeight: '10%' }}
                >
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-sm font-bold text-indigo-700 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.folios}
                  </span>
                </div>
                <span className="text-xs text-gray-500 mt-2 truncate w-full text-center block" title={item.date}>
                  {item.date.split('-').slice(1).join('/')}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-sm text-gray-500 mt-4 text-center">Folios procesados por día</p>
      </section>
    </div>
  );
}
