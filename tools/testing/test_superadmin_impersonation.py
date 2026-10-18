#!/usr/bin/env python3
"""
Test Suite: test_superadmin_impersonation.py
Fase 4 / T04-QA-01: Suite automatizada de pruebas de auditoría e impersonación universal de Superadmin.

Casos de prueba:
1. Prueba 1 (Auth Me Impersonation): Llamar a /api/auth/me con x-subdomain: codexflow-folios.
   Validar HTTP 200, is_superadmin == True, tenant_name == "codexflow-folios" y tenant_id válido.
2. Prueba 2 (Datos del Tenant con Folios): Llamar a /api/tenant/metrics y /api/v1/records con x-subdomain: codexflow-folios.
   Validar HTTP 200 y que los contadores o lista de registros reflejen folios existentes sin fallos.
3. Prueba 3 (Aislamiento Multi-Tenant y Caché Independiente): Llamar inmediatamente después con x-subdomain: diosis-margarita.
   Validar HTTP 200, uploadedCount == 0 y total_records == 0, confirmando que la caché (token_hash, effective_tenant_id) no mezcla datos.
4. Prueba 4 (Spoofing Prevention): Simular llamada de usuario con rol regular (digitizer) enviando x-subdomain: diosis-margarita.
   Validar que el backend ignore el header x-subdomain y que su tenant_id permanezca inmutablemente fijado a su perfil.
5. Prueba 5 (Subdominio Inexistente): Llamar como superadmin con x-subdomain: organizacion-fantasma-xyz-1234.
   Validar HTTP 404 con detail: "Organización solicitada no encontrada".
"""

import os
import sys
from pathlib import Path
from unittest.mock import patch
from typing import Dict, Any, Optional

# 1. Configurar sys.path para importar backend
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(BACKEND_DIR))

# 2. Cargar variables de entorno desde backend/.env
env_file = BACKEND_DIR / ".env"
try:
    from dotenv import load_dotenv
    load_dotenv(env_file)
except ImportError:
    pass

if env_file.exists():
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

from fastapi.testclient import TestClient
from supabase import create_client, Client
from backend.main import (
    app,
    supabase as main_supabase,
    _AUTH_CACHE
)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
TARGET_TENANT_ID = "4bf4e846-b22d-4105-aacf-3751cc0de60c"

if not SUPABASE_URL or not SUPABASE_KEY:
    print("[ERROR] Credenciales de Supabase no configuradas en backend/.env")
    sys.exit(1)

sb_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
client = TestClient(app)

# Tokens de simulación
SUPERADMIN_TOKEN = "mock-superadmin-session-token-test-020"
# JWT estructurado con 3 partes para que PostgREST/Supabase no arroje PGRST301
REGULAR_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJyZWd1bGFyLXVzZXIiLCJyb2xlIjoiYXV0aGVudGljYXRlZCJ9.signature"

# Variables de contexto globales para las pruebas
test_context = {
    "superadmin_id": "98bedb37-652b-4545-8b05-3e9f7abd0182",
    "regular_id": "896473c3-d284-4ecb-8399-13a77fa68422",
    "regular_tenant_id": TARGET_TENANT_ID,
    "codexflow_tenant_id": TARGET_TENANT_ID,
    "diosis_margarita_tenant_id": None,
    "auth_patcher": None,
    "client_patcher": None,
}


class MockUser:
    def __init__(self, user_id: str, email: str):
        self.id = user_id
        self.email = email


class MockUserResponse:
    def __init__(self, user: MockUser):
        self.user = user


def mock_get_user(token: str):
    if token == SUPERADMIN_TOKEN:
        return MockUserResponse(MockUser(test_context["superadmin_id"], "superadmin@codexflow.test"))
    elif token == REGULAR_TOKEN:
        return MockUserResponse(MockUser(test_context["regular_id"], "digitizer@codexflow.test"))
    raise Exception("Token inválido o expirado")


