"""
Pruebas de validación sintáctica y estructural para la migración 012:
supabase/migrations/012_document_folders_and_entries.sql
"""
import os
import re
import pytest

MIGRATION_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "supabase",
    "migrations",
    "012_document_folders_and_entries.sql"
)

def read_migration_sql():
    assert os.path.exists(MIGRATION_PATH), f"El archivo de migración no existe en {MIGRATION_PATH}"
    with open(MIGRATION_PATH, "r", encoding="utf-8") as f:
        return f.read()

def test_migration_file_exists():
    assert os.path.isfile(MIGRATION_PATH)

def test_t01_db_01_document_folders_and_enum():
    sql = read_migration_sql()
    # Verifica creación de folder_type_enum con los 4 tipos requeridos
    assert "folder_type_enum" in sql
    for val in ["'root'", "'parish'", "'series'", "'tome'"]:
        assert val in sql, f"folder_type_enum debe incluir {val}"

    # Verifica creación de public.document_folders
    assert "CREATE TABLE" in sql and "document_folders" in sql
    assert "tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE" in sql
    assert "parent_id UUID REFERENCES public.document_folders(id) ON DELETE CASCADE" in sql or "parent_id UUID REFERENCES public.document_folders(id)" in sql
    assert "name TEXT NOT NULL" in sql
    assert "folder_type folder_type_enum NOT NULL DEFAULT 'tome'" in sql or "folder_type folder_type_enum NOT NULL" in sql
    assert "metadata JSONB DEFAULT '{}'::jsonb" in sql or "metadata JSONB NOT NULL DEFAULT '{}'::jsonb" in sql
    assert "created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL" in sql or "created_by UUID REFERENCES auth.users(id)" in sql

    # Verifica índices de document_folders
    assert "idx_document_folders_tenant" in sql or "idx_document_folders_tenant_id" in sql
    assert "idx_document_folders_parent" in sql or "idx_document_folders_parent_id" in sql
    assert "idx_document_folders_tenant_type" in sql or "idx_document_folders_tenant_folder_type" in sql

def test_t01_db_02_folios_columns_and_indices():
    sql = read_migration_sql()
    # Verifica alteración de public.folios
    assert "ALTER TABLE" in sql and "folios" in sql
    assert "folder_id UUID REFERENCES public.document_folders(id) ON DELETE SET NULL" in sql
    assert "sequence_order INT DEFAULT 1" in sql or "sequence_order INTEGER DEFAULT 1" in sql
    assert "original_filename TEXT" in sql
    assert "canonical_filename TEXT" in sql

    # Verifica índices de folios
    assert "idx_folios_tenant_folder" in sql or "idx_folios_tenant_id_folder_id" in sql
    assert "idx_folios_folder_sequence" in sql or "idx_folios_folder_id_sequence_order" in sql

def test_t01_db_03_folio_entries_table():
    sql = read_migration_sql()
    # Verifica creación de public.folio_entries
    assert "CREATE TABLE" in sql and "folio_entries" in sql
    assert "tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE" in sql
    assert "folio_id UUID NOT NULL REFERENCES public.folios(id) ON DELETE CASCADE" in sql
    assert "entry_number INT NOT NULL DEFAULT 1" in sql or "entry_number INTEGER NOT NULL DEFAULT 1" in sql
    assert "folio_status" in sql or "entry_status_enum" in sql
    assert "metadata JSONB DEFAULT '{}'::jsonb" in sql or "metadata JSONB NOT NULL DEFAULT '{}'::jsonb" in sql
    assert "bounding_box JSONB DEFAULT '{}'::jsonb" in sql or "bounding_box JSONB NOT NULL DEFAULT '{}'::jsonb" in sql
    
    # Restricción de unicidad
    assert "CONSTRAINT uq_folio_entry UNIQUE (folio_id, entry_number)" in sql or "UNIQUE (folio_id, entry_number)" in sql

    # Índices en folio_entries
    assert "idx_folio_entries_tenant" in sql or "idx_folio_entries_tenant_id" in sql
    assert "idx_folio_entries_folio" in sql or "idx_folio_entries_folio_id" in sql
    assert "idx_folio_entries_tenant_status" in sql

def test_t01_db_04_rls_policies():
    sql = read_migration_sql()
    # Enable RLS
    assert "ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY" in sql
    assert "ALTER TABLE public.folio_entries ENABLE ROW LEVEL SECURITY" in sql

    # Funciones de seguridad y roles
    assert "public.get_user_tenant()" in sql
    assert "public.get_user_role()" in sql
    assert "public.is_superadmin()" in sql

    # Roles permitidos para carpetas y entradas
    assert "'admin'" in sql and "'archivist'" in sql
    assert "'digitizer'" in sql

def test_t01_db_05_backward_compatibility_migration():
    sql = read_migration_sql()
    # Bloque PL/pgSQL
    assert "DO $$" in sql
    assert "Sin Clasificar (Migración inicial)" in sql
    assert "UPDATE public.folios SET folder_id = v_folder_id WHERE tenant_id = t.id AND folder_id IS NULL" in sql
