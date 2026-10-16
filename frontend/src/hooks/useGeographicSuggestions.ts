import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { GeographicSuggestionsResponse } from "../types/folders";

const EMPTY_SUGGESTIONS: GeographicSuggestionsResponse = {
  countries: [],
  states: [],
  municipalities: [],
  cities_or_localities: [],
  dioceses: [],
  parishes: [],
};

export function useGeographicSuggestions(tenantId?: string) {
  const [suggestions, setSuggestions] = useState<GeographicSuggestionsResponse>(EMPTY_SUGGESTIONS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );

  useEffect(() => {
    let isMounted = true;

    async function fetchSuggestions() {
      setIsLoading(true);
      setError(null);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          if (isMounted) setIsLoading(false);
          return;
        }

        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
        };
        if (tenantId) {
          headers["X-Tenant-ID"] = tenantId;
        }

        const res = await fetch("/api/v1/folders/geographic-suggestions", { headers });
        if (!res.ok) {
          throw new Error(`Error fetching suggestions: ${res.statusText}`);
        }

        const data: GeographicSuggestionsResponse = await res.json();
        if (isMounted) {
          setSuggestions({
            countries: Array.isArray(data.countries) ? data.countries : [],
            states: Array.isArray(data.states) ? data.states : [],
            municipalities: Array.isArray(data.municipalities) ? data.municipalities : [],
            cities_or_localities: Array.isArray(data.cities_or_localities) ? data.cities_or_localities : [],
            dioceses: Array.isArray(data.dioceses) ? data.dioceses : [],
            parishes: Array.isArray(data.parishes) ? data.parishes : [],
          });
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Error al cargar sugerencias geográficas");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchSuggestions();

    return () => {
      isMounted = false;
    };
  }, [tenantId]);

  return { suggestions, isLoading, error };
}
