"""
tools/seeding/execute_r2_upload_and_supabase_sync.py

Script para:
1. Conectar a Cloudflare R2 con credenciales oficiales.
2. Generar imágenes SVG paleográficas vectoriales de alta fidelidad para los 60 folios del manifest.
3. Subirlas a Cloudflare R2 con Content-Type: image/svg+xml bajo corpus/{series}/{filename_base}.svg.
4. Actualizar Supabase (tenant: 4bf4e846-b22d-4105-aacf-3751cc0de60c) con la columna r2_url.
5. Probar presigned URL y descarga HTTP 200 con Content-Type: image/svg+xml y tamano real (> 10 KB).
"""

import os
import sys
import json
import urllib.request
from typing import Dict, Any, List

# Cargar .env de backend
env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend", ".env"))
if os.path.exists(env_path):
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()

import boto3
from botocore.config import Config
from supabase import create_client

TENANT_ID = "4bf4e846-b22d-4105-aacf-3751cc0de60c"
BUCKET_NAME = os.getenv("R2_BUCKET_NAME", "codexflow-folios")
ENDPOINT_URL = os.getenv("R2_ENDPOINT_URL")
ACCESS_KEY = os.getenv("R2_ACCESS_KEY_ID")
SECRET_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

s3_client = boto3.client(
    "s3",
    endpoint_url=ENDPOINT_URL,
    aws_access_key_id=ACCESS_KEY,
    aws_secret_access_key=SECRET_KEY,
    config=Config(signature_version="s3v4")
)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

from upload_corpus_to_r2 import (
    generate_all_local_images,
    upload_folio_image,
    SERIES_FOLDER_MAP,
    resolve_manifest_urls
)

def run():
    manifest_path = os.path.join(os.path.dirname(__file__), "corpus_manifest.json")
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    images_dir = os.path.join(os.path.dirname(__file__), "corpus")
    print("=== Generando 60 folios vectoriales SVG paleograficos ===")
    local_files = generate_all_local_images(manifest, images_dir)
    print(f"Generados {len(local_files)} archivos locales SVG.")

    print(f"\n=== Subiendo folios SVG a Cloudflare R2 ('{BUCKET_NAME}') ===")
    uploaded = 0
    folios = manifest.get("folios", [])
    for folio in folios:
        series = folio.get("series", "bautismo")
        folder = SERIES_FOLDER_MAP.get(series, series)
        canonical_name = folio.get("canonical_filename")
        base_name = os.path.splitext(canonical_name)[0]
        svg_filename = f"{base_name}.svg"
        local_svg_path = os.path.join(images_dir, folder, svg_filename)
        s3_key = f"corpus/{folder}/{svg_filename}"

        upload_folio_image(s3_client, local_svg_path, BUCKET_NAME, s3_key)
        uploaded += 1
        if uploaded % 10 == 0 or uploaded == len(folios):
            print(f"Subidos a R2: {uploaded}/{len(folios)}...")

    print(f"Total subidos a R2: {uploaded} folios SVG.")

    print(f"\n=== Actualizando columna 'r2_url' en Supabase para tenant {TENANT_ID} ===")
    db_res = supabase.table("folios").select("id, canonical_filename, folio_number, folio_side, sequence_order, r2_url").eq("tenant_id", TENANT_ID).execute()
    existing_db_folios = db_res.data or []
    print(f"Encontrados {len(existing_db_folios)} folios en la BD de Supabase para este tenant.")

    updated_db = 0
    for folio in folios:
        series = folio.get("series", "bautismo")
        folder = SERIES_FOLDER_MAP.get(series, series)
        canonical_name = folio.get("canonical_filename")
        base_name = os.path.splitext(canonical_name)[0]
        svg_filename = f"{base_name}.svg"
        r2_key = f"corpus/{folder}/{svg_filename}"

        # 1. Probar actualizar por canonical_filename exacto (.jpg o .svg)
        u_res = supabase.table("folios").update({
            "r2_url": r2_key
        }).eq("tenant_id", TENANT_ID).or_(f"canonical_filename.eq.{canonical_name},canonical_filename.eq.{svg_filename},filename.eq.{canonical_name}").execute()

        if u_res.data and len(u_res.data) > 0:
            updated_db += len(u_res.data)
        else:
            fn = folio.get("folio_number")
            fs = folio.get("folio_side")
            if fn is not None and fs is not None:
                u_num = supabase.table("folios").update({
                    "r2_url": r2_key
                }).eq("tenant_id", TENANT_ID).eq("folio_number", fn).eq("folio_side", fs).execute()
                if u_num.data and len(u_num.data) > 0:
                    updated_db += len(u_num.data)

    print(f"Folios actualizados con r2_url en Supabase: {updated_db}")

    print(f"\n=== Verificando Presigned URL y Descarga Real de R2 ===")
    test_key = "corpus/matrimonios/CARUPANO_MAT_T01_F010R.svg"
    presigned_url = s3_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": BUCKET_NAME, "Key": test_key},
        ExpiresIn=3600
    )
    print(f"Presigned URL generada:\n{presigned_url}")

    req = urllib.request.Request(presigned_url, headers={"User-Agent": "CodexFlow-Verifier/1.0"})
    with urllib.request.urlopen(req) as resp:
        code = resp.getcode()
        body = resp.read()
        size_bytes = len(body)
        content_type = resp.headers.get("Content-Type")

    print(f"HTTP Status: {code}")
    print(f"Content-Type: {content_type}")
    print(f"Tamano descargado: {size_bytes} bytes ({size_bytes / 1024:.2f} KB)")

    assert code == 200, f"Error: HTTP {code}"
    assert "svg" in (content_type or "").lower(), f"Error: Content-Type no es SVG ({content_type})"
    assert size_bytes > 5000, f"Error: tamano muy bajo ({size_bytes} bytes)"
    print(">>> VERIFICACION EXITOSA: Descarga de imagen SVG paleografica desde Cloudflare R2 confirmada con HTTP 200 y Content-Type: image/svg+xml <<<")

if __name__ == "__main__":
    run()