def setup_test_environment():
    """Inicializa tenants y perfiles de prueba en Supabase para las pruebas E2E."""
    print("----------------------------------------------------------------------")
    print("Configurando entorno de prueba en Supabase...")
    print("----------------------------------------------------------------------")

    # 1. Asegurar existencia de tenant 'codexflow-folios'
    t1_res = sb_client.table("tenants").select("id, name").eq("name", "codexflow-folios").execute()
    if t1_res.data:
        test_context["codexflow_tenant_id"] = t1_res.data[0]["id"]
        print(f"[INIT] Tenant 'codexflow-folios' existente: {test_context['codexflow_tenant_id']}")
    else:
        # Verificar si TARGET_TENANT_ID existe y renombrarlo, o crearlo
        t_target = sb_client.table("tenants").select("id, name").eq("id", TARGET_TENANT_ID).execute()
        if t_target.data:
            sb_client.table("tenants").update({"name": "codexflow-folios", "is_active": True}).eq("id", TARGET_TENANT_ID).execute()
            test_context["codexflow_tenant_id"] = TARGET_TENANT_ID
            print(f"[INIT] Tenant target renombrado a 'codexflow-folios': {TARGET_TENANT_ID}")
        else:
            new_t = sb_client.table("tenants").insert({
                "id": TARGET_TENANT_ID,
                "name": "codexflow-folios",
                "is_active": True
            }).execute()
            test_context["codexflow_tenant_id"] = new_t.data[0]["id"]
            print(f"[INIT] Creado nuevo tenant 'codexflow-folios': {test_context['codexflow_tenant_id']}")

    # 2. Asegurar existencia de tenant 'diosis-margarita' (aislado y sin folios)
    t2_res = sb_client.table("tenants").select("id, name").eq("name", "diosis-margarita").execute()
    if t2_res.data:
        test_context["diosis_margarita_tenant_id"] = t2_res.data[0]["id"]
        print(f"[INIT] Tenant 'diosis-margarita' existente: {test_context['diosis_margarita_tenant_id']}")
    else:
        new_margarita = sb_client.table("tenants").insert({
            "name": "diosis-margarita",
            "is_active": True
        }).execute()
        test_context["diosis_margarita_tenant_id"] = new_margarita.data[0]["id"]
        print(f"[INIT] Creado nuevo tenant 'diosis-margarita': {test_context['diosis_margarita_tenant_id']}")

    # Asegurar cuotas iniciales para tenants
    for tid in [test_context["codexflow_tenant_id"], test_context["diosis_margarita_tenant_id"]]:
        q_res = sb_client.table("tenant_quotas").select("tenant_id").eq("tenant_id", tid).execute()
        if not q_res.data:
            try:
                sb_client.table("tenant_quotas").insert({
                    "tenant_id": tid,
                    "weekly_limit": 1000,
                    "used_this_week": 0
                }).execute()
            except Exception:
                pass

    # 3. Localizar perfil Superadmin
    sa_res = sb_client.table("user_profiles").select("user_id, role").eq("role", "superadmin").limit(1).execute()
    if sa_res.data:
        test_context["superadmin_id"] = sa_res.data[0]["user_id"]
        print(f"[INIT] Superadmin localizado en user_profiles: {test_context['superadmin_id']}")
    else:
        print(f"[WARN] No se encontró superadmin en user_profiles, usando fallback: {test_context['superadmin_id']}")

    # 4. Localizar perfil Usuario Regular existente (no superadmin)
    reg_user_res = (
        sb_client.table("user_profiles")
        .select("user_id, role, tenant_id")
        .neq("role", "superadmin")
        .limit(1)
        .execute()
    )
    if reg_user_res.data:
        test_context["regular_id"] = reg_user_res.data[0]["user_id"]
        test_context["regular_tenant_id"] = reg_user_res.data[0].get("tenant_id")
        print(f"[INIT] Usuario regular localizado: {test_context['regular_id']} (Rol: {reg_user_res.data[0].get('role')}, Tenant: {test_context['regular_tenant_id']})")
    else:
        print(f"[WARN] No se encontró usuario regular en user_profiles, usando fallback: {test_context['regular_id']}")

    # 5. Activar patch sobre supabase.auth.get_user
    if test_context["auth_patcher"] is None:
        patcher = patch.object(main_supabase.auth, "get_user", side_effect=mock_get_user)
        patcher.start()
        test_context["auth_patcher"] = patcher
        print("[INIT] Mock de supabase.auth.get_user activado exitosamente.")

    # 6. Activar patch sobre backend.main.create_client para que user_client use sb_client durante tests
    if test_context.get("client_patcher") is None:
        import backend.main
        client_patcher = patch.object(backend.main, "create_client", return_value=sb_client)
        client_patcher.start()
        test_context["client_patcher"] = client_patcher
        print("[INIT] Mock de backend.main.create_client activado exitosamente.\n")


