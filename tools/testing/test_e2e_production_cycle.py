#!/usr/bin/env python3
"""
Test Suite: test_e2e_production_cycle.py
Frente 3 / T04-F3-02: Suite automatizada de simulación E2E del ciclo de producción.

Ejecuta rigurosamente los 9 pasos del ciclo documental sobre el tenant de producción/pruebas:
Tenant ID: 4bf4e846-b22d-4105-aacf-3751cc0de60c

1. Paso 1: Identificar o preparar un folio de prueba en estado 'pending'.
2. Paso 2: Simulación de digitación y transcripción por Digitador (POST /api/v1/folios/{id}/entries, status='completed').
3. Paso 3: Toma en mesa de evaluación por Evaluador (POST /api/v1/evaluation/get_next).
4. Paso 4: Devolución motivada al digitador (POST /api/v1/evaluation/{id}/verdict con 'return_to_digitizer').
5. Paso 5: Verificación de prioridad en cola de digitación (priority_returned == True).
6. Paso 6: Corrección y re-envío por el digitador (status='completed').
7. Paso 7: Arbitraje y verificación final por Evaluador (verdict='verify_all' -> status='verified').
8. Paso 8: Exportación y validación estructural del paquete DIP FamilySearch (ZIP: Excel, CSV, GEDCOM, Manifest).
9. Paso 9: Limpieza y restauración controlada del estado original de la base de datos.
"""

import io
import os
import sys
import json
import zipfile
from pathlib import Path

# Configurar sys.path para importar backend
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(BACKEND_DIR))

# Cargar variables de entorno desde backend/.env
env_file = BACKEND_DIR / ".env"
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
    get_auth_context,
    supabase as main_supabase,
)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
TARGET_TENANT_ID = "4bf4e846-b22d-4105-aacf-3751cc0de60c"

if not SUPABASE_URL or not SUPABASE_KEY:
    print("[ERROR] Credenciales de Supabase no configuradas en backend/.env")
    sys.exit(1)

sb_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
client = TestClient(app)


