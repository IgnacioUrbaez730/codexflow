"""
tools/seeding/execute_r2_upload_and_supabase_sync.py

Script de ejecución y verificación de las tareas M1-01, M1-02 y M1-03:
1. Purga los archivos basura de prueba en 4bf4e846-b22d-4105-aacf-3751cc0de60c/ y elimina corpus/ en R2.
2. Genera las 60 imágenes paleográficas .jpg reales (1500x2000 y 2400x1600) con Pillow y las sube a 4bf4e846-b22d-4105-aacf-3751cc0de60c/{canonical_filename}.
3. Actualiza folios.r2_url en Supabase para los 60 folios del tenant y actualiza corpus_manifest.json.
4. Verifica list_objects_v2 en Cloudflare R2, conteo en Supabase y descarga real HTTP 200 image/jpeg.
"""

import os
import sys
import urllib.request
from upload_corpus_to_r2 import (
    DEFAULT_TENANT_ID,
    get_r2_config,
    create_s3_client,
    get_supabase_client,
    sync_corpus_to_r2
)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


def run():
    manifest_path = os.path.join(os.path.dirname(__file__), "corpus_manifest.json")
    images_dir = os.path.join(os.path.dirname(__file__), "corpus")
    tenant_id = DEFAULT_TENANT_ID

    # Ejecutar sincronización completa (M1-01, M1-02, M1-03)
    res = sync_corpus_to_r2(manifest_path=manifest_path, images_dir=images_dir, dry_run=False, tenant_id=tenant_id)

    cfg = get_r2_config()
    bucket_name = cfg["bucket_name"]
    s3_client = create_s3_client(cfg)
    supabase = get_supabase_client()

    print("\n=== VERIFICACIÓN M1-01 & M1-02: Estado del Bucket Cloudflare R2 ===")
    r2_tenant_resp = s3_client.list_objects_v2(Bucket=bucket_name, Prefix=f"{tenant_id}/")
    r2_tenant_objs = r2_tenant_resp.get("Contents", [])
    jpg_objs = [o["Key"] for o in r2_tenant_objs if o["Key"].endswith(".jpg") and "CARUPANO_" in o["Key"]]
    non_canonical_objs = [o["Key"] for o in r2_tenant_objs if o["Key"] not in jpg_objs]

    r2_corpus_resp = s3_client.list_objects_v2(Bucket=bucket_name, Prefix="corpus/")
    r2_corpus_objs = r2_corpus_resp.get("Contents", [])

    print(f"Objetos .jpg canónicos en '{tenant_id}/': {len(jpg_objs)}")
    print(f"Objetos residuales/viejos en '{tenant_id}/': {len(non_canonical_objs)}")
    print(f"Objetos en carpeta huérfana 'corpus/': {len(r2_corpus_objs)}")

    assert len(jpg_objs) == 60, f"Se esperaban 60 objetos .jpg en {tenant_id}/, encontrados: {len(jpg_objs)}"
    assert len(non_canonical_objs) == 0, f"Aún existen archivos no canónicos en {tenant_id}/: {non_canonical_objs}"
    assert len(r2_corpus_objs) == 0, f"La carpeta corpus/ no está vacía: {len(r2_corpus_objs)} objetos"

    print("\n=== VERIFICACIÓN M1-03: Estado de folios.r2_url en Supabase ===")
    db_res = supabase.table("folios").select("id, canonical_filename, r2_url").eq("tenant_id", tenant_id).execute()
    db_folios = db_res.data or []
    valid_db_urls = [
        f for f in db_folios
        if str(f.get("r2_url", "")).startswith(f"{tenant_id}/CARUPANO_") and str(f.get("r2_url", "")).endswith(".jpg")
    ]
    print(f"Total folios en Supabase para {tenant_id}: {len(db_folios)}")
    print(f"Folios con r2_url canónico '{tenant_id}/CARUPANO_*.jpg': {len(valid_db_urls)}")
    assert len(valid_db_urls) == 60, f"Se esperaban 60 folios con r2_url canónico, encontrados: {len(valid_db_urls)}"

    print("\n=== VERIFICACIÓN DE PRESIGNED URL Y DESCARGA JPEG REAL ===")
    test_key = f"{tenant_id}/CARUPANO_MAT_T01_F010R.jpg"
    presigned_url = s3_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket_name, "Key": test_key},
        ExpiresIn=3600
    )
    req = urllib.request.Request(presigned_url, headers={"User-Agent": "CodexFlow-M1-Verifier/1.0"})
    with urllib.request.urlopen(req) as resp:
        code = resp.getcode()
        body = resp.read()
        content_type = resp.headers.get("Content-Type")

    print(f"Clave verificada: {test_key}")
    print(f"HTTP Status: {code}")
    print(f"Content-Type: {content_type}")
    print(f"Tamaño JPEG descargado: {len(body)} bytes ({len(body) / 1024:.1f} KB)")
    assert code == 200
    assert content_type == "image/jpeg", f"Content-Type inesperado: {content_type}"
    assert body[:2] == b"\xff\xd8", "El archivo descargado no tiene firma binaria JPEG (FFD8)"
    print(">>> M1-01, M1-02 y M1-03 COMPLETADAS Y VERIFICADAS EXITOSAMENTE <<<")


if __name__ == "__main__":
    run()
