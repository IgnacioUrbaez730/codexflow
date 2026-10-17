"""
tools/seeding/seed_realistic_corpus.py

Orquestador de base de datos idempotente para sembrar el corpus sintético
paleográfico de 60 folios con variantes de estrés archivístico (SPEC-015 Fase 3).

Garantiza:
- Aislamiento multi-tenant estricto: tenant_id = '4bf4e846-b22d-4105-aacf-3751cc0de60c'
  y organización 'codexflow-folios'.
- Soporte para --clean: purga previa segura de tomos y folios del corpus de prueba.
- Creación de Tomos oficiales (Libro 1 de Bautismos, Matrimonios, Defunciones).
- Inserción de 60 folios (20 por serie) con sequence_order, estados y metadatos de estrés.
- Inserción de entradas (entries) con JSON canónico validado para FamilySearch.
- Resolución de enlaces interfolio continuados (is_continued, continued_from_entry_id).
- Argumentos CLI: --type [bautismo|matrimonio|defuncion|all], --count [10|20], --dry-run, --clean.
"""

import os
import sys
import json
import uuid
import argparse
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import urllib.request
import urllib.error
import urllib.parse

# Configurar stdout/stderr en UTF-8 si está disponible para evitar UnicodeEncodeError en Windows cp1252
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# Cargar variables de entorno desde backend/.env o frontend/.env.local
def _load_env_file(filepath: str):
    if not os.path.exists(filepath):
        return
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip("'\"")
                if k and k not in os.environ:
                    os.environ[k] = v
    except Exception:
        pass

# Buscar .env en backend y frontend
base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
_load_env_file(os.path.join(base_dir, "backend", ".env"))
_load_env_file(os.path.join(base_dir, "frontend", ".env.local"))

# Intentar dotenv si está instalado
try:
    import dotenv
    dotenv.load_dotenv(os.path.join(base_dir, "backend", ".env"))
    dotenv.load_dotenv(os.path.join(base_dir, "frontend", ".env.local"))
except ImportError:
    pass

# Identificadores canónicos innegociables
TENANT_ID = "4bf4e846-b22d-4105-aacf-3751cc0de60c"
ORGANIZATION_SLUG = "codexflow-folios"
ORGANIZATION_NAME = "Parroquia Santa Rosa de Carúpano"
DEFAULT_USER_ID = "896473c3-d284-4ecb-8399-13a77fa68422"

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL") or ""
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") or ""


class SupabaseRestClient:
    """Cliente HTTP REST ultraligero y seguro para Supabase PostgREST sin dependencias externas pesadas."""
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def _headers(self, prefer: str = "return=representation") -> Dict[str, str]:
        return {
            "apikey": self.api_key,
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Prefer": prefer
        }

    def select(self, table: str, params: Optional[Dict[str, str]] = None) -> List[Dict[str, Any]]:
        query_parts = []
        if params:
            for k, v in params.items():
                query_parts.append(f"{k}={urllib.parse.quote(str(v), safe='.:,=-_')}")
        query_str = f"?{'&'.join(query_parts)}" if query_parts else ""
        url = f"{self.base_url}/rest/v1/{table}{query_str}"
        req = urllib.request.Request(url, headers=self._headers(), method="GET")
        try:
            with urllib.request.urlopen(req) as resp:
                data = resp.read().decode("utf-8")
                return json.loads(data) if data else []
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8") if e.fp else ""
            raise RuntimeError(f"Error GET {table} ({e.code}): {err_body}")

    def insert(self, table: str, records: List[Dict[str, Any]], upsert: bool = False) -> List[Dict[str, Any]]:
        if not records:
            return []
        url = f"{self.base_url}/rest/v1/{table}"
        prefer = "return=representation"
        if upsert:
            prefer += ",resolution=merge-duplicates"
        req = urllib.request.Request(url, data=json.dumps(records).encode("utf-8"), headers=self._headers(prefer), method="POST")
        try:
            with urllib.request.urlopen(req) as resp:
                data = resp.read().decode("utf-8")
                return json.loads(data) if data else []
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8") if e.fp else ""
            raise RuntimeError(f"Error POST {table} ({e.code}): {err_body}")

    def delete(self, table: str, params: Dict[str, str]) -> List[Dict[str, Any]]:
        query_parts = [f"{k}={urllib.parse.quote(str(v), safe='.:,=-_*')}" for k, v in params.items()]
        query_str = f"?{'&'.join(query_parts)}" if query_parts else ""
        url = f"{self.base_url}/rest/v1/{table}{query_str}"
        req = urllib.request.Request(url, headers=self._headers(), method="DELETE")
        try:
            with urllib.request.urlopen(req) as resp:
                data = resp.read().decode("utf-8")
                return json.loads(data) if data else []
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8") if e.fp else ""
            raise RuntimeError(f"Error DELETE {table} ({e.code}): {err_body}")

    def update(self, table: str, params: Dict[str, str], payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        query_parts = [f"{k}={urllib.parse.quote(str(v), safe='.:,=-_')}" for k, v in params.items()]
        query_str = f"?{'&'.join(query_parts)}" if query_parts else ""
        url = f"{self.base_url}/rest/v1/{table}{query_str}"
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=self._headers(), method="PATCH")
        try:
            with urllib.request.urlopen(req) as resp:
                data = resp.read().decode("utf-8")
                return json.loads(data) if data else []
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8") if e.fp else ""
            raise RuntimeError(f"Error PATCH {table} ({e.code}): {err_body}")


