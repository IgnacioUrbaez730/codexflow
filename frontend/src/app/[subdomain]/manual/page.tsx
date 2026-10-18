'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useTenant } from '@/context/TenantContext';
import ManualView from '@/components/manual/ManualView';

export default function SubdomainManualPage() {
  const params = useParams() as { subdomain?: string };
  const { role, subdomain: tenantSubdomain } = useTenant();
  const subdomain = params?.subdomain || tenantSubdomain || '';

  return (
    <div className="w-full min-h-screen bg-slate-50/50 dark:bg-slate-950">
      <ManualView
        isEmbedded={true}
        subdomain={subdomain}
        userRole={role}
      />
    </div>
  );
}