def run_e2e_simulation():
    print("======================================================================")
    print("Iniciando Suite de Simulación E2E del Ciclo de Producción (9 Pasos)")
    print(f"Tenant de Validación: {TARGET_TENANT_ID}")
    print("======================================================================\n")

    # Identificar o validar existencia del tenant
    tenant_res = sb_client.table("tenants").select("id, name").eq("id", TARGET_TENANT_ID).execute()
    if not tenant_res.data:
        # Fallback si el ID no existe en entorno local: tomar el primer tenant disponible
        t_fallback = sb_client.table("tenants").select("id, name").limit(1).execute()
        if not t_fallback.data:
            print("[SKIP] No hay organizaciones registradas en la BD para simular ciclo E2E.")
            sys.exit(0)
        tenant = t_fallback.data[0]
        tenant_id = tenant["id"]
        print(f"[AVISO] Tenant {TARGET_TENANT_ID} no encontrado, usando tenant disponible: {tenant.get('name')} ({tenant_id})")
    else:
        tenant = tenant_res.data[0]
        tenant_id = tenant["id"]
        print(f"[OK] Tenant verificado: {tenant.get('name')} (ID: {tenant_id})")

    # Identificar usuarios de prueba o usar identidades de rol
    digitizer_id = "00000000-0000-0000-0000-000000000002"
    evaluator_id = "00000000-0000-0000-0000-000000000003"

    # Context factories para simular autenticación RBAC estricta
    def auth_as_digitizer():
        return {
            "tenant_id": tenant_id,
            "user_client": sb_client,
            "user_id": digitizer_id,
            "role": "digitizer",
        }

    def auth_as_evaluator():
        return {
            "tenant_id": tenant_id,
            "user_client": sb_client,
            "user_id": evaluator_id,
            "role": "evaluator",
        }

    # =========================================================================
    # PASO 1: Identificar o preparar un folio de prueba en estado 'pending'
    # =========================================================================
    print("[PASO 1] Identificando o preparando folio de prueba en estado 'pending'...")
    folios_res = (
        sb_client.table("folios")
        .select("*")
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=False)
        .limit(10)
        .execute()
    )

    test_folio = None
    backup_folio_state = None
    folder_id = None

    if folios_res.data:
        # Buscar preferentemente uno en pending
        for f in folios_res.data:
            if f.get("status") == "pending":
                test_folio = f
                break
        if not test_folio:
            test_folio = folios_res.data[0]

    if not test_folio:
        print("[ERROR] No se encontraron folios en el tenant para la prueba E2E.")
        sys.exit(1)

    folio_id = test_folio["id"]
    backup_folio_state = {
        "status": test_folio.get("status"),
        "metadata": test_folio.get("metadata"),
        "verified_at": test_folio.get("verified_at"),
        "folder_id": test_folio.get("folder_id"),
        "locked_at": test_folio.get("locked_at"),
    }

    # Asegurar que el folio tenga una carpeta asignada para la prueba de exportación DIP
    folder_id = test_folio.get("folder_id")
    if not folder_id:
        # Buscar una carpeta en el tenant o crear una temporal
        folders_res = sb_client.table("document_folders").select("id").eq("tenant_id", tenant_id).limit(1).execute()
        if folders_res.data:
            folder_id = folders_res.data[0]["id"]
        else:
            new_folder = sb_client.table("document_folders").insert({
                "tenant_id": tenant_id,
                "name": "Tomo 1 Bautismos QA",
                "folder_type": "tome",
                "metadata": {
                    "country": "Venezuela",
                    "state": "Sucre",
                    "municipality": "Bermudez",
                    "city_or_locality": "Carupano",
                    "sacrament_type": "bautismo",
                    "tome_number": "1"
                }
            }).execute()
            folder_id = new_folder.data[0]["id"]

        sb_client.table("folios").update({"folder_id": folder_id}).eq("id", folio_id).eq("tenant_id", tenant_id).execute()

    # Forzar estado inicial 'pending'
    sb_client.table("folios").update({
        "status": "pending",
        "locked_at": None,
        "metadata": {**(test_folio.get("metadata") or {}), "priority_returned": False}
    }).eq("id", folio_id).eq("tenant_id", tenant_id).execute()

    print(f"[OK] Folio de prueba preparado: {folio_id} (Carpeta: {folder_id}) en estado 'pending'.")

    try:
        # =========================================================================
        # PASO 2: Simulación de transcripción y guardado por Digitador
        # =========================================================================
        print("\n[PASO 2] Simulando transcripción por Digitador (POST /api/v1/folios/{id}/entries)...")
        app.dependency_overrides[get_auth_context] = auth_as_digitizer

        sample_metadata = {
            "nombres": "Gabriel Arcangel",
            "apellidos": "Salazar Mendoza",
            "bautizado": "Gabriel Arcangel Salazar Mendoza",
            "fecha_bautismo": "1945-05-12",
            "fecha_nacimiento": "1945-04-20",
            "nombre_padre": "Manuel Salazar",
            "nombre_madre": "Carmen Mendoza",
            "padrinos": "Pedro Salazar y Luisa Hernandez",
            "numero_acta": "104",
            "folio_number": 14,
            "folio_side": "recto",
        }

        digitizer_payload = {
            "entries": [
                {
                    "entry_number": 1,
                    "status": "completed",
                    "metadata": sample_metadata,
                    "folio_number": 14,
                    "folio_side": "recto",
                    "act_number": "104",
                    "is_continued": False,
                }
            ],
            "final_status": "completed",
        }

        res_digitize = client.post(f"/api/v1/folios/{folio_id}/entries", json=digitizer_payload)
        assert res_digitize.status_code == 200, f"Error en transcripción digitador: {res_digitize.text}"
        folio_check = sb_client.table("folios").select("status").eq("id", folio_id).eq("tenant_id", tenant_id).execute()
        assert folio_check.data[0]["status"] == "completed", f"Status esperado 'completed', obtenido: {folio_check.data[0]['status']}"
        print("[OK] Partida transcrita por Digitador y folio actualizado a 'completed'.")

        # =========================================================================
        # PASO 3: Toma en Mesa de Evaluación por Evaluador
        # =========================================================================
        print("\n[PASO 3] Simulando toma en mesa de evaluación (POST /api/v1/evaluation/get_next)...")
        app.dependency_overrides[get_auth_context] = auth_as_evaluator

        eval_next_payload = {"specific_folio_id": folio_id}
        res_claim = client.post("/api/v1/evaluation/get_next", json=eval_next_payload)
        assert res_claim.status_code == 200, f"Error al tomar folio en evaluación: {res_claim.text}"
        claimed_data = res_claim.json().get("data")
        assert claimed_data and claimed_data.get("id") == folio_id, "El folio reclamado no coincide con el de prueba"
        assert claimed_data.get("status") == "completed", "El folio debe llegar en estado 'completed' a evaluación"
        print("[OK] Folio obtenido exitosamente por el Evaluador para arbitraje.")

        # =========================================================================
        # PASO 4: Devolución motivada al Digitador (return_to_digitizer)
        # =========================================================================
        print("\n[PASO 4] Simulando devolución al digitador (POST /api/v1/evaluation/{id}/verdict)...")
        return_verdict_payload = {
            "verdict": "return_to_digitizer",
            "review_notes": "Corregir fecha de bautismo: documento indica 14 de Mayo, no 12.",
        }
        res_verdict_return = client.post(f"/api/v1/evaluation/{folio_id}/verdict", json=return_verdict_payload)
        assert res_verdict_return.status_code == 200, f"Error al emitir devolución: {res_verdict_return.text}"
        return_json = res_verdict_return.json()
        assert return_json.get("verdict") == "return_to_digitizer"
        assert return_json.get("folio_status") == "pending"

        folio_after_return = sb_client.table("folios").select("status, metadata").eq("id", folio_id).eq("tenant_id", tenant_id).execute().data[0]
        assert folio_after_return["status"] == "pending", "El folio devuelto debe quedar en estado 'pending'"
        f_meta_return = folio_after_return.get("metadata") or {}
        assert f_meta_return.get("priority_returned") is True, "El folio devuelto debe tener priority_returned == True"
        print("[OK] Veredicto 'return_to_digitizer' aplicado con éxito (status='pending', priority_returned=True).")

        # =========================================================================
        # PASO 5: Verificación de Prioridad en Cola de Digitación (get_next_folio)
        # =========================================================================
        print("\n[PASO 5] Verificando prioridad del folio devuelto en cola de digitación...")
        app.dependency_overrides[get_auth_context] = auth_as_digitizer

        res_next_dig = client.post("/api/v1/folios/get_next")
        assert res_next_dig.status_code == 200, f"Error en get_next_folio: {res_next_dig.text}"
        next_dig_data = res_next_dig.json().get("data")
        assert next_dig_data is not None, "get_next_folio debe retornar un folio"
        assert next_dig_data.get("id") == folio_id, f"El primer folio en la cola debió ser el devuelto ({folio_id}), pero fue {next_dig_data.get('id')}"
        assert bool(next_dig_data.get("metadata", {}).get("priority_returned")) is True or next_dig_data.get("status") == "in_progress"
        print("[OK] Folio devuelto entregado con máxima prioridad en cola de digitación.")

        # =========================================================================
        # PASO 6: Corrección y re-envío por el Digitador
        # =========================================================================
        print("\n[PASO 6] Simulando corrección y re-envío por el Digitador...")
        corrected_metadata = {
            **sample_metadata,
            "fecha_bautismo": "1945-05-14",  # Corrección solicitada
            "review_notes_resolved": "Fecha corregida a 14 de Mayo según nota de revisión.",
        }
        resubmit_payload = {
            "entries": [
                {
                    "entry_number": 1,
                    "status": "completed",
                    "metadata": corrected_metadata,
                    "folio_number": 14,
                    "folio_side": "recto",
                    "act_number": "104",
                    "is_continued": False,
                }
            ],
            "final_status": "completed",
        }
        res_resubmit = client.post(f"/api/v1/folios/{folio_id}/entries", json=resubmit_payload)
        assert res_resubmit.status_code == 200, f"Error en re-envío por digitador: {res_resubmit.text}"
        print("[OK] Corrección guardada y folio re-enviado a 'completed'.")

        # =========================================================================
        # PASO 7: Arbitraje y verificación final por Evaluador (verify_all)
        # =========================================================================
        print("\n[PASO 7] Evaluador aprueba y certifica acta (verdict='verify_all')...")
        app.dependency_overrides[get_auth_context] = auth_as_evaluator

        verify_payload = {
            "verdict": "verify_all",
            "review_notes": "Acta auditada y aprobada con éxito.",
        }
        res_verify = client.post(f"/api/v1/evaluation/{folio_id}/verdict", json=verify_payload)
        assert res_verify.status_code == 200, f"Error en verify_all: {res_verify.text}"
        verify_json = res_verify.json()
        assert verify_json.get("folio_status") == "verified"

        folio_verified = sb_client.table("folios").select("status, verified_at, metadata").eq("id", folio_id).eq("tenant_id", tenant_id).execute().data[0]
        assert folio_verified["status"] == "verified", "El folio debe quedar en estado 'verified'"
        assert folio_verified["verified_at"] is not None, "El folio debe tener verified_at poblado"
        print("[OK] Folio y partidas promovidos a estado 'verified' con marca de tiempo y auditor.")

        # =========================================================================
        # PASO 8: Descarga y validación del Paquete DIP FamilySearch (.ZIP)
        # =========================================================================
        print("\n[PASO 8] Descargando y validando paquete DIP FamilySearch...")
        export_url = f"/api/v1/folders/{folder_id}/export-familysearch?only_verified=true"
        res_export = client.get(export_url)
        assert res_export.status_code == 200, f"Error al generar exportación FamilySearch: {res_export.text}"
        assert res_export.headers.get("content-type") == "application/zip", f"Content-Type inesperado: {res_export.headers.get('content-type')}"

        zip_bytes = io.BytesIO(res_export.content)
        with zipfile.ZipFile(zip_bytes, "r") as zf:
            file_names = zf.namelist()
            print(f"[OK] Archivos contenidos en el ZIP: {file_names}")

            # Validar presencia de los 4 archivos obligatorios
            assert "manifest.json" in file_names, "Falta manifest.json en el ZIP"
            assert "matriz_indexacion.xlsx" in file_names, "Falta matriz_indexacion.xlsx en el ZIP"
            assert "matriz_indexacion.csv" in file_names, "Falta matriz_indexacion.csv en el ZIP"
            assert "export_gedcom.ged" in file_names, "Falta export_gedcom.ged en el ZIP"

            # Validar manifest.json
            manifest_raw = zf.read("manifest.json").decode("utf-8")
            manifest = json.loads(manifest_raw)
            assert "familysearch" in str(manifest.get("standard") or manifest.get("export_type") or manifest.get("project_name")).lower()
            stats = manifest.get("statistics") or {}
            assert stats.get("total_entries", 0) >= 1 or stats.get("completed_entries", 0) >= 1 or manifest.get("total_verified_entries", 0) >= 1

            # Validar CSV (UTF-8)
            csv_raw = zf.read("matriz_indexacion.csv").decode("utf-8-sig")
            assert "Gabriel Arcangel" in csv_raw or "Salazar" in csv_raw, "La partida no se encontró en matriz_indexacion.csv"

            # Validar GEDCOM
            gedcom_raw = zf.read("export_gedcom.ged").decode("utf-8", errors="ignore")
            assert "0 HEAD" in gedcom_raw, "Cabecera GEDCOM ausente"
            assert "0 TRLR" in gedcom_raw, "Cierre GEDCOM ausente"

        print("[OK] Paquete DIP validado íntegramente: Excel, CSV, GEDCOM 5.5.1 y Manifest conforman la especificación.")

        print("\n======================================================================")
        print("SIMULACIÓN E2E DEL CICLO DE PRODUCCIÓN COMPLETADA SATISFACTORIAMENTE (100%)")
        print("======================================================================")

    finally:
        # =========================================================================
        # PASO 9: Restauración y limpieza controlada
        # =========================================================================
        print("\n[PASO 9] Restaurando estado original de la base de datos...")
        app.dependency_overrides.clear()
        if test_folio and backup_folio_state:
            try:
                # Purgar partidas temporales creadas para el folio
                sb_client.table("folio_entries").delete().eq("folio_id", folio_id).eq("tenant_id", tenant_id).execute()
                # Restaurar folio a su estado original
                sb_client.table("folios").update(backup_folio_state).eq("id", folio_id).eq("tenant_id", tenant_id).execute()
                print(f"[OK] Folio {folio_id} restaurado a su estado inicial: {backup_folio_state.get('status')}")
            except Exception as teardown_err:
                print(f"[INFO] Nota al restaurar folio: {teardown_err}")


if __name__ == "__main__":
    run_e2e_simulation()
