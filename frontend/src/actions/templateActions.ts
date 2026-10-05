import { createClient } from '../lib/supabase';

export async function createTemplate(templateData: any, tenantId: string, token: string) {
  const supabase = createClient(token);
  
  const { data, error } = await supabase
    .from('templates')
    .insert([{ 
      ...templateData, 
      tenant_id: tenantId 
    }])
    .single();
    
  if (error) {
    throw new Error(error.message);
  }
  
  return { data, error };
}

export async function getTemplates(tenantId: string, token: string) {
  const supabase = createClient(token);
  
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('tenant_id', tenantId);
    
  if (error) {
    throw new Error(error.message);
  }
  
  return { data, error };
}