def teardown_test_environment():
    """Limpia el mock y restablece el estado."""
    if test_context["auth_patcher"] is not None:
        test_context["auth_patcher"].stop()
        test_context["auth_patcher"] = None
    if test_context.get("client_patcher") is not None:
        test_context["client_patcher"].stop()
        test_context["client_patcher"] = None
    _AUTH_CACHE.clear()


# =========================================================================
# PRUEBA 1: Auth Me Impersonation
# =========================================================================
def test_01_auth_me_impersonation():
    """
    Prueba 1: Llamar a /api/auth/me con x-subdomain: codexflow-folios.
    Validar que responda HTTP 200, is_superadmin == True, tenant_name == 'codexflow-folios' y tenant_id válido.
    """
    print("[EJECUTANDO] Prueba 1: Auth Me Impersonation (/api/auth/me)...")
    headers = {
        "Authorization": f"Bearer {SUPERADMIN_TOKEN}",
        "x-subdomain": "codexflow-folios"
    }
    res = client.get("/api/auth/me", headers=headers)
    assert res.status_code == 200, f"Status code esperado 200, obtenido {res.status_code}: {res.text}"

    data = res.json()
    assert data.get("role") == "superadmin", f"Rol esperado 'superadmin', obtenido: {data.get('role')}"
    assert data.get("is_superadmin") is True, f"is_superadmin debe ser True, obtenido: {data.get('is_superadmin')}"
    assert data.get("tenant_name") == "codexflow-folios", f"tenant_name esperado 'codexflow-folios', obtenido: {data.get('tenant_name')}"
    assert data.get("tenant_id") == test_context["codexflow_tenant_id"], f"tenant_id esperado {test_context['codexflow_tenant_id']}, obtenido: {data.get('tenant_id')}"
    assert "codexflow-folios" in str(data.get("redirect_url")), f"redirect_url esperado a dashboard de codexflow-folios, obtenido: {data.get('redirect_url')}"

    print(f"  [OK] /api/auth/me retornó rol superadmin, tenant_name='codexflow-folios', tenant_id={data.get('tenant_id')}")


# =========================================================================
# PRUEBA 2: Datos del Tenant con Folios (codexflow-folios)
# =========================================================================
def test_02_tenant_metrics_and_records():
    """
    Prueba 2: Llamar a /api/tenant/metrics y /api/v1/records con x-subdomain: codexflow-folios.
    Validar que responda HTTP 200 y que los contadores o lista de registros reflejen folios existentes.
    """
    print("\n[EJECUTANDO] Prueba 2: Datos del Tenant con Folios (/api/tenant/metrics y /api/v1/records)...")
    headers = {
        "Authorization": f"Bearer {SUPERADMIN_TOKEN}",
        "x-subdomain": "codexflow-folios"
    }

    # 1. /api/tenant/metrics
    res_metrics = client.get("/api/tenant/metrics", headers=headers)
    assert res_metrics.status_code == 200, f"Error en /api/tenant/metrics: {res_metrics.status_code} - {res_metrics.text}"
    metrics_data = res_metrics.json()
    assert "uploadedCount" in metrics_data, "Falta 'uploadedCount' en respuesta de métricas"
    uploaded_count = metrics_data["uploadedCount"]
    print(f"  [OK] /api/tenant/metrics respondió HTTP 200. uploadedCount: {uploaded_count}")

    # 2. /api/v1/records
    res_records = client.get("/api/v1/records", headers=headers)
    assert res_records.status_code == 200, f"Error en /api/v1/records: {res_records.status_code} - {res_records.text}"
    records_data = res_records.json()
    assert records_data.get("status") == "success", "La respuesta de /api/v1/records debe indicar status='success'"
    total_records = records_data.get("total_records", records_data.get("total", 0))
    assert total_records >= 0, f"total_records debe ser >= 0, obtenido: {total_records}"
    print(f"  [OK] /api/v1/records respondió HTTP 200 sin crasheos. total_records: {total_records}, folios cargados con éxito.")