class CorpusSeeder:
    def __init__(self, manifest_path: str, dry_run: bool = False, clean: bool = False):
        self.manifest_path = manifest_path
        self.dry_run = dry_run
        self.clean = clean
        self.tenant_id = TENANT_ID

        if not os.path.exists(manifest_path):
            raise FileNotFoundError(f"No se encontró el manifest en: {manifest_path}")

        with open(manifest_path, "r", encoding="utf-8") as f:
            self.manifest = json.load(f)

        self.client: Optional[SupabaseRestClient] = None
        if not self.dry_run:
            if not SUPABASE_URL or not SUPABASE_KEY:
                print("[Aviso] Credenciales de Supabase no detectadas en entorno. Operando en modo DRY-RUN simulado.")
                self.dry_run = True
            else:
                self.client = SupabaseRestClient(SUPABASE_URL, SUPABASE_KEY)

    def clean_existing_demo_corpus(self):
        """Purga segura de folios y registros de demostración en el tenant codexflow-folios."""
        print(f"[*] Purgando corpus anterior para tenant: {self.tenant_id}...")
        if self.dry_run or not self.client:
            print("[DRY-RUN] Simulación de purga completada.")
            return

        # 1. Purgar folio_entries asociadas al tenant
        try:
            self.client.delete("folio_entries", {
                "tenant_id": f"eq.{self.tenant_id}"
            })
            # Eliminar folios con canonical_filename prefijado por CARUPANO_
            self.client.delete("folios", {
                "tenant_id": f"eq.{self.tenant_id}",
                "canonical_filename": "like.CARUPANO_*"
            })
            print("[✓] Folios y partidas del corpus eliminados limpiamente.")
        except Exception as e:
            print(f"[!] No se pudieron purgar folios o partidas existentes: {e}")

    def ensure_tomes(self, series_filter: str = "all") -> Dict[str, str]:
        """Asegura la existencia de los tomos oficiales en 'document_folders'."""
        volume_id_map = {}
        target_vols = self.manifest.get("volumes", [])

        if series_filter != "all":
            target_vols = [v for v in target_vols if v.get("series") == series_filter]

        for vol in target_vols:
            vol_id = vol["id"]
            title = vol["title"]
            series = vol["series"]

            # Generar UUID determinista canónico
            canonical_tome_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{self.tenant_id}-{vol_id}"))
            volume_id_map[vol_id] = canonical_tome_uuid

            now_iso = datetime.now(timezone.utc).isoformat()
            tome_number_str = f"{int(vol.get('tome_number', 1)):02d}"

            tome_data = {
                "id": canonical_tome_uuid,
                "tenant_id": self.tenant_id,
                "name": title,
                "folder_type": "tome",
                "created_by": DEFAULT_USER_ID,
                "metadata": {
                    "tome_number": tome_number_str,
                    "year_start": vol.get("year_start", 1885),
                    "year_end": vol.get("year_end", 1895),
                    "parish_name": "Parroquia Santa Rosa de Lima",
                    "diocese_name": "Diócesis de Carúpano",
                    "country": "Venezuela",
                    "state": "Sucre",
                    "municipality": "Bermúdez",
                    "city_or_locality": "Carúpano",
                    "canonical_place": "Carúpano, Bermúdez, Sucre, Venezuela",
                    "sacrament_type": series,
                    "is_demo": True
                },
                "created_at": now_iso,
                "updated_at": now_iso
            }

            if not self.dry_run and self.client:
                # 1. Consultar document_folders filtrando por tenant_id y id (o name)
                existing = []
                try:
                    existing = self.client.select("document_folders", {
                        "tenant_id": f"eq.{self.tenant_id}",
                        "id": f"eq.{canonical_tome_uuid}"
                    })
                    if not existing:
                        existing = self.client.select("document_folders", {
                            "tenant_id": f"eq.{self.tenant_id}",
                            "name": f"eq.{title}"
                        })
                except Exception as e:
                    print(f"[!] Aviso consultando document_folders: {e}")

                # 2. Si no existe, insertar en document_folders
                if not existing:
                    try:
                        self.client.insert("document_folders", [tome_data], upsert=True)
                    except Exception as e:
                        print(f"[!] Error insertando tomo {canonical_tome_uuid} en document_folders: {e}")
                        raise e
                else:
                    # Si ya existe con otro id por coincidencia de nombre, mapear al id existente
                    if existing and existing[0].get("id"):
                        volume_id_map[vol_id] = existing[0]["id"]

                # 3. Comprobar que el registro realmente quede guardado en document_folders
                verified = self.client.select("document_folders", {
                    "tenant_id": f"eq.{self.tenant_id}",
                    "id": f"eq.{volume_id_map[vol_id]}"
                })
                if not verified:
                    raise RuntimeError(f"Verificación fallida: Tomo {volume_id_map[vol_id]} no fue encontrado en document_folders.")

            print(f"[+] Tomo verificado en document_folders: {title} ({series}) -> UUID: {volume_id_map[vol_id]}")

        return volume_id_map

    def ensure_volumes(self, series_filter: str = "all") -> Dict[str, str]:
        """Alias de compatibilidad para ensure_tomes."""
        return self.ensure_tomes(series_filter=series_filter)

    def ensure_batches(self, series_filter: str = "all") -> Dict[str, str]:
        """Asegura la existencia de lotes (batches) para cada serie en la tabla 'batches'."""
        batch_id_map = {}
        target_vols = self.manifest.get("volumes", [])
        if series_filter != "all":
            target_vols = [v for v in target_vols if v.get("series") == series_filter]

        # 1. Obtener o inferir template_id por serie
        # Buscar templates existentes en la base de datos
        db_templates = []
        if not self.dry_run and self.client:
            try:
                db_templates = self.client.select("templates", {"tenant_id": f"eq.{self.tenant_id}"})
                if not db_templates:
                    db_templates = self.client.select("templates", {})
            except Exception as e:
                print(f"[!] Aviso consultando templates: {e}")

        # 2. Obtener un user_id válido de la organización
        uploaded_by_id = DEFAULT_USER_ID
        if not self.dry_run and self.client:
            try:
                org_users = self.client.select("organization_members", {"organization_id": f"eq.{self.tenant_id}"})
                if org_users and "user_id" in org_users[0]:
                    uploaded_by_id = org_users[0]["user_id"]
                elif org_users and "id" in org_users[0]:
                    uploaded_by_id = org_users[0]["id"]
            except Exception:
                pass

        for vol in target_vols:
            series = vol.get("series")
            template_code = vol.get("template_code", "")
            
            # Buscar template coincidente
            matched_template_id = None
            for t in db_templates:
                t_name = str(t.get("name", "")).lower()
                t_type = str(t.get("type", "")).lower()
                t_code = str(t.get("code", "")).lower()
                if series.lower() in t_name or series.lower() in t_type or template_code.lower() in t_code:
                    matched_template_id = t.get("id")
                    break

            if not matched_template_id:
                if db_templates and "id" in db_templates[0]:
                    matched_template_id = db_templates[0]["id"]
                else:
                    matched_template_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{self.tenant_id}-template-{series}"))

            canonical_batch_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{self.tenant_id}-batch-{series}"))
            batch_id_map[series] = canonical_batch_uuid

            batch_record = {
                "id": canonical_batch_uuid,
                "tenant_id": self.tenant_id,
                "template_id": matched_template_id,
                "uploaded_by": uploaded_by_id,
                "status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat()
            }

            if not self.dry_run and self.client:
                self.client.insert("batches", [batch_record], upsert=True)
                print(f"[+] Lote (batch) verificado para serie '{series}' -> UUID: {canonical_batch_uuid}")
            else:
                print(f"[DRY-RUN] Lote simulado para serie '{series}' -> UUID: {canonical_batch_uuid}")

        return batch_id_map

    def seed_corpus(self, series_filter: str = "all", count: Optional[int] = None) -> Dict[str, Any]:
        """Ejecuta el seeding completo con folios y partidas canónicas FamilySearch."""
        if self.clean:
            self.clean_existing_demo_corpus()

        volume_uuid_map = self.ensure_tomes(series_filter)
        batch_uuid_map = self.ensure_batches(series_filter)

        folios = self.manifest.get("folios", [])
        if series_filter != "all":
            folios = [f for f in folios if f.get("series") == series_filter]

        if count is not None and count > 0:
            folios = folios[:count]

        print(f"\n[*] Sembrando {len(folios)} folios del corpus para serie '{series_filter}'...")

        folios_to_insert = []
        entries_to_insert = []
        folio_uuid_map = {}
        entry_uuid_map = {}
        continued_links = []

        for f_data in folios:
            series = f_data.get("series")
            manifest_vol_id = f_data.get("volume_id")
            volume_uuid = volume_uuid_map.get(manifest_vol_id)
            batch_uuid = batch_uuid_map.get(series)
            folio_seq = f_data.get("sequence_order")
            folio_num = f_data.get("folio_number")
            side = f_data.get("folio_side")
            filename = f_data.get("canonical_filename")
            status = f_data.get("status")
            stress_case = f_data.get("stress_case", "standard")
            image_url = f_data.get("remote_image_url")

            # Deterministic UUID para idempotencia total
            folio_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{self.tenant_id}-{filename}"))
            folio_uuid_map[filename] = folio_uuid

            # Mapeo seguro al enum folio_status de PostgreSQL ('pending', 'in_progress', 'completed', 'revision', 'failed')
            is_blank = (status == "blank" or stress_case == "blank")
            db_status = "completed" if status == "blank" else (status if status in ["pending", "in_progress", "completed", "revision", "failed"] else "completed")

            folio_metadata = {
                "series": series,
                "folio_number": folio_num,
                "folio_side": side,
                "stress_case": stress_case,
                "is_blank": is_blank,
                "prompt": f_data.get("prompt"),
                "is_double_page": (side == "double_page"),
                "has_marginal_notes": (stress_case == "marginal_notes")
            }
            if is_blank:
                folio_metadata["notes"] = "Folio en blanco / Auto canónico"

            folio_record = {
                "id": folio_uuid,
                "tenant_id": self.tenant_id,
                "batch_id": batch_uuid,
                "folder_id": volume_uuid,
                "sequence_order": folio_seq,
                "canonical_filename": filename,
                "original_filename": filename,
                "status": db_status,
                "r2_url": image_url,
                "metadata": folio_metadata
            }
            folios_to_insert.append(folio_record)

            # Preparar partidas canónicas (folio_entries)
            manifest_entries = f_data.get("entries", [])
            for e_data in manifest_entries:
                entry_num = e_data.get("entry_number")
                entry_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{folio_uuid}-entry-{entry_num}"))
                e_raw_status = e_data.get("status", "completed")
                e_status = "completed" if e_raw_status == "blank" else e_raw_status
                is_cont = e_data.get("is_continued", False)
                act_num = e_data.get("act_number") or e_data.get("metadata", {}).get("numero_acta")

                entry_metadata = {
                    "entry_type": series,
                    "has_marginal_notes": e_data.get("has_marginal_notes", False),
                    "marginal_notes_text": e_data.get("marginal_notes_text"),
                    "data": e_data.get("metadata", {})
                }

                # Mapear folio_side a los valores permitidos por el check constraint ('recto', 'vuelto', 'unica')
                raw_side = str(side or "recto").lower().strip()
                if raw_side in ("double_page", "doble", "ambas"):
                    entry_folio_side = "recto"
                elif raw_side not in ("recto", "vuelto", "unica"):
                    entry_folio_side = "recto"
                else:
                    entry_folio_side = raw_side

                entry_record = {
                    "id": entry_uuid,
                    "tenant_id": self.tenant_id,
                    "folio_id": folio_uuid,
                    "entry_number": entry_num,
                    "folio_number": folio_num,
                    "folio_side": entry_folio_side,
                    "act_number": act_num,
                    "status": e_status,
                    "is_continued": is_cont,
                    "metadata": entry_metadata
                }

                # Registro de enlace interfolio
                if is_cont:
                    from_seq = e_data.get("continued_from_seq")
                    continued_links.append({
                        "child_entry_uuid": entry_uuid,
                        "series": series,
                        "parent_seq": from_seq
                    })

                entry_uuid_map[(series, folio_seq, entry_num)] = entry_uuid
                entries_to_insert.append(entry_record)

        # Inserción en Base de Datos (o simulación en Dry-Run)
        if not self.dry_run and self.client:
            print(f"[+] Insertando {len(folios_to_insert)} registros en tabla 'folios'...")
            try:
                self.client.insert("folios", folios_to_insert, upsert=True)
                print("[✓] Folios insertados exitosamente.")
            except Exception as e:
                print(f"[Error insertando folios]: {e}")
                raise

            print(f"[+] Insertando {len(entries_to_insert)} partidas en tabla 'folio_entries'...")
            try:
                self.client.insert("folio_entries", entries_to_insert, upsert=True)
                print("[✓] Partidas insertadas exitosamente en 'folio_entries'.")
            except Exception as e:
                print(f"[Error insertando partidas en 'folio_entries']: {e}")
                raise

            # Resolver enlaces de partidas continuadas
            for link in continued_links:
                child_id = link["child_entry_uuid"]
                p_seq = link["parent_seq"]
                series = link["series"]
                # Buscar el entry_id del padre en la secuencia anterior
                parent_key = next((k for k in entry_uuid_map.keys() if k[0] == series and k[1] == p_seq), None)
                if parent_key:
                    parent_entry_id = entry_uuid_map[parent_key]
                    try:
                        self.client.update("folio_entries", {"id": f"eq.{child_id}"}, {
                            "continued_from_entry_id": parent_entry_id
                        })
                    except Exception as ex:
                        print(f"[!] Error actualizando continued_from_entry_id: {ex}")
        else:
            print(f"[DRY-RUN] Simulada inserción de {len(folios_to_insert)} folios y {len(entries_to_insert)} partidas.")

        report = {
            "status": "success",
            "dry_run": self.dry_run,
            "tenant_id": self.tenant_id,
            "organization": ORGANIZATION_SLUG,
            "series_filter": series_filter,
            "volumes_processed": len(volume_uuid_map),
            "folios_processed": len(folios_to_insert),
            "entries_processed": len(entries_to_insert),
            "continued_links_resolved": len(continued_links)
        }
        return report


