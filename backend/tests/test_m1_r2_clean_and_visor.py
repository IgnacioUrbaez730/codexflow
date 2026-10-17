"""
Tests para el Loop de Mantenimiento M1 (SPEC-015):
- M1-01: Función de purga de archivos viejos en 4bf4e846-b22d-4105-aacf-3751cc0de60c/ y eliminación de corpus/ en R2.
- M1-02: Generación de imágenes paleográficas .jpg reales (image/jpeg, 1500x2000 y 2400x1600) con Pillow.
- M1-03: Prefijo Multi-Tenant canónico 4bf4e846-b22d-4105-aacf-3751cc0de60c/{canonical_filename} en corpus_manifest.json y seed_realistic_corpus.py.
- M1-04: Limpieza de parches de simulación (data:image/, /api/v1/folios/.../image) en backend/main.py y visor/page.tsx.
"""

import os
import sys
import json

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SEEDING_DIR = os.path.join(ROOT_DIR, "tools", "seeding")
if SEEDING_DIR not in sys.path:
    sys.path.insert(0, SEEDING_DIR)

import upload_corpus_to_r2 as r2_mod


def test_m1_02_generate_real_jpeg_folio(tmp_path):
    """Verifica que generate_paleographic_folio_file genera un archivo .jpg binario real de 1500x2000 px."""
    sample_folio = {
        "series": "bautismo",
        "folio_number": 1,
        "folio_side": "recto",
        "canonical_filename": "CARUPANO_BAU_T01_F001R.jpg",
        "stress_case": "standard",
        "entries": [
            {
                "entry_number": 1,
                "status": "completed",
                "metadata": {
                    "bautizado": "José Francisco Alcalá Gómez",
                    "fecha_sacramento": "1885-01-14",
                    "nombre_padre": "Manuel Vicente Alcalá",
                    "nombre_madre": "María Antonia Gómez"
                }
            }
        ]
    }
    out_base = os.path.join(str(tmp_path), "CARUPANO_BAU_T01_F001R.jpg")
    jpg_path = r2_mod.generate_paleographic_folio_file(sample_folio, out_base)
    assert jpg_path.endswith(".jpg")
    assert os.path.exists(jpg_path)

    with open(jpg_path, "rb") as f:
        header = f.read(4)
    # Firma mágica de JPEG: FF D8 FF
    assert header[:3] == b"\xff\xd8\xff"

    from PIL import Image
    with Image.open(jpg_path) as im:
        assert im.format == "JPEG"
        assert im.size == (1500, 2000)


def test_m1_03_manifest_uses_tenant_prefix():
    """Verifica que las 60 entradas en corpus_manifest.json usan el prefijo del tenant y extensión .jpg."""
    manifest_path = os.path.join(SEEDING_DIR, "corpus_manifest.json")
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    folios = manifest.get("folios", [])
    assert len(folios) == 60
    tenant_id = "4bf4e846-b22d-4105-aacf-3751cc0de60c"
    for folio in folios:
        cname = folio["canonical_filename"]
        remote_url = folio["remote_image_url"]
        assert cname.endswith(".jpg")
        assert f"/{tenant_id}/{cname}" in remote_url
        assert "/corpus/" not in remote_url


def test_m1_04_codebase_clean_of_simulation_patches():
    """Verifica que backend/main.py y visor/page.tsx no tengan parches de data:image/ ni /image fallback."""
    main_py_path = os.path.join(ROOT_DIR, "backend", "main.py")
    with open(main_py_path, "r", encoding="utf-8") as f:
        main_content = f.read()

    assert 'startswith("data:image/")' not in main_content
    assert 'def get_folio_image(' not in main_content

    visor_path = os.path.join(ROOT_DIR, "frontend", "src", "app", "[subdomain]", "visor", "page.tsx")
    with open(visor_path, "r", encoding="utf-8") as f:
        visor_content = f.read()

    assert "displayImageUrl" not in visor_content
    assert "placeholderSvg" not in visor_content
    assert "/image`" not in visor_content
