ALTER TABLE public.tenants
ADD COLUMN country text,
ADD COLUMN contact_name text,
ADD COLUMN tax_id text,
ADD COLUMN phone text,
ADD COLUMN is_active boolean DEFAULT true;
