#!/usr/bin/env python3
"""
Seed Demo Data Script for CodexFlow.
Isolated CLI script to seed realistic 19th-century sacramental archival demonstration data.
This script is completely decoupled from frontend and production build artifacts.

Usage:
    python tools/seeding/seed_demo_data.py --target_email belkisagreda1@gmail.com
    python tools/seeding/seed_demo_data.py --tenant_subdomain carupano --clean
"""

import os
import sys
import uuid
import argparse
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

try:
    from supabase import create_client, Client
except ImportError:
    print("Error: la librería 'supabase' no está instalada. Ejecute 'pip install supabase'.")
    sys.exit(1)


# Configuración de variables de entorno con fallback
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "http://localhost:8000"
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY") or ""

DEMO_TOME_NAME = "Libro 1 de Bautismos (1885-1890) - Demostración Oficial"


REALISTIC_HISTORICAL_ENTRIES = [
    {
        "folio_number": 1,
        "folio_side": "recto",
        "act_number": "1",
        "status": "completed",
        "metadata": {
            "first_name": "José Francisco",
            "last_name": "Alcalá Bermúdez",
            "sex": "M",
            "event_date": "1885-01-14",
            "birth_date": "1884-12-28",
            "father_name": "Manuel Vicente Alcalá",
            "mother_name": "María del Rosario Bermúdez de Alcalá",
            "paternal_grandfather": "Francisco de Paula Alcalá",
            "paternal_grandmother": "Juana Antonia Rivas",
            "maternal_grandfather": "Diego Bermúdez",
            "maternal_grandmother": "Eusebia Sucre",
            "godparents": "Don Juan Bautista Bermúdez y Doña Josefa Antonia Sucre",
            "minister": "Pbro. Dr. Juan de Dios Morales",
            "marginal_notes": "Legítimo. Confirmado en la Santa Iglesia Parroquial de Santa Rosa de Lima."
        }
    },
    {
        "folio_number": 1,
        "folio_side": "vuelto",
        "act_number": "2",
        "status": "completed",
        "metadata": {
            "first_name": "María del Carmen",
            "last_name": "Montes Rivera",
            "sex": "F",
            "event_date": "1885-02-03",
            "birth_date": "1885-01-20",
            "father_name": "Pedro Celestino Montes",
            "mother_name": "Carmen Rivera de Montes",
            "paternal_grandfather": "Antonio Montes",
            "paternal_grandmother": "Francisca Silva",
            "maternal_grandfather": "Luis Rivera",
            "maternal_grandmother": "María de la Trinidad Ramos",
            "godparents": "Carlos Rivera y Carmen Antonia Montes",
            "minister": "Pbro. Dr. Juan de Dios Morales",
            "marginal_notes": "Legítima. Matrimonio canónico anotado al folio 45 del Libro 2 de Matrimonios."
        }
    },
    {
        "folio_number": 2,
        "folio_side": "recto",
        "act_number": "3",
        "status": "completed",
        "metadata": {
            "first_name": "Antonio María",
            "last_name": "Salazar Rojas",
            "sex": "M",
            "event_date": "1885-03-19",
            "birth_date": "1885-03-01",
            "father_name": "Félix Ramón Salazar",
            "mother_name": "Inés María Rojas de Salazar",
            "paternal_grandfather": "José María Salazar",
            "paternal_grandmother": "Ana Rosa Navarro",
            "maternal_grandfather": "Domingo Rojas",
            "maternal_grandmother": "Clara Antonia Moya",
            "godparents": "Dr. Félix Antonio Salazar y Rosa Rojas",
            "minister": "Pbro. Dr. Juan de Dios Morales",
            "marginal_notes": "Legítimo. Óleo y crisma según el ritual romano."
        }
    },
    {
        "folio_number": 2,
        "folio_side": "vuelto",
        "act_number": "4",
        "status": "completed",
        "metadata": {
            "first_name": "Francisca Antonia",
            "last_name": "Gómez Serrano",
            "sex": "F",
            "event_date": "1885-04-11",
            "birth_date": "1885-03-29",
            "father_name": "Agustín Gómez",
            "mother_name": "Teresa Serrano de Gómez",
            "paternal_grandfather": "Juan de los Reyes Gómez",
            "paternal_grandmother": "Vicenta López",
            "maternal_grandfather": "Sebastián Serrano",
            "maternal_grandmother": "Margarita Patiño",
            "godparents": "Sebastián Serrano y Josefa Gómez",
            "minister": "Pbro. Dr. Juan de Dios Morales",
            "marginal_notes": "Legítima. Partida transcrita con solemnidad de estola."
        }
    },
    {
        "folio_number": 3,
        "folio_side": "recto",
        "act_number": "5",
        "status": "completed",
        "metadata": {
            "first_name": "Pedro Celestino",
            "last_name": "Caraballo Ramos",
            "sex": "M",
            "event_date": "1885-05-18",
            "birth_date": "1885-05-02",
            "father_name": "Lucas Caraballo",
            "mother_name": "Herminia Ramos",
            "paternal_grandfather": "Pedro Caraballo",
            "paternal_grandmother": "Catalina Velásquez",
            "maternal_grandfather": "José Ramos",
            "maternal_grandmother": "Leandra Vallenilla",
            "godparents": "Santiago Ramos y Catalina Velásquez",
            "minister": "Pbro. Dr. Juan de Dios Morales",
            "marginal_notes": "Legítimo. Bautizado según el ritual tridentino."
        }
    }
]