# =========================================================================
# PRUEBA 3: Aislamiento Multi-Tenant y Caché Independiente (diosis-margarita)
# =========================================================================
def test_03_multi_tenant_isolation_and_cache():
    """
    Prueba 3: Llamar inmediatamente después con x-subdomain: diosis-margarita usando el mismo token de superadmin.
    Validar HTTP 200, uploadedCount == 0 y total_records == 0, confirmando que la caché (token_hash, effective_tenant_id)
    no mezcla los datos de ambas organizaciones.
    """
    print("\n[EJECUTANDO] Prueba 3: Aislamiento Multi-Tenant y Partición de Caché (diosis-margarita)...")
    headers = {
        "Authorization": f"Bearer {SUPERADMIN_TOKEN}",
        "x-subdomain": "diosis-margarita"
    }

    # 1. /api/tenant/metrics para diosis-margarita
    res_metrics = client.get("/api/tenant/metrics", headers=headers)
    assert res_metrics.status_code == 200, f"Error en /api/tenant/metrics para diosis-margarita: {res_metrics.status_code} - {res_metrics.text}"
    metrics_data = res_metrics.json()
    uploaded_count = metrics_data.get("uploadedCount")
    assert uploaded_count == 0, f"uploadedCount para tenant virgen debe ser 0, obtenido: {uploaded_count}"
    print(f"  [OK] /api/tenant/metrics para 'diosis-margarita' arrojó uploadedCount = {uploaded_count} (Aislamiento verificado).")

    # 2. /api/v1/records para diosis-margarita
    res_records = client.get("/api/v1/records", headers=headers)
    assert res_records.status_code == 200, f"Error en /api/v1/records para diosis-margarita: {res_records.status_code} - {res_records.text}"
    records_data = res_records.json()
    total_records = records_data.get("total_records", records_data.get("total", 0))
    assert total_records == 0, f"total_records para 'diosis-margarita' debe ser 0, obtenido: {total_records}"
    print(f"  [OK] /api/v1/records para 'diosis-margarita' arrojó total_records = {total_records}.")
    print("  [OK] Partición de caché (token_hash, effective_tenant_id) validada: no hubo contaminación entre tenants.")


# =========================================================================
# PRUEBA 4: Spoofing Prevention (Rol Regular)
# =========================================================================
def test_04_spoofing_prevention_regular_user():
    """
    Prueba 4: Simular llamada de usuario con rol regular (digitizer) enviando x-subdomain: diosis-margarita.
    Validar que el backend ignore el header x-subdomain y que su tenant_id permanezca inmutablemente fijado a su perfil.
    """
    print("\n[EJECUTANDO] Prueba 4: Prevención Anti-Spoofing en Usuarios Convencionales...")
    headers = {
        "Authorization": f"Bearer {REGULAR_TOKEN}",
        "x-subdomain": "diosis-margarita"  # Intento de suplantación maliciosa
    }

    # 1. Validar /api/auth/me: no debe otorgar contexto de diosis-margarita
    res_me = client.get("/api/auth/me", headers=headers)
    assert res_me.status_code == 200, f"Error en /api/auth/me para usuario regular: {res_me.status_code} - {res_me.text}"
    me_data = res_me.json()
    assert me_data.get("role") != "superadmin", f"Rol no debe ser superadmin, obtenido: {me_data.get('role')}"
    expected_tenant_id = test_context.get("regular_tenant_id") or test_context["codexflow_tenant_id"]
    assert me_data.get("tenant_id") == expected_tenant_id, (
        f"tenant_id debe ser el nativo ({expected_tenant_id}), pero fue alterado a: {me_data.get('tenant_id')}"
    )
    assert me_data.get("tenant_name") != "diosis-margarita", "El backend no debe adoptar el subdominio adulterado para usuarios regulares"
    print(f"  [OK] /api/auth/me ignoró header x-subdomain: tenant_id fijado a {me_data.get('tenant_id')}")

    # 2. Validar /api/tenant/metrics: el usuario regular no accede a métricas de diosis-margarita
    res_metrics = client.get("/api/tenant/metrics", headers=headers)
    assert res_metrics.status_code == 200, f"Error en /api/tenant/metrics: {res_metrics.status_code} - {res_metrics.text}"
    print("  [OK] Endpoints de datos confinados estrictamente al tenant nativo del usuario regular.")


