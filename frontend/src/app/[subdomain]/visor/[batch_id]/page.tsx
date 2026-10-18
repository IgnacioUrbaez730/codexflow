"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function VisorBatchRedirectPage() {
  const params = useParams() as { subdomain: string; batch_id?: string };
  const router = useRouter();

  useEffect(() => {
    // Redirección canónica al visor principal conservando el batch_id si aplica (T03-F2-06)
    if (params?.subdomain) {
      const targetUrl = params.batch_id
        ? `/${params.subdomain}/visor?batch_id=${encodeURIComponent(params.batch_id)}`
        : `/${params.subdomain}/visor`;
      router.replace(targetUrl);
    }
  }, [params?.subdomain, params?.batch_id, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">
      <p className="text-sm font-medium">Redirigiendo al visor canónico...</p>
    </div>
  );
}
