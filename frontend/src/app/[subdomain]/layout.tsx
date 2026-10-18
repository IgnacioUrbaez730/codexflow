"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useParams } from "next/navigation";
import { Menu, AlertTriangle } from 'lucide-react';
import Sidebar from "../../components/Sidebar";
import NetworkStatusIndicator from "../../components/NetworkStatusIndicator";
import { SidebarProvider, useSidebar } from "../../context/SidebarContext";
import { TenantProvider, useTenant } from "../../context/TenantContext";

function SubdomainContent({
  subdomain,
  role,
  toastMessage,
  children,
}: {
  subdomain: string;
  role: string | null;
  toastMessage: string | null;
  children: React.ReactNode;
}) {
  const { isCollapsed, toggleMobile } = useSidebar();

  return (
    <div className="subdomain-layout flex flex-col min-h-screen bg-gray-50 text-gray-900 relative">
      {/* Network Connectivity Indicator (T04-F3-01) */}
      <NetworkStatusIndicator />

      {/* Toast alert */}
      {toastMessage && (
        <div
          role="alert"
          className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-amber-600 text-white px-4 py-3 rounded-lg shadow-xl text-sm font-medium animate-bounce"
        >
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-gray-900 text-white z-30 sticky top-0 shadow-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleMobile}
            className="p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
            aria-label="Abrir menú"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-bold tracking-tight text-base">CodexFlow</span>
        </div>
        <span className="text-xs text-gray-400 capitalize bg-gray-800 px-2 py-1 rounded">
          {role === "evaluator" ? "Evaluador de Calidad" : role}
        </span>
      </div>

      {role && <Sidebar subdomain={subdomain} role={role} />}

      <main
        className={`flex-1 overflow-auto transition-all duration-300 ease-in-out ${
          isCollapsed ? "md:ml-16" : "md:ml-64"
        }`}
      >
        {children}
      </main>
    </div>
  );
}

function SubdomainGuard({ children }: { children: React.ReactNode }) {
  const { subdomain } = useParams() as { subdomain: string };
  const router = useRouter();
  const pathname = usePathname();
  const { session, role, loading } = useTenant();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;

    if (!session?.user) {
      router.replace("/login");
      return;
    }

    if (!role) {
      return;
    }

    // Role-based route guard
    if (role === "digitizer") {
      const isRestricted =
        pathname.startsWith(`/${subdomain}/ingest`) ||
        pathname.startsWith(`/${subdomain}/evaluacion`) ||
        pathname.startsWith(`/${subdomain}/settings/users`) ||
        pathname.startsWith(`/${subdomain}/records`);

      const isAllowed =
        pathname.startsWith(`/${subdomain}/visor`) ||
        pathname.startsWith(`/${subdomain}/metrics`) ||
        pathname.startsWith(`/${subdomain}/manual`);

      if (isRestricted || !isAllowed) {
        setToastMessage("Acceso restringido a tu rol");
        const timer = setTimeout(() => setToastMessage(null), 3500);
        router.replace(`/${subdomain}/visor`);
        return () => clearTimeout(timer);
      }
    }

    if (role === "evaluator") {
      const isRestrictedForEvaluator =
        pathname.startsWith(`/${subdomain}/ingest`) ||
        pathname.startsWith(`/${subdomain}/settings/users`);
      if (isRestrictedForEvaluator) {
        setToastMessage("Acceso restringido a tu rol");
        const timer = setTimeout(() => setToastMessage(null), 3500);
        router.replace(`/${subdomain}/evaluacion`);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, session, role, pathname, subdomain, router]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Verificando accesos...</div>;
  }

  return (
    <SidebarProvider>
      <SubdomainContent subdomain={subdomain} role={role} toastMessage={toastMessage}>
        {children}
      </SubdomainContent>
    </SidebarProvider>
  );
}

export default function SubdomainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TenantProvider>
      <SubdomainGuard>{children}</SubdomainGuard>
    </TenantProvider>
  );
}
