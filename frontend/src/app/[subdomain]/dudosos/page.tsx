"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDudosos } from "../../../actions/folioActions";
import { useRouter, useParams } from "next/navigation";

export default function DudososPage() {
  const params = useParams() as { subdomain: string };
  const [folios, setFolios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string>("admin");
  const router = useRouter();

  useEffect(() => {
    async function fetchDudosos() {
      try {
        setLoading(true);
        // Mock de tenant_id y token para efectos del frontend
        const tenant_id = "org-1"; // Idealmente se obtiene del subdomain o de la sesión
        const token = "mock-token";
        
        const currentRole = localStorage.getItem("mock_role") || "admin";
        setRole(currentRole);

        const currentUserId = localStorage.getItem("mock_user_id") || "user-1"; // En caso real, se extrae del auth
        
        let data = await getDudosos(tenant_id, token);
        data = data || [];

        // Filtrado por rol
        if (currentRole === "archivist") {
          data = data.filter((folio: any) => folio.batches?.uploaded_by === currentUserId);
        }

        setFolios(data);
      } catch (err: any) {
        setError(err.message || "Error al cargar los folios dudosos");
      } finally {
        setLoading(false);
      }
    }

    fetchDudosos();
  }, [params.subdomain]);

  if (loading) return <div className="p-8 text-center">Cargando bandeja de dudosos...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Bandeja de Dudosos</h1>
      <p className="mb-6 text-gray-600">
        Estos folios fueron marcados para revisión. Al corregirlos y guardarlos, no se consumirá cuota adicional.
      </p>

      {folios.length === 0 ? (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center text-gray-500">
          No hay folios dudosos en este momento. ¡Buen trabajo!
        </div>
      ) : (
        <div className="grid gap-4">
          {folios.map((folio) => (
            <div 
              key={folio.id} 
              className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center hover:shadow-md transition-shadow"
            >
              <div>
                <h3 className="font-semibold text-lg">Folio: {folio.id}</h3>
                <p className="text-sm text-gray-500">Lote: {folio.batch_id}</p>
                {role === "admin" && (
                  <p className="text-sm font-medium text-blue-600 mt-1">
                    Archivista Responsable: {folio.batches?.uploaded_by || "Desconocido"}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  Creado: {new Date(folio.created_at).toLocaleString()}
                </p>
              </div>
              <div>
                <Link 
                  href={`/${params.subdomain}/visor/${folio.batch_id}?folioId=${folio.id}&fromRevision=true`}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                >
                  Revisar en Visor
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
