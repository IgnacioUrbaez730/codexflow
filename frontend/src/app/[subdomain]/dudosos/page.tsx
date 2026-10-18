"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function DudososRedirectPage() {
  const params = useParams() as { subdomain: string };
  const router = useRouter();

  useEffect(() => {
    // Redirección canónica a la mesa de evaluación/dudosos consolidada (T03-F2-06)
    if (params?.subdomain) {
      router.replace(`/${params.subdomain}/evaluacion?queue=doubtful`);
    }
  }, [params?.subdomain, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">
      <p className="text-sm font-medium">Redirigiendo a la bandeja consolidada de evaluación...</p>
    </div>
  );
}
