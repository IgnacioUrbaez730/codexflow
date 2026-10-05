"use server";

import { createClient } from "../lib/supabase";
import { checkQuotaLimit } from "./quotas.actions";

export async function getDudosos(tenant_id: string, token: string) {
  const supabase = createClient(token);
  
  // Asumimos que RLS filtra los folios por archivista si es necesario,
  // aquí sólo consultamos los que están en status 'revision' (dudosos).
  const { data, error } = await supabase
    .from('folios')
    .select(`
      id, 
      batch_id, 
      status, 
      metadata, 
      r2_url, 
      created_at,
      batches (
        uploaded_by
      )
    `)
    .eq('status', 'revision')
    // El filtrado por usuario (Archivista que lo subió) lo debe hacer RLS
    // pero incluimos la información básica si fuera necesaria.
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching dudosos:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function saveFolio(
  folio_id: string, 
  tenant_id: string,
  metadata: any, 
  previousStatus: string, 
  token: string
) {
  const supabase = createClient(token);

  // Si el estado anterior NO era revision, descontamos cuota
  if (previousStatus !== 'revision') {
    const quota = await checkQuotaLimit(tenant_id);
    if (quota.bloqueado) {
      throw new Error(`Cuota excedida: ${quota.reason}`);
    }
  }

  // Actualizamos el folio a estado completed y guardamos la metadata
  const { data, error } = await supabase
    .from('folios')
    .update({ 
      status: 'completed',
      metadata: metadata 
    })
    .eq('id', folio_id)
    .select()
    .single();

  if (error) {
    console.error("Error saving folio:", error);
    throw new Error(error.message);
  }

  return data;
}