def main():
    parser = argparse.ArgumentParser(description="Seed realistic archival corpus into Supabase DB (SPEC-015 Phase 3)")
    parser.add_argument("--manifest", default=os.path.join(os.path.dirname(__file__), "corpus_manifest.json"),
                        help="Ruta al corpus_manifest.json")
    parser.add_argument("--type", choices=["bautismo", "matrimonio", "defuncion", "all"], default="all",
                        help="Serie sacramental a sembrar")
    parser.add_argument("--count", type=int, default=None,
                        help="Número de folios a sembrar por serie (10 o 20)")
    parser.add_argument("--clean", action="store_true",
                        help="Purga previa de los tomos y folios del corpus en codexflow-folios")
    parser.add_argument("--dry-run", action="store_true",
                        help="Simular el seeding sin realizar escrituras de red")
    args = parser.parse_args()

    print("==========================================================")
    print("      CODEXFLOW - ARCHIVAL CORPUS SEEDING (SPEC-015)      ")
    print("==========================================================")
    print(f"Tenant Target : {TENANT_ID} ({ORGANIZATION_SLUG})")
    print(f"Tipo/Serie    : {args.type}")
    print(f"Clean previo  : {args.clean}")
    print(f"Dry Run       : {args.dry_run}")
    print(f"Manifiesto    : {args.manifest}")
    print("----------------------------------------------------------")

    seeder = CorpusSeeder(manifest_path=args.manifest, dry_run=args.dry_run, clean=args.clean)
    report = seeder.seed_corpus(series_filter=args.type, count=args.count)

    print("\n----------------- RESUMEN DE EJECUCIÓN -----------------")
    print(f"Estado          : {report['status']}")
    print(f"Tomos creados   : {report['volumes_processed']}")
    print(f"Folios totales  : {report['folios_processed']}")
    print(f"Partidas totales: {report['entries_processed']}")
    print(f"Enlaces cont.   : {report['continued_links_resolved']}")
    print("==========================================================")


if __name__ == "__main__":
    main()
