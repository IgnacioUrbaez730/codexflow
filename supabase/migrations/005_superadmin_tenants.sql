-- Migration: Configurar rol y esquema Base de Datos (T1)

-- 1. Modificar el ENUM user_role para añadir 'superadmin'
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'superadmin';

-- 2. Crear tabla tenants
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Asegurar que la tabla tenant_quotas tenga la foreign key a tenants
ALTER TABLE tenant_quotas ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE tenant_quotas DROP CONSTRAINT IF EXISTS fk_tenant_quotas_tenant_id;
ALTER TABLE tenant_quotas ADD CONSTRAINT fk_tenant_quotas_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- 4. Modificar user_profiles para referenciar a tenants
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS fk_user_profiles_tenant_id;
ALTER TABLE user_profiles ADD CONSTRAINT fk_user_profiles_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE user_profiles ALTER COLUMN tenant_id DROP NOT NULL;