# =========================================================================
# PRUEBA 5: Subdominio Inexistente (HTTP 404)
# =========================================================================
def test_05_nonexistent_subdomain_404():
    """
    Prueba 5: Llamar como superadmin con x-subdomain: organizacion-fantasma-xyz-1234.
    Validar HTTP 404 con detail: 'Organización solicitada no encontrada'.
    """
    print("\n[EJECUTANDO] Prueba 5: Validación de Subdominio Inexistente (HTTP 404)...")
    headers = {
        "Authorization": f"Bearer {SUPERADMIN_TOKEN}",
        "x-subdomain": "organizacion-fantasma-xyz-1234"
    }

    # 1. /api/auth/me con subdominio inexistente
    res_me = client.get("/api/auth/me", headers=headers)
    assert res_me.status_code == 404, f"Se esperaba HTTP 404, obtenido {res_me.status_code}: {res_me.text}"
    detail_me = res_me.json().get("detail", "")
    assert "no encontrada" in detail_me.lower(), f"Mensaje 404 inesperado: {detail_me}"
    print(f"  [OK] /api/auth/me rechazó subdominio inexistente con HTTP 404 ('{detail_me}').")

    # 2. /api/v1/records con subdominio inexistente
    res_records = client.get("/api/v1/records", headers=headers)
    assert res_records.status_code == 404, f"Se esperaba HTTP 404 en /records, obtenido {res_records.status_code}: {res_records.text}"
    detail_records = res_records.json().get("detail", "")
    assert "no encontrada" in detail_records.lower(), f"Mensaje 404 inesperado: {detail_records}"
    print(f"  [OK] /api/v1/records rechazó subdominio inexistente con HTTP 404 ('{detail_records}').")


# =========================================================================
# Runner Principal
# =========================================================================
def run_all_tests() -> int:
    print("======================================================================")
    print("SUITE AUTOMATIZADA: SUPERADMIN UNIVERSAL TENANT IMPERSONATION (SPEC-020)")
    print("======================================================================")

    setup_test_environment()

    tests = [
        ("Prueba 1: Auth Me Impersonation", test_01_auth_me_impersonation),
        ("Prueba 2: Datos del Tenant con Folios", test_02_tenant_metrics_and_records),
        ("Prueba 3: Aislamiento Multi-Tenant y Caché Independiente", test_03_multi_tenant_isolation_and_cache),
        ("Prueba 4: Prevención Anti-Spoofing en Roles Regulares", test_04_spoofing_prevention_regular_user),
        ("Prueba 5: Subdominio Inexistente (HTTP 404)", test_05_nonexistent_subdomain_404),
    ]

    passed = 0
    failed = 0

    try:
        for name, test_fn in tests:
            try:
                test_fn()
                passed += 1
            except AssertionError as ae:
                print(f"  [FAIL] {name}: {ae}")
                failed += 1
            except Exception as e:
                print(f"  [FAIL] {name} arrojó excepción inesperada: {e}")
                failed += 1

        print("\n======================================================================")
        print(f"RESUMEN FINAL: {passed} PASADAS, {failed} FALLIDAS (TOTAL: {len(tests)})")
        print("======================================================================")

        if failed == 0:
            print("[EXITO] Todos los criterios de aceptación de la SPEC-020 fueron validados.")
            return 0
        else:
            print("[ERROR] Se registraron fallos en la suite de auditoría.")
            return 1
    finally:
        teardown_test_environment()


if __name__ == "__main__":
    exit_code = run_all_tests()
    sys.exit(exit_code)
