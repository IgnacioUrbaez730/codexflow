import pytest
import unicodedata
import re
from typing import Optional


def compute_canonical_filename(
    tenant_subdomain: str,
    tome_name: str,
    tome_number: Optional[str],
    sequence_order: int,
    original_filename_or_url: Optional[str] = None
) -> str:
    """
    Calcula el nombre canónico de folio según el estándar FamilySearch:
    [ORGANIZACION]_[SERIE_O_PARROQUIA]_T[NUM_TOMO]_F[NUM_FOLIO_4_DIGITOS].[ext]
    Ejemplo: CARUPANO_BAUTISMOS_T01_F0001.jpg
    """
    def sanitize(text: Optional[str]) -> str:
        if not text:
            return ""
        # Normalizar tildes y caracteres especiales a ASCII
        norm = unicodedata.normalize("NFKD", str(text))
        ascii_text = norm.encode("ASCII", "ignore").decode("ASCII")
        # Mantener solo alfanuméricos y guiones bajos
        clean = re.sub(r"[^A-Za-z0-9]+", "_", ascii_text)
        return clean.strip("_").upper()

    # 1. Determinar prefijo de organización
    clean_org = sanitize(tenant_subdomain)
    if not clean_org or clean_org == "DEFAULT":
        clean_org = "CODEX"

    # 2. Determinar serie / nombre del tomo
    clean_tome_name = sanitize(tome_name)
    if not clean_tome_name:
        clean_tome_name = "TOMO"

    # 3. Determinar número de tomo formateado T01, T02...
    raw_num = ""
    if tome_number:
        # Extraer dígitos
        match = re.search(r"\d+", str(tome_number))
        if match:
            raw_num = match.group(0)
    if not raw_num:
        # Intentar extraer dígitos del nombre de la carpeta (ej. "Tomo 1" o "Bautismos 2")
        match = re.search(r"\d+", str(tome_name))
        if match:
            raw_num = match.group(0)

    if raw_num:
        tome_str = f"T{raw_num.zfill(2)}"
    else:
        tome_str = "T01"

    # Si clean_tome_name es puramente algo como "TOMO_1" o "TOMO", podemos limpiarlo o dejarlo conciso
    # Ej: Si tome_name era "Tomo 1", clean_tome_name es "TOMO_1". Si termina en _1, o coincide con TOMO, lo estandarizamos
    # Por la spec:
    # "Si la organización es Caritas Carupano, la carpeta es 'Bautismos' (o Tomo 1):
    #  CARUPANO_BAUTISMOS_T01_F0001.jpg
    #  Si no hay serie definida pero la carpeta se llama 'Tomo 1' o 'Libro de Bautismos':
    #  Se limpia el nombre de la carpeta a caracteres alfanuméricos ASCII en mayúsculas: BAUTISMOS_T01_F0001.jpg"

    # 4. Formatear folio a 4 dígitos F0001
    seq = max(1, int(sequence_order or 1))
    folio_str = f"F{str(seq).zfill(4)}"

    # 5. Extraer extensión original preservándola
    ext = "jpg"
    if original_filename_or_url:
        # Extraer basename quitando query params si los hay
        base_name = original_filename_or_url.split("?")[0].split("/")[-1]
        if "." in base_name:
            cand_ext = base_name.rsplit(".", 1)[-1].lower()
            if cand_ext in ("jpg", "jpeg", "png", "webp", "tif", "tiff"):
                ext = "jpg" if cand_ext == "jpeg" else cand_ext

    # 6. Ensamblar partes evitando duplicaciones superfluas
    parts = []
    if clean_org:
        parts.append(clean_org)
    if clean_tome_name:
        parts.append(clean_tome_name)
    parts.append(tome_str)
    parts.append(folio_str)

    assembled = "_".join(parts)
    return f"{assembled}.{ext}"


def test_compute_canonical_filename_basic():
    name = compute_canonical_filename(
        tenant_subdomain="carupano",
        tome_name="Bautismos",
        tome_number="1",
        sequence_order=1,
        original_filename_or_url="DSC_0001.JPG"
    )
    assert name == "CARUPANO_BAUTISMOS_T01_F0001.jpg"


def test_compute_canonical_filename_accents_and_spaces():
    name = compute_canonical_filename(
        tenant_subdomain="cáritas-carúpano",
        tome_name="Libro de Bautismos & Matrimonios",
        tome_number="Tomo 02",
        sequence_order=15,
        original_filename_or_url="https://r2.bucket.com/uploads/scan_015.png?token=123"
    )
    assert name == "CARITAS_CARUPANO_LIBRO_DE_BAUTISMOS_MATRIMONIOS_T02_F0015.png"


def test_compute_canonical_filename_fallback_org():
    name = compute_canonical_filename(
        tenant_subdomain="",
        tome_name="Defunciones",
        tome_number=None,
        sequence_order=99,
        original_filename_or_url=None
    )
    assert name == "CODEX_DEFUNCIONES_T01_F0099.jpg"


if __name__ == "__main__":
    test_compute_canonical_filename_basic()
    test_compute_canonical_filename_accents_and_spaces()
    test_compute_canonical_filename_fallback_org()
    print("All canonical filename tests passed!")
