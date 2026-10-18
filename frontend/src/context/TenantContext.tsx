"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useParams } from "next/navigation";
import { getSupabaseBrowserClient } from "../lib/supabaseClient";

interface TenantContextType {
  session: Session | null;
  user: User | null;
  role: string | null;
  tenantId: string | null;
  subdomain: string;
  loading: boolean;
  refreshAuth: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({
  children,
  subdomain: propSubdomain,
}: {
  children: React.ReactNode;
  subdomain?: string;
}) {
  const params = useParams();
  const subdomain = propSubdomain || (params?.subdomain as string) || "";

  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchAuth = useCallback(async (currentSession?: Session | null) => {
    try {
      const supabase = getSupabaseBrowserClient();
      let activeSession = currentSession;
      if (activeSession === undefined) {
        const { data } = await supabase.auth.getSession();
        activeSession = data.session;
      }

      if (!activeSession?.user) {
        setSession(null);
        setUser(null);
        setRole(null);
        setTenantId(null);
        setLoading(false);
        return;
      }

      setSession(activeSession);
      setUser(activeSession.user);

      const res = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${activeSession.access_token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setRole(data.role || null);
        setTenantId(data.tenant_id || data.tenantId || null);
      } else {
        setRole(null);
        setTenantId(null);
      }
    } catch (err) {
      console.error("Error in TenantContext fetchAuth:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseBrowserClient();

    supabase.auth.getSession().then(({ data: { session: initSession } }) => {
      if (isMounted) {
        fetchAuth(initSession);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "USER_UPDATED" ||
        event === "TOKEN_REFRESHED"
      ) {
        if (isMounted) {
          fetchAuth(newSession);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchAuth]);

  const refreshAuth = useCallback(async () => {
    setLoading(true);
    await fetchAuth();
  }, [fetchAuth]);

  return (
    <TenantContext.Provider
      value={{
        session,
        user,
        role,
        tenantId,
        subdomain,
        loading,
        refreshAuth,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextType {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}
