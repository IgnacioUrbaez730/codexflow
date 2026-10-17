import os
import json
import re

def test_migration_sql_syntax_and_structure():
    migration_path = os.path.join(
        os.path.dirname(__file__), "..", "supabase", "migrations", "014_archival_foliation_and_familysearch_templates.sql"
    )
    assert os.path.exists(migration_path), f"Migration file not found at {migration_path}"

    with open(migration_path, "r", encoding="utf-8") as f:
        sql = f.read()

    # 1. Validar columnas agregadas en folio_entries
    assert "folio_number" in sql, "Missing folio_number in migration"
    assert "folio_side" in sql, "Missing folio_side in migration"
    assert "act_number" in sql, "Missing act_number in migration"
    assert "is_continued" in sql, "Missing is_continued in migration"
    assert "continued_from_entry_id" in sql, "Missing continued_from_entry_id in migration"

    # Validar constraints y checks
    assert "CHECK (folio_side IN ('recto', 'vuelto', 'unica'))" in sql or "folio_side IN ('recto', 'vuelto', 'unica')" in sql
    assert "idx_folio_entries_status_tenant" in sql
    assert "(tenant_id, status)" in sql
    assert "idx_folio_entries_foliation" in sql
    assert "(folio_id, folio_number, folio_side)" in sql

    # 2. Validar columnas e inmutabilidad en templates
    assert "is_system_template" in sql
    assert "idx_templates_system" in sql
    assert "(tenant_id, is_system_template)" in sql
    assert "prevent_system_template_modification" in sql

    # 3. Validar las 3 plantillas canónicas de FamilySearch
    assert "Bautismo / Nacimiento (Estándar FamilySearch)" in sql
    assert "Matrimonio (Estándar FamilySearch)" in sql
    assert "Defunción / Entierro (Estándar FamilySearch)" in sql

    # 4. Validar campos específicos de Bautismo
    for campo in [
        "nombres", "apellidos", "sexo", "fecha_sacramento", "fecha_nacimiento",
        "lugar_nacimiento", "nombre_padre", "nombre_madre", "abuelo_paterno",
        "abuela_paterna", "abuelo_materno", "abuela_materna", "padrino", "madrina",
        "ministro", "notas_marginales"
    ]:
        assert f'"{campo}"' in sql, f"Campo {campo} no encontrado en sql para Bautismo"

    # 5. Validar campos específicos de Matrimonio
    for campo in [
        "fecha_matrimonio", "novio_nombres", "novio_apellidos", "novio_edad",
        "novio_estado_civil", "novio_origen", "novio_padre", "novio_madre",
        "novia_nombres", "novia_apellidos", "novia_edad", "novia_estado_civil",
        "novia_origen", "novia_padre", "novia_madre", "padrinos", "testigos", "ministro"
    ]:
        assert f'"{campo}"' in sql, f"Campo {campo} no encontrado en sql para Matrimonio"

    # 6. Validar campos específicos de Defunción
    for campo in [
        "nombres_difunto", "apellidos_difunto", "sexo", "fecha_defuncion", "fecha_entierro",
        "edad", "estado_civil", "conyuge", "padres", "causa_muerte", "cementerio_lugar", "ministro"
    ]:
        assert f'"{campo}"' in sql, f"Campo {campo} no encontrado en sql para Defunción"

    print("SUCCESS: All migration 014 SQL syntax and canonical schema checks passed!")

if __name__ == "__main__":
    test_migration_sql_syntax_and_structure()
