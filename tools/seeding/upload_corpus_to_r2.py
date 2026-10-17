"""
tools/seeding/upload_corpus_to_r2.py

Pipeline de generación de imágenes paleográficas vectoriales realistas (SVG puro),
subida directa a Cloudflare R2 Storage y sincronización de la columna r2_url en Supabase.
"""

import os
import sys
import json
import base64
import argparse
from typing import Dict, Any, List, Optional
from io import BytesIO

# Cargar variables de entorno desde backend/.env si están disponibles
env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend", ".env"))
if os.path.exists(env_path):
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

try:
    from PIL import Image, ImageDraw, ImageFont, ImageFilter
except ImportError:
    Image = None

try:
    import boto3
    from botocore.config import Config
except ImportError:
    boto3 = None
    Config = None

try:
    from supabase import create_client, Client
except ImportError:
    create_client = None
    Client = None

DEFAULT_TENANT_ID = "4bf4e846-b22d-4105-aacf-3751cc0de60c"

DEFAULT_R2_CONFIG = {
    "bucket_name": "codexflow-folios",
    "endpoint_url": "https://d1620d85c9ca0b8838d6049677b6f58a.r2.cloudflarestorage.com",
    "access_key_id": "a33861b8323b78a31a58957d8894114a",
    "secret_access_key": "e015ecd1298571b0ef54df836b0c3362d655615fd2836a616cbc24767529eba2",
    "public_url_prefix": "https://pub-codexflow.r2.dev"
}

SERIES_FOLDER_MAP = {
    "bautismo": "bautismos",
    "matrimonio": "matrimonios",
    "defuncion": "defunciones"
}


def get_r2_config() -> Dict[str, str]:
    """Obtiene la configuración de Cloudflare R2 / S3 desde variables de entorno o defaults."""
    return {
        "bucket_name": os.getenv("R2_BUCKET_NAME", DEFAULT_R2_CONFIG["bucket_name"]),
        "endpoint_url": os.getenv("R2_ENDPOINT_URL", DEFAULT_R2_CONFIG["endpoint_url"]),
        "access_key_id": os.getenv("R2_ACCESS_KEY_ID", DEFAULT_R2_CONFIG["access_key_id"]),
        "secret_access_key": os.getenv("R2_SECRET_ACCESS_KEY", DEFAULT_R2_CONFIG["secret_access_key"]),
        "public_url_prefix": os.getenv("R2_PUBLIC_URL_PREFIX", DEFAULT_R2_CONFIG["public_url_prefix"]).rstrip("/")
    }


def is_r2_configured(cfg: Optional[Dict[str, str]] = None) -> bool:
    """Verifica si las credenciales de Cloudflare R2 están presentes."""
    if cfg is None:
        cfg = get_r2_config()
    acc_id = cfg.get("access_key_id", "").strip()
    sec_key = cfg.get("secret_access_key", "").strip()
    return bool(acc_id and sec_key and len(acc_id) >= 16 and len(sec_key) >= 16)


def create_s3_client(cfg: Optional[Dict[str, str]] = None):
    """Crea y devuelve un cliente S3/boto3 configurado para Cloudflare R2."""
    if boto3 is None:
        raise RuntimeError("boto3 no está instalado en el entorno.")

    if cfg is None:
        cfg = get_r2_config()

    client_kwargs = {
        "service_name": "s3",
        "endpoint_url": cfg.get("endpoint_url"),
        "aws_access_key_id": cfg.get("access_key_id"),
        "aws_secret_access_key": cfg.get("secret_access_key"),
        "region_name": "auto"
    }

    if Config is not None:
        client_kwargs["config"] = Config(signature_version="s3v4")

    return boto3.client(**client_kwargs)


def get_supabase_client() -> Optional[Any]:
    """Crea un cliente Supabase usando SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY."""
    if create_client is None:
        return None
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
    if not url or not key:
        return None
    return create_client(url, key)