PENDING_FOLIOS_DATA = [
    {"folio_number": 3, "folio_side": "vuelto", "act_number": "6"},
    {"folio_number": 4, "folio_side": "recto", "act_number": "7"},
    {"folio_number": 4, "folio_side": "vuelto", "act_number": "8"},
    {"folio_number": 5, "folio_side": "recto", "act_number": "9"},
    {"folio_number": 5, "folio_side": "vuelto", "act_number": "10"},
]


def resolve_tenant(client: Client, target_email: Optional[str], subdomain: Optional[str]) -> Dict[str, Any]:
    """Localiza el tenant basado en email del usuario o subdominio."""
    if target_email:
        print(f"[*] Buscando organización para el usuario: {target_email}...")
        try:
            # Buscar en auth.users o user_profiles
            prof = client.table("user_profiles").select("tenant_id, role").execute()
            # Si hay perfiles, intentar relacionar
        except Exception as e:
            print(f"    Notice consultando user_profiles: {e}")

        try:
            users_res = client.auth.admin.list_users()
            for u in (users_res or []):
                if u.email and u.email.strip().lower() == target_email.strip().lower():
                    # Obtener perfil
                    p_res = client.table("user_profiles").select("tenant_id").eq("user_id", u.id).execute()
                    if p_res.data and p_res.data[0].get("tenant_id"):
                        t_id = p_res.data[0]["tenant_id"]
                        t_res = client.table("tenants").select("*").eq("id", t_id).execute()
                        if t_res.data:
                            print(f"[+] Tenant localizado por email ({u.email}): {t_res.data[0].get('name')} (ID: {t_id})")
                            return t_res.data[0]
        except Exception as auth_err:
            print(f"    Info: Búsqueda admin auth: {auth_err}")

    if subdomain:
        print(f"[*] Buscando organización con subdominio: {subdomain}...")
        t_res = client.table("tenants").select("*").or_(f"subdomain.eq.{subdomain},name.ilike.%{subdomain}%").execute()
        if t_res.data:
            print(f"[+] Tenant localizado por subdominio: {t_res.data[0].get('name')} (ID: {t_res.data[0].get('id')})")
            return t_res.data[0]

    # Fallback: tomar el primer tenant disponible
    all_tenants = client.table("tenants").select("*").limit(1).execute()
    if all_tenants.data:
        t = all_tenants.data[0]
        print(f"[!] Usando primer tenant disponible en el sistema: {t.get('name')} (ID: {t.get('id')})")
        return t

    raise RuntimeError("No se encontró ninguna organización (tenant) registrada en el sistema.")


def clean_demo_data(client: Client, tenant_id: str):
    """Purga de forma segura los datos previos de demostración sin tocar otros registros."""
    print(f"[*] Limpiando datos de demostración anteriores para tenant {tenant_id}...")
    try:
        # 1. Localizar el tomo de demostración
        tome_res = client.table("document_folders").select("id").eq("tenant_id", tenant_id).eq("name", DEMO_TOME_NAME).execute()
        if not tome_res.data:
            print("    No se encontraron datos de demostración anteriores.")
            return

        demo_folder_id = tome_res.data[0]["id"]

        # 2. Localizar folios asociados
        folios_res = client.table("folios").select("id").eq("folder_id", demo_folder_id).execute()
        folio_ids = [f["id"] for f in (folios_res.data or [])]

        if folio_ids:
            # 3. Eliminar folio_entries
            client.table("folio_entries").delete().in_("folio_id", folio_ids).execute()
            print(f"    Eliminadas partidas de folios de demostración.")

            # 4. Eliminar folios
            client.table("folios").delete().eq("folder_id", demo_folder_id).execute()
            print(f"    Eliminados {len(folio_ids)} folios de demostración.")

        # 5. Eliminar tomo
        client.table("document_folders").delete().eq("id", demo_folder_id).execute()
        print(f"    Eliminado tomo '{DEMO_TOME_NAME}'.")
        print("[+] Limpieza de datos de demostración finalizada con éxito.")
    except Exception as e:
        print(f"[!] Error durante la limpieza: {e}")


