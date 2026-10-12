-- Migración 011: Tabla de solicitudes de demostración (demo_requests)
-- Permite que visitantes anónimos o autenticados envíen solicitudes sin poder consultar las de otros.

CREATE TABLE IF NOT EXISTS public.demo_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    organization TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;

-- Política de inserción pública para anónimos y autenticados
CREATE POLICY "Permitir insercion publica de demo_requests"
ON public.demo_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Política de lectura restringida únicamente a service_role o administradores autenticados
CREATE POLICY "Solo administradores pueden leer demo_requests"
ON public.demo_requests
FOR SELECT
TO authenticated
USING (
    auth.jwt() ->> 'role' = 'service_role' OR 
    (auth.jwt() ->> 'is_superadmin')::boolean = true
);