def generate_paleographic_svg(metadata: Dict[str, Any]) -> str:
    """
    Genera un documento SVG realista con textura paleográfica de pergamino, marcas de agua,
    caligrafía histórica ferrogálica del siglo XIX y notas marginales.
    Pesa ~25 KB y ofrece resolución infinita al 100% de nitidez para el visor dual.
    """
    side = metadata.get("folio_side", "recto")
    stress = metadata.get("stress_case", "standard")
    series = metadata.get("series", "bautismo").upper()
    folio = metadata.get("folio_number", 1)
    side_label = side.upper()
    canonical_name = metadata.get("canonical_filename", f"FOLIO_{folio}.jpg")
    svg_display_name = os.path.splitext(canonical_name)[0] + ".svg"

    if side == "double_page":
        width, height = 2400, 1600
        is_dp = True
    else:
        width, height = 1500, 2000
        is_dp = False

    bg_paper = "#f4ebd9"
    if stress == "degraded":
        bg_paper = "#dfd0b5"
    
    ink_primary = "#2c221a" if stress != "degraded" else "#6e6050"
    ink_secondary = "#4a3b2c" if stress != "degraded" else "#8c7e6c"
    stain_color = "rgba(180, 150, 110, 0.35)"

    svg_elements = []

    # 1. Filtros y texturas
    svg_elements.append(f"""
    <defs>
      <filter id="paper-texture" x="0%" y="0%" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" result="noise" />
        <feDiffuseLighting in="noise" lighting-color="{bg_paper}" surfaceScale="2" result="light">
          <feDistantLight azimuth="60" elevation="50" />
        </feDiffuseLighting>
        <feBlend mode="multiply" in="SourceGraphic" in2="light" />
      </filter>
      <linearGradient id="binding-gradient" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#4a3525" stop-opacity="0.8"/>
        <stop offset="50%" stop-color="#2a1d13" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="#4a3525" stop-opacity="0.8"/>
      </linearGradient>
    </defs>
    """)

    # 2. Fondo de papel
    svg_elements.append(f'<rect width="{width}" height="{height}" fill="{bg_paper}" filter="url(#paper-texture)"/>')

    # 3. Manchas de humedad / degradación (si aplica)
    if stress == "degraded":
        svg_elements.append(f'<ellipse cx="180" cy="160" rx="160" ry="120" fill="{stain_color}" filter="blur(20px)"/>')
        svg_elements.append(f'<ellipse cx="{width - 200}" cy="{height - 200}" rx="220" ry="160" fill="{stain_color}" filter="blur(25px)"/>')
        svg_elements.append(f'<path d="M 400,{height-100} Q 600,{height-180} 800,{height-80} T {width-100},{height-90}" fill="none" stroke="{stain_color}" stroke-width="40" filter="blur(15px)"/>')

    # 4. Doble página: pliegue central de encuadernación
    if is_dp:
        cx = width // 2
        svg_elements.append(f'<rect x="{cx - 24}" y="0" width="48" height="{height}" fill="url(#binding-gradient)"/>')
        svg_elements.append(f'<line x1="{cx}" y1="0" x2="{cx}" y2="{height}" stroke="#1e140d" stroke-width="4"/>')

    # 5. Encabezado eclesiástico canónico
    svg_elements.append(f'''
    <g font-family="Georgia, serif" fill="{ink_primary}">
      <text x="80" y="70" font-size="28" font-weight="bold" letter-spacing="2">PARROQUIA SANTA ROSA DE CARÚPANO - DIÓCESIS DE GUAYANA</text>
      <text x="80" y="110" font-size="22" font-style="italic">Libro 1 de {series.capitalize()} (1885-1895) — Folio {folio} [{side_label}] — {svg_display_name}</text>
      <line x1="80" y1="130" x2="{width - 80}" y2="130" stroke="{ink_primary}" stroke-width="2.5" />
    </g>
    ''')

    # 6. Texto caligráfico manuscrito y entradas
    y_start = 180
    num_lines = 32 if height > 1600 else 24
    line_spacing = (height - 260) // num_lines

    has_marginal = metadata.get("stress_case") == "marginal_notes" or metadata.get("has_marginal_notes")
    margin_x_offset = 320 if has_marginal else 100

    if has_marginal:
        svg_elements.append(f'''
        <g stroke="{ink_secondary}" fill="none" stroke-width="1.5">
          <line x1="300" y1="140" x2="300" y2="{height - 80}" stroke-dasharray="4,4"/>
          <text x="90" y="240" font-family="Georgia, serif" font-size="16" fill="{ink_secondary}" transform="rotate(-90 90,240)">
            N.M. Legitimada por subsiguiente matrimonio de sus padres el 22-Ago-1895. Pbro. Carrión.
          </text>
        </g>
        ''')

    svg_elements.append(f'<g stroke="{ink_primary}" stroke-width="2" stroke-linecap="round" fill="none">')
    for i in range(num_lines):
        y = y_start + (i * line_spacing)

        if stress == "blank":
            if i == 12:
                svg_elements.append(f'''
                <text x="{width // 2}" y="{y}" font-family="Georgia, serif" font-size="24" font-style="italic" fill="{ink_primary}" text-anchor="middle">
                  — Auto de Visita Canónica y Cierre de Año — Sin partidas sacramentales en este folio —
                </text>
                ''')
            continue

        if stress == "doubtful" and 10 <= i <= 14:
            svg_elements.append(f'<line x1="{margin_x_offset}" y1="{y}" x2="{margin_x_offset + 300}" y2="{y}" stroke="{ink_secondary}" stroke-dasharray="10,15" stroke-width="3"/>')
            continue

        x1 = margin_x_offset
        x2 = width - 100
        step = 40
        path_parts = [f"M {x1} {y}"]
        for x in range(x1, x2 - step, step):
            wave = (x % 9) - 4
            cx1 = x + (step // 2)
            cy1 = y + wave
            cx2 = x + step
            cy2 = y - (wave // 2)
            path_parts.append(f"Q {cx1} {cy1}, {cx2} {cy2}")
        svg_elements.append(f'<path d="{" ".join(path_parts)}"/>')

    svg_elements.append('</g>')

    # 7. Sello eclesiástico parroquial al pie
    svg_elements.append(f'''
    <g transform="translate({width - 240}, {height - 180})" stroke="{ink_secondary}" fill="none">
      <circle cx="70" cy="70" r="60" stroke-width="2.5" stroke-dasharray="6,3"/>
      <circle cx="70" cy="70" r="48" stroke-width="1"/>
      <text x="70" y="65" font-family="serif" font-size="12" fill="{ink_secondary}" text-anchor="middle" font-weight="bold">PARROQUIA</text>
      <text x="70" y="80" font-family="serif" font-size="11" fill="{ink_secondary}" text-anchor="middle">SANTA ROSA</text>
      <text x="70" y="93" font-family="serif" font-size="9" fill="{ink_secondary}" text-anchor="middle">CARÚPANO</text>
    </g>
    ''')

    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="100%" height="100%">
      {"".join(svg_elements)}
    </svg>'''
    return svg_content


def generate_paleographic_folio_file(metadata: Dict[str, Any], output_path_base: str) -> str:
    """
    Genera el archivo SVG vectorial paleográfico de alta definición.
    Retorna la ruta absoluta del archivo .svg generado.
    """
    svg_path = os.path.splitext(output_path_base)[0] + ".svg"
    os.makedirs(os.path.dirname(svg_path), exist_ok=True)
    svg_content = generate_paleographic_svg(metadata)
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(svg_content)
    return svg_path


def generate_all_local_images(manifest: Dict[str, Any], target_dir: str) -> List[str]:
    """Genera los 60 folios SVG paleográficos en el directorio local organizado por series."""
    generated = []
    folios = manifest.get("folios", [])
    
    for folio in folios:
        series = folio.get("series", "bautismo")
        folder_name = SERIES_FOLDER_MAP.get(series, series)
        series_dir = os.path.join(target_dir, folder_name)
        filename = folio.get("canonical_filename")
        if not filename:
            continue
        
        filepath_base = os.path.join(series_dir, filename)
        svg_file = generate_paleographic_folio_file(folio, filepath_base)
        generated.append(svg_file)

    return generated


def upload_folio_image(s3_client, file_path: str, bucket_name: str, object_key: str):
    """Sube un archivo de imagen o SVG a S3/R2 con headers de cache y content-type adecuados."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Archivo de imagen no encontrado: {file_path}")

    content_type = "image/svg+xml" if file_path.endswith(".svg") else "image/jpeg"

    extra_args = {
        "ContentType": content_type,
        "CacheControl": "public, max-age=31536000, immutable"
    }

    s3_client.upload_file(file_path, bucket_name, object_key, ExtraArgs=extra_args)


def resolve_manifest_urls(manifest: Dict[str, Any], public_url_prefix: str) -> Dict[str, Any]:
    """Actualiza los URLs de remote_image_url y r2_url en el manifest apuntando al SVG canónico."""
    prefix = public_url_prefix.rstrip("/")
    for folio in manifest.get("folios", []):
        series = folio.get("series", "bautismo")
        folder = SERIES_FOLDER_MAP.get(series, series)
        canonical_name = folio.get("canonical_filename", "")
        base_name = os.path.splitext(canonical_name)[0]
        svg_filename = f"{base_name}.svg"

        folio["remote_image_url"] = f"{prefix}/corpus/{folder}/{svg_filename}"
        folio["r2_url"] = f"corpus/{folder}/{svg_filename}"
    return manifest


def update_supabase_folios(manifest: Dict[str, Any], tenant_id: str) -> int:
    """
    Actualiza la columna r2_url en Supabase para los 60 folios del tenant.
    Usa la clave relativa vectorial: corpus/{series}/{filename_base}.svg
    """
    supabase = get_supabase_client()
    if not supabase:
        print("[Aviso] Cliente de Supabase no disponible o credenciales incompletas.")
        return 0

    folios = manifest.get("folios", [])
    updated_count = 0

    for folio in folios:
        series = folio.get("series", "bautismo")
        folder = SERIES_FOLDER_MAP.get(series, series)
        canonical_name = folio.get("canonical_filename", "")
        base_name = os.path.splitext(canonical_name)[0]
        r2_key = f"corpus/{folder}/{base_name}.svg"

        try:
            # Buscar el folio en Supabase por canonical_filename (.jpg o .svg) o por folio_number y cara
            res = (
                supabase.table("folios")
                .update({"r2_url": r2_key})
                .eq("tenant_id", tenant_id)
                .or_(f"canonical_filename.eq.{canonical_name},canonical_filename.eq.{base_name}.svg,filename.eq.{canonical_name}")
                .execute()
            )
            if res.data and len(res.data) > 0:
                updated_count += len(res.data)
            else:
                fn = folio.get("folio_number")
                side = folio.get("folio_side")
                if fn is not None and side is not None:
                    res_num = (
                        supabase.table("folios")
                        .update({"r2_url": r2_key})
                        .eq("tenant_id", tenant_id)
                        .eq("folio_number", fn)
                        .eq("folio_side", side)
                        .execute()
                    )
                    if res_num.data and len(res_num.data) > 0:
                        updated_count += len(res_num.data)
        except Exception as e:
            print(f"[Aviso] Error actualizando Supabase para {canonical_name}: {e}")

    print(f"[Supabase] Se actualizaron r2_url para {updated_count} folios del tenant {tenant_id}.")
    return updated_count


def sync_corpus_to_r2(
    manifest_path: str,
    images_dir: Optional[str] = None,
    dry_run: bool = False,
    tenant_id: str = DEFAULT_TENANT_ID
) -> Dict[str, Any]:
    """
    Orquesta la sincronización del corpus completo hacia Cloudflare R2 y actualiza el manifiesto y Supabase.
    """
    if not os.path.exists(manifest_path):
        raise FileNotFoundError(f"Manifiesto no encontrado en {manifest_path}")

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    cfg = get_r2_config()
    bucket = cfg["bucket_name"]
    public_prefix = cfg["public_url_prefix"]
    has_valid_creds = is_r2_configured(cfg)

    if images_dir is None:
        images_dir = os.path.join(os.path.dirname(manifest_path), "corpus")

    print(f"-> Generando imágenes paleográficas vectoriales SVG en {images_dir}...")
    generated_files = generate_all_local_images(manifest, images_dir)
    print(f"-> Generadas {len(generated_files)} imágenes locales SVG.")

    synced_items = []
    s3_client = None
    if not dry_run and has_valid_creds:
        try:
            s3_client = create_s3_client(cfg)
            print(f"-> Conexión a Cloudflare R2 inicializada (bucket: '{bucket}')")
        except Exception as e:
            print(f"[Aviso] No se pudo inicializar cliente R2: {e}")
            s3_client = None

    uploaded_count = 0
    for folio in manifest.get("folios", []):
        series = folio.get("series", "bautismo")
        folder = SERIES_FOLDER_MAP.get(series, series)
        canonical_name = folio.get("canonical_filename")
        base_name = os.path.splitext(canonical_name)[0]
        svg_filename = f"{base_name}.svg"
        local_svg_path = os.path.join(images_dir, folder, svg_filename)
        s3_key = f"corpus/{folder}/{svg_filename}"

        if not dry_run and s3_client is not None:
            try:
                upload_folio_image(s3_client, local_svg_path, bucket, s3_key)
                uploaded_count += 1
            except Exception as e:
                print(f"[Aviso] Error al subir {svg_filename} a R2: {e}")

        synced_items.append({
            "filename": svg_filename,
            "s3_key": s3_key,
            "url": f"{public_prefix}/{s3_key}"
        })

    print(f"-> Subidos a R2: {uploaded_count}/{len(synced_items)} folios SVG.")

    # Actualizar manifiesto
    manifest = resolve_manifest_urls(manifest, public_prefix)
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    # Actualizar Supabase
    supabase_updated = 0
    if not dry_run:
        supabase_updated = update_supabase_folios(manifest, tenant_id)

    return {
        "status": "success",
        "dry_run": dry_run,
        "bucket": bucket,
        "uploaded_count": uploaded_count,
        "supabase_updated": supabase_updated,
        "synced": synced_items,
        "manifest_path": manifest_path
    }


def main():
    parser = argparse.ArgumentParser(description="Upload and sync paleographic corpus to Cloudflare R2 and Supabase")
    parser.add_argument("--manifest", default=os.path.join(os.path.dirname(__file__), "corpus_manifest.json"),
                        help="Ruta al corpus_manifest.json")
    parser.add_argument("--images-dir", default=os.path.join(os.path.dirname(__file__), "corpus"),
                        help="Directorio local para almacenar las imágenes")
    parser.add_argument("--tenant-id", default=DEFAULT_TENANT_ID,
                        help="ID del tenant a actualizar en Supabase")
    parser.add_argument("--dry-run", action="store_true",
                        help="Genera las imágenes y actualiza el manifiesto sin subir a S3/R2 ni Supabase")
    args = parser.parse_args()

    print(f"=== Iniciando Pipeline de Imágenes Paleográficas R2 y Supabase ===")
    print(f"Manifiesto: {args.manifest}")
    print(f"Directorio de imágenes: {args.images_dir}")
    print(f"Tenant ID: {args.tenant_id}")
    print(f"Dry Run: {args.dry_run}")

    result = sync_corpus_to_r2(args.manifest, args.images_dir, dry_run=args.dry_run, tenant_id=args.tenant_id)
    print(f"Completado exitosamente. Sincronizados {len(result['synced'])} folios. Subidos a R2: {result['uploaded_count']}, Supabase: {result['supabase_updated']}.")


if __name__ == "__main__":
    main()
