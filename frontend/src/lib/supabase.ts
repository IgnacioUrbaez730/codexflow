import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createClient(token?: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  const options = token ? {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  } : {};

  return createSupabaseClient(supabaseUrl, supabaseKey, options);
}