def seed_demo_data(client: Client, tenant: Dict[str, Any]):
    """Inserta el tomo, los 10 folios físicos (5 con partidas completed y 5 pending)."""
    tenant_id = tenant["id"]
    tenant_subdomain = tenant.get("subdomain") or "carupano"
    now_iso = datetime.now(timezone.utc).isoformat()

    print(f"\n[*] Iniciando creación de datos de demostración en '{tenant.get('name')}'...")

    # 1. Crear el Tomo Formal
    folder_data = {
        "tenant_id": tenant_id,
        "name": DEMO_TOME_NAME,
        "folder_type": "tome",
        "status": "in_progress",
        "metadata": {
            "tome_number": "01",
            "year_start": 1885,
            "year_end": 1890,
            "parish_name": "Parroquia Santa Rosa de Lima",
            "diocese_name": "Diócesis de Carúpano",
            "country": "Venezuela",
            "state": "Sucre",
            "municipality": "Bermúdez",
            "city_or_locality": "Carúpano",
            "canonical_place": "Carúpano, Bermúdez, Sucre, Venezuela",
            "sacrament_type": "bautismo",
            "is_demo": True
        },
        "created_at": now_iso,
        "updated_at": now_iso
    }

    tome_res = client.table("document_folders").insert(folder_data).execute()
    if not tome_res.data:
        raise RuntimeError("Fallo al insertar document_folder para el tomo de demostración.")
    folder = tome_res.data[0]
    folder_id = folder["id"]
    print(f"[+] Tomo creado exitosamente: '{DEMO_TOME_NAME}' (ID: {folder_id})")

    # 2. Generar los 10 folios físicos correlativos (F001r a F005v)
    # 5 completados y 5 pendientes
    folio_plan = []
    # 5 completados
    for ent in REALISTIC_HISTORICAL_ENTRIES:
        folio_plan.append({
            "folio_number": ent["folio_number"],
            "folio_side": ent["folio_side"],
            "status": "completed",
            "entry_data": ent
        })
    # 5 pendientes
    for p_fol in PENDING_FOLIOS_DATA:
        folio_plan.append({
            "folio_number": p_fol["folio_number"],
            "folio_side": p_fol["folio_side"],
            "status": "pending",
            "entry_data": {
                "folio_number": p_fol["folio_number"],
                "folio_side": p_fol["folio_side"],
                "act_number": p_fol["act_number"],
                "status": "pending",
                "metadata": {}
            }
        })

    inserted_folios = 0
    inserted_entries = 0

    for seq_order, item in enumerate(folio_plan, start=1):
        f_num = item["folio_number"]
        f_side = item["folio_side"]
        status = item["status"]
        side_code = "R" if f_side == "recto" else "V"
        canonical_filename = f"{tenant_subdomain.upper()}_BAU_T01_F{f_num:03d}{side_code}.jpg"

        folio_payload = {
            "tenant_id": tenant_id,
            "folder_id": folder_id,
            "sequence_order": seq_order,
            "original_filename": f"scan_{seq_order:03d}.jpg",
            "canonical_filename": canonical_filename,
            "status": status,
            "r2_url": f"https://mock-storage.codexflow.io/{tenant_subdomain}/tome1/{canonical_filename}",
            "created_at": now_iso,
            "updated_at": now_iso
        }
        if status == "completed":
            folio_payload["verified_at"] = now_iso

        f_res = client.table("folios").insert(folio_payload).execute()
        if not f_res.data:
            print(f"[!] Error insertando folio {seq_order}")
            continue
        folio_row = f_res.data[0]
        folio_id = folio_row["id"]
        inserted_folios += 1

        # Crear entrada en folio_entries
        e_spec = item["entry_data"]
        entry_payload = {
            "tenant_id": tenant_id,
            "folio_id": folio_id,
            "entry_number": 1,
            "folio_number": f_num,
            "folio_side": f_side,
            "act_number": e_spec.get("act_number", str(seq_order)),
            "status": status,
            "is_continued": False,
            "continued_from_entry_id": None,
            "metadata": e_spec.get("metadata", {}),
            "created_at": now_iso,
            "updated_at": now_iso
        }

        e_res = client.table("folio_entries").insert(entry_payload).execute()
        if e_res.data:
            inserted_entries += 1

    print(f"\n[✓] Generación completada exitosamente:")
    print(f"    - Tomo: {DEMO_TOME_NAME}")
    print(f"    - Folios físicos generados: {inserted_folios} (F001r a F005v)")
    print(f"    - Partidas completadas: 5 (con genealogía canónica completa y datos de época)")
    print(f"    - Partidas pendientes: 5 (disponibles para demostración de indexación en vivo)")
    print(f"    - Aislamiento de exportador: El exportador DIP excluirá automáticamente los 5 folios pendientes.")


def main():
    parser = argparse.ArgumentParser(description="Script de datos de demostración CodexFlow")
    parser.add_argument("--tenant_subdomain", type=str, default=None, help="Subdominio del tenant (ej. 'carupano')")
    parser.add_argument("--target_email", type=str, default="belkisagreda1@gmail.com", help="Email del usuario destino")
    parser.add_argument("--clean", action="store_true", help="Elimina los datos de demostración anteriores antes de crearlos")
    args = parser.parse_args()

    if not SUPABASE_KEY:
        print("[!] Advertencia: SUPABASE_SERVICE_ROLE_KEY no está configurada en el entorno.")
        print("    Para ejecutar contra una base de datos real, configure SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.")
        sys.exit(0)

    try:
        client = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"[!] Error inicializando cliente Supabase: {e}")
        sys.exit(1)

    tenant = resolve_tenant(client, args.target_email, args.tenant_subdomain)

    if args.clean:
        clean_demo_data(client, tenant["id"])

    seed_demo_data(client, tenant)


if __name__ == "__main__":
    main()
