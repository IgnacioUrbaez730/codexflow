-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: organizations
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    subdomain TEXT NOT NULL UNIQUE,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: organization_users
CREATE TABLE organization_users (
    user_id UUID NOT NULL, -- references auth.users(id) in actual supabase
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'digitador')),
    status TEXT NOT NULL DEFAULT 'active',
    PRIMARY KEY (user_id, organization_id)
);

-- Table: folio_usage_logs
CREATE TABLE folio_usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    date_recorded DATE NOT NULL DEFAULT CURRENT_DATE,
    folios_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE folio_usage_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check if a user belongs to an organization
CREATE OR REPLACE FUNCTION user_belongs_to_organization(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_users
    WHERE organization_users.organization_id = org_id
    AND organization_users.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies for organizations
CREATE POLICY "Users can view their own organizations"
    ON organizations FOR SELECT
    USING (user_belongs_to_organization(id));

-- Policies for organization_users
CREATE POLICY "Users can view members of their organizations"
    ON organization_users FOR SELECT
    USING (user_belongs_to_organization(organization_id) OR user_id = auth.uid());

-- Policies for folio_usage_logs
CREATE POLICY "Users can view usage logs of their organizations"
    ON folio_usage_logs FOR SELECT
    USING (user_belongs_to_organization(organization_id));

CREATE POLICY "Users can insert usage logs of their organizations"
    ON folio_usage_logs FOR INSERT
    WITH CHECK (user_belongs_to_organization(organization_id));

CREATE POLICY "Users can update usage logs of their organizations"
    ON folio_usage_logs FOR UPDATE
    USING (user_belongs_to_organization(organization_id))
    WITH CHECK (user_belongs_to_organization(organization_id));
