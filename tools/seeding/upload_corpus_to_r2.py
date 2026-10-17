"""
tools/seeding/upload_corpus_to_r2.py

Pipeline de mantenimiento M1 y generación de imágenes paleográficas fotográficas (.jpg reales):
1. Purga de archivos residuales de prueba en 4bf4e846-b22d-4105-aacf-3751cc0de60c/ y eliminación total de corpus/ en Cloudflare R2.
2. Generación de 60 láminas paleográficas rasterizadas en formato JPEG real (1500x2000 px / 2400x1600 px) con Pillow.
3. Subida directa al prefijo Multi-Tenant oficial: 4bf4e846-b22d-4105-aacf-3751cc0de60c/{canonical_filename}.
4. Sincronización atómica de folios.r2_url en Supabase y actualización de corpus_manifest.json.
"""

import os
import sys
import json
import math
import random
import textwrap
import argparse
from typing import Dict, Any, List, Optional, Tuple

# Configurar stdout/stderr en UTF-8 para Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# Cargar variables de entorno desde backend/.env
env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend", ".env"))
if os.path.exists(env_path):
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip("'\""))

try:
    from PIL import Image, ImageDraw, ImageFont, ImageFilter
except ImportError:
    Image = None
    ImageDraw = None
    ImageFont = None
    ImageFilter = None

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
    "access_key_id": "",
    "secret_access_key": "",
    "public_url_prefix": "https://pub-codexflow.r2.dev"
}

SERIES_FOLDER_MAP = {
    "bautismo": "bautismos",
    "matrimonio": "matrimonios",
    "defuncion": "defunciones"
}

# Catálogo determinista para poblar caligrafía realista en folios pendientes de transcripción
PENDING_NAMES_POOL = [
    ("Pedro José", "Velásquez Bermúdez", "José Antonio Velásquez", "María del Carmen Bermúdez", "Juan Bautista Alcalá y Rosa Gómez", "Andrés Bermúdez y Juana Montes", "Dr. Luis Salazar y Doña Luisa Sucre"),
    ("María de la Concepción", "Gómez Salazar", "Rafael Gómez Rivera", "Francisca Salazar Sucre", "Pedro Gómez y Ana Rivera", "Vicente Salazar y Elena Sucre", "General Manuel Morales y Doña Carmen Alcalá"),
    ("Carlos Eduardo", "Montes Caraballo", "Santiago Montes", "Petra Caraballo Serrano", "Domingo Montes y Luisa Ramos", "Antonio Caraballo y Josefa Serrano", "Lic. Ramón Sucre y Doña Isabel Gómez"),
    ("Juana Bautista", "Sucre Velásquez", "Coronel Marcos Sucre", "Teresa Velásquez Alcalá", "Antonio Sucre y Rosa Bermúdez", "Casimiro Velásquez y Carmen Alcalá", "Don Francisco Rivera y Doña Mercedes Montes"),
    ("Francisco de Paula", "Alcalá Serrano", "Manuel Alcalá Gómez", "Elena Serrano Rivera", "Francisco Alcalá y Juana Gómez", "Pedro Serrano y María Rivera", "Dr. Juan Bautista Gómez y Doña Rosa Salazar"),
    ("Rosa Margarita", "Rivera Bermúdez", " Tomás Rivera Montes", "Luisa Bermúdez Ramos", "José Rivera y Francisca Montes", "Carlos Bermúdez y Antonia Ramos", "Don Domingo Salazar y Doña Concepción Sucre"),
]


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


def _load_font(font_names: List[str], size: int):
    """Carga la primera fuente TrueType disponible en Windows/Linux o retorna la fuente por defecto."""
    if ImageFont is None:
        return None
    win_fonts_dir = "C:/Windows/Fonts"
    for name in font_names:
        candidates = [
            os.path.join(win_fonts_dir, name),
            name
        ]
        for path in candidates:
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    try:
        return ImageFont.load_default()
    except Exception:
        return None


def _build_entry_narrative(series: str, folio_num: int, entry_data: Dict[str, Any], idx: int) -> Tuple[str, List[str], str]:
    """
    Construye el texto paleográfico completo (encabezado de partida, cuerpo manuscrito y nota marginal)
    a partir de los metadatos reales del manifest (o datos históricos deterministas si está pendiente).
    """
    entry_num = entry_data.get("entry_number", idx + 1)
    meta = entry_data.get("metadata") or {}
    is_cont = entry_data.get("is_continued", False)
    is_cont_next = entry_data.get("is_continued_to_next", False)
    has_marginal = entry_data.get("has_marginal_notes", False)
    marginal_text = entry_data.get("marginal_notes_text") or ""

    pool_item = PENDING_NAMES_POOL[(folio_num + entry_num) % len(PENDING_NAMES_POOL)]
    year = 1885 + ((folio_num - 1) // 4)
    month_names = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
    month_str = month_names[(folio_num + idx) % 12]
    day_num = ((folio_num * 3 + idx * 5) % 27) + 1

    if series == "bautismo":
        bautizado = meta.get("bautizado") or f"{pool_item[0]} {pool_item[1]}"
        fecha_sac = meta.get("fecha_sacramento") or f"{day_num} de {month_str} de {year}"
        fecha_nac = meta.get("fecha_nacimiento") or f"{max(1, day_num - 8)} de {month_str} de {year}"
        lugar_nac = meta.get("lugar_nacimiento") or "Parroquia Santa Rosa de Lima de Carúpano"
        padre = meta.get("nombre_padre") or pool_item[2]
        madre = meta.get("nombre_madre") or pool_item[3]
        ab_pat = meta.get("abuelos_paternos") or pool_item[4]
        ab_mat = meta.get("abuelos_maternos") or pool_item[5]
        padrinos = meta.get("padrinos") or pool_item[6]
        ministro = meta.get("ministro") or "Pbro. Dr. Juan Bautista Carrión"

        title = f"Partida N° {entry_num} — {bautizado}"
        if is_cont:
            lines = [
                f"[Viene del folio {folio_num - 1} vuelto...] ...siendo sus abuelos paternos {ab_pat},",
                f"y los maternos {ab_mat}. Fueron sus padrinos de óleo y crisma",
                f"{padrinos}, a quienes advertí el parentesco espiritual y demás",
                f"obligaciones según el Ritual Romano. Y para que conste lo firmo en Carúpano",
                f"a {fecha_sac}. Doy fe. — {ministro}."
            ]
        elif is_cont_next:
            lines = [
                f"En la Iglesia Parroquial de Santa Rosa de Lima de Carúpano, a {fecha_sac},",
                f"yo, {ministro}, Cura Rector propio de esta feligresía, bauticé solemnemente,",
                f"puse óleo y crisma a {bautizado}, quien nació en {lugar_nac}",
                f"el día {fecha_nac}, hijo legítimo de {padre} y de {madre},",
                f"vecinos de esta parroquia... [Continúa en el folio siguiente al recto...]"
            ]
        else:
            lines = [
                f"En la Iglesia Parroquial de Santa Rosa de Lima de Carúpano, a {fecha_sac},",
                f"yo el infrascrito {ministro}, Cura y Vicario de esta doctrina,",
                f"bauticé solemnemente, puse santo óleo y crisma a {bautizado},",
                f"nacido en {lugar_nac} el día {fecha_nac}; hijo legítimo de",
                f"{padre} y de {madre}, naturales y vecinos de esta jurisdicción.",
                f"Abuelos paternos: {ab_pat}. Abuelos maternos: {ab_mat}.",
                f"Fueron sus padrinos {padrinos}, a quienes advertí el parentesco",
                f"espiritual y obligaciones. Doy fe. — {ministro}."
            ]
        if not marginal_text:
            marginal_text = f"Al margen: N° {entry_num}. {bautizado}. Legítimo."
            if has_marginal:
                marginal_text += " Nota: Contrajo matrimonio canónico en esta Parroquia el 14-Mayo-1908. Doy fe."

    elif series == "matrimonio":
        novio = meta.get("contrayente_1") or meta.get("novio") or pool_item[2]
        novia = meta.get("contrayente_2") or meta.get("novia") or f"Doña {pool_item[3]}"
        edad_1 = meta.get("edad_contrayente_1") or "27"
        edad_2 = meta.get("edad_contrayente_2") or "21"
        est_1 = meta.get("estado_civil_contrayente_1") or "Soltero"
        est_2 = meta.get("estado_civil_contrayente_2") or "Soltera"
        padres_1 = meta.get("padres_contrayente_1") or pool_item[4]
        padres_2 = meta.get("padres_contrayente_2") or pool_item[5]
        fecha_mat = meta.get("fecha_matrimonio") or meta.get("fecha_sacramento") or f"{day_num} de {month_str} de {year}"
        testigos = meta.get("testigos") or pool_item[6]
        proclamas = meta.get("proclamas") or "Leídas las tres proclamas canónicas en días festivos sin resultar impedimento"
        ministro = meta.get("ministro") or "Pbro. Dr. Juan Bautista Carrión"

        title = f"Acta Matrimonial N° {entry_num} — {novio} y {novia}"
        if is_cont:
            lines = [
                f"[Viene del folio {folio_num - 1} vuelto...] ...habiendo expresado ambos su mutuo consentimiento",
                f"por palabras de presente que hacen verdadero matrimonio según el Santo Concilio",
                f"de Trento, los uní en vínculo indisoluble y les di las bendiciones nupciales.",
                f"Fueron testigos presenciales {testigos}, vecinos de Carúpano.",
                f"En fe de lo cual lo firmo a {fecha_mat}. — {ministro}."
            ]
        else:
            lines = [
                f"En la Santa Iglesia Parroquial de Santa Rosa de Lima de Carúpano, a {fecha_mat};",
                f"{proclamas}; yo {ministro}, asistí y presencié el matrimonio que in facie",
                f"ecclesiae contrajeron {novio} ({est_1}, de {edad_1} años, hijo de {padres_1})",
                f"con {novia} ({est_2}, de {edad_2} años, hija de {padres_2}),",
                f"naturales y feligreses de esta parroquia. Habiendo recibido los Santos Sacramentos",
                f"de Penitencia y Eucaristía, fueron testigos {testigos}.",
                f"Para constancia canónica lo firmo. Doy fe. — {ministro}."
            ]
        if not marginal_text:
            marginal_text = f"Al margen: Acta N° {entry_num}. {novio} con {novia}."
            if has_marginal:
                marginal_text += " Dispensa de consanguinidad en 3° grado concedida por el Obispado."

    else:  # defuncion
        difunto = meta.get("difunto") or f"Don {pool_item[2]}"
        edad = meta.get("edad") or "62 años"
        estado = meta.get("estado_civil") or "Casado"
        conyuge = meta.get("conyuge") or pool_item[3]
        padres = meta.get("padres") or pool_item[4]
        fecha_def = meta.get("fecha_defuncion") or f"{max(1, day_num - 1)} de {month_str} de {year}"
        fecha_sac = meta.get("fecha_sacramento") or f"{day_num} de {month_str} de {year}"
        causa = meta.get("causa_muerte") or "Fiebre palúdica cerebral"
        sacramentos = meta.get("sacramentos_administrados") or "Penitencia, Sagrado Viático y Extremaunción"
        sepultura = meta.get("sepultura") or "Cementerio General de Carúpano"
        ministro = meta.get("ministro") or "Pbro. Dr. Juan Bautista Carrión"

        title = f"Partida de Defunción N° {entry_num} — {difunto}"
        if is_cont:
            lines = [
                f"[Viene del folio {folio_num - 1} vuelto...] ...habiendo recibido los santos sacramentos de",
                f"{sacramentos}. Su cadáver recibió sepultura eclesiástica en el",
                f"{sepultura} con oficio cantado y cruz alta.",
                f"Y para que conste lo firmo en Carúpano a {fecha_sac}. — {ministro}."
            ]
        else:
            lines = [
                f"En la ciudad de Carúpano, Parroquia Santa Rosa de Lima, a {fecha_sac},",
                f"yo el infrascrito {ministro}, Cura Párroco, di sepultura eclesiástica",
                f"en el {sepultura} al cadáver de {difunto},",
                f"de {edad} de edad, estado civil {estado} ({conyuge or padres}),",
                f"quien falleció el día {fecha_def} a consecuencia de {causa}.",
                f"Recibió los auxilios espirituales: {sacramentos}.",
                f"De que doy fe. — {ministro}."
            ]
        if not marginal_text:
            marginal_text = f"Al margen: N° {entry_num}. Defunción de {difunto} ({edad})."
            if has_marginal:
                marginal_text += " Testó ante el Registro Público del Distrito Bermúdez."

    return title, lines, marginal_text


def generate_paleographic_jpg_image(metadata: Dict[str, Any]):
    """
    Genera un objeto PIL.Image en modo RGB con apariencia fotográfica realista de folio
    eclesiástico del siglo XIX (papel pergamino envejecido, renglones, caligrafía ferrogálica,
    manchas de humedad en folios degradados y sello parroquial).
    """
    if Image is None:
        raise RuntimeError("Pillow (PIL) no está disponible.")

    side = metadata.get("folio_side", "recto")
    stress = metadata.get("stress_case", "standard")
    series = metadata.get("series", "bautismo")
    folio_num = int(metadata.get("folio_number", 1))
    seq_order = int(metadata.get("sequence_order", folio_num))
    canonical_name = metadata.get("canonical_filename", f"CARUPANO_{series.upper()[:3]}_T01_F{folio_num:03d}R.jpg")

    is_dp = (side == "double_page")
    width, height = (2400, 1600) if is_dp else (1500, 2000)

    rng = random.Random(f"{canonical_name}-{seq_order}")

    # 1. Color base de papel pergamino envejecido (#f4ecd8 normal, más oscuro/ocre en degraded)
    base_rgb = (244, 236, 216) if stress != "degraded" else (222, 206, 176)
    img = Image.new("RGB", (width, height), base_rgb)
    draw = ImageDraw.Draw(img, "RGBA")

    # 2. Textura de fibras de papel verjurado y sombreado perimetral (viñeteado de libro antiguo)
    # Líneas finas horizontales de papel verjurado (laid paper)
    for y in range(0, height, 6):
        delta = rng.randint(-5, 4)
        c = (
            max(0, min(255, base_rgb[0] + delta)),
            max(0, min(255, base_rgb[1] + delta - 1)),
            max(0, min(255, base_rgb[2] + delta - 2)),
            95
        )
        draw.line([(0, y), (width, y)], fill=c, width=1)

    # Bordes envejecidos / sombreado perimetral
    border_steps = 45
    for b in range(border_steps):
        alpha = int(130 * ((border_steps - b) / border_steps) ** 2)
        shade = (115, 88, 56, alpha)
        draw.rectangle([b, b, width - 1 - b, height - 1 - b], outline=shade, width=1)

    # 3. Si es degraded: manchas de humedad, aureolas de agua y oxidación ferrogálica
    if stress == "degraded":
        stain_layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        s_draw = ImageDraw.Draw(stain_layer, "RGBA")
        for _ in range(8):
            cx = rng.randint(120, width - 120)
            cy = rng.randint(150, height - 150)
            rx = rng.randint(140, 360)
            ry = rng.randint(100, 280)
            s_draw.ellipse(
                [cx - rx, cy - ry, cx + rx, cy + ry],
                fill=(165, 132, 88, rng.randint(45, 85)),
                outline=(135, 100, 60, 110),
                width=3
            )
        stain_layer = stain_layer.filter(ImageFilter.GaussianBlur(radius=18))
        img = Image.alpha_composite(img.convert("RGBA"), stain_layer).convert("RGB")
        draw = ImageDraw.Draw(img, "RGBA")

    # 4. Si es apertura de doble página (double_page): pliegue central de encuadernación
    if is_dp:
        cx = width // 2
        for dx in range(-45, 46):
            dist = abs(dx) / 45.0
            alpha = int(185 * (1.0 - dist) ** 1.6)
            draw.line([(cx + dx, 0), (cx + dx, height)], fill=(48, 32, 18, alpha), width=1)
        draw.line([(cx, 0), (cx, height)], fill=(25, 15, 8, 230), width=3)

    # 5. Tipografías
    font_header_bold = _load_font(["georgiab.ttf", "timesbd.ttf", "arialbd.ttf"], 28)
    font_header_sub = _load_font(["georgiai.ttf", "timesi.ttf", "ariali.ttf"], 22)
    font_folio_badge = _load_font(["georgiab.ttf", "timesbd.ttf"], 24)
    font_entry_title = _load_font(["georgiab.ttf", "timesbd.ttf"], 23)
    font_script = _load_font(["segoesc.ttf", "georgiai.ttf", "timesi.ttf", "georgia.ttf"], 22)
    font_marginal = _load_font(["georgiai.ttf", "timesi.ttf", "calibrii.ttf"], 17)
    font_seal = _load_font(["georgiab.ttf", "timesbd.ttf"], 15)

    # Color de tinta ferrogálica (más tenue si stress == "degraded")
    ink_dark = (42, 28, 18, 245) if stress != "degraded" else (108, 92, 74, 195)
    ink_med = (68, 48, 32, 225) if stress != "degraded" else (122, 105, 86, 180)
    rule_line_color = (195, 176, 148, 140)
    margin_line_color = (160, 110, 95, 160)

    series_display = {
        "bautismo": "BAUTISMOS",
        "matrimonio": "MATRIMONIOS",
        "defuncion": "DEFUNCIONES"
    }.get(series, series.upper())

    side_display = {
        "recto": "RECTO (R)",
        "verso": "VUELTO (V)",
        "vuelto": "VUELTO (V)",
        "double_page": "APERTURA DOBLE PÁGINA (DP)"
    }.get(side, side.upper())

    def render_page_column(x_left: int, x_right: int, page_entries: List[Dict[str, Any]], col_label: str = ""):
        col_width = x_right - x_left
        pad = 55
        inner_left = x_left + pad
        inner_right = x_right - pad

        # Encabezado Parroquial Oficial
        draw.text(
            (inner_left, 55),
            "DIÓCESIS DE CARÚPANO — PARROQUIA SANTA ROSA DE LIMA",
            fill=ink_dark,
            font=font_header_bold
        )
        sub_header = f"Serie Sacramental: Libro 1 de {series_display} (Tomo 1)   |   Folio N° {folio_num} — Cara: {col_label or side_display}"
        draw.text((inner_left, 95), sub_header, fill=ink_med, font=font_header_sub)
        draw.text((inner_right - 340, 58), f"Ref: {canonical_name}", fill=ink_med, font=font_marginal)

        # Doble línea ornamental del encabezado
        draw.line([(inner_left, 132), (inner_right, 132)], fill=ink_dark, width=3)
        draw.line([(inner_left, 138), (inner_right, 138)], fill=ink_med, width=1)

        # Margen izquierdo para notas marginales
        margin_x = inner_left + 230
        draw.line([(margin_x, 145), (margin_x, height - 90)], fill=margin_line_color, width=2)
        draw.text((inner_left + 10, 152), "MARGEN CANÓNICO", fill=ink_med, font=font_marginal)

        # Renglones tenues de pauta caligráfica
        for ry in range(185, height - 100, 42):
            draw.line([(inner_left, ry), (inner_right, ry)], fill=rule_line_color, width=1)

        # Caso especial: Folio en blanco / Auto de Visita Canónica (F015R)
        if stress == "blank":
            cy = height // 2 - 140
            box_l = margin_x + 40
            box_r = inner_right - 40
            draw.rectangle([box_l, cy - 30, box_r, cy + 260], outline=ink_med, width=2)
            draw.text(
                (box_l + 40, cy),
                "AUTO DE VISITA CANÓNICA Y CIERRE PARROQUIAL",
                fill=ink_dark,
                font=font_header_bold
            )
            auto_lines = [
                f"En la ciudad de Carúpano, a dieciocho de octubre de mil ochocientos ochenta y ocho,",
                f"practicada la Santa Visita Pastoral del Libro Primero de {series_display.capitalize()}",
                f"de esta Parroquia Santa Rosa de Lima, se hallaron las actas precedentes arregladas",
                f"a las prescripciones sinodales. Queda inutilizado el presente Folio N° {folio_num}",
                f"sin partidas sacramentales para efectos de cierre de sección.",
                f"— [FOLIO EN BLANCO / SIN PARTIDAS — VALIDACIÓN CTRL + B] —"
            ]
            ay = cy + 50
            for al in auto_lines:
                draw.text((box_l + 40, ay), al, fill=ink_dark, font=font_script)
                ay += 34
            return

        # Dibujar cada partida sacramental del folio
        curr_y = 175
        if not page_entries:
            page_entries = [{"entry_number": 1, "status": "pending", "metadata": {}}]

        for idx, entry in enumerate(page_entries):
            title, body_lines, marginal_note = _build_entry_narrative(series, folio_num, entry, idx)

            # Nota marginal en la columna izquierda
            marg_wrapped = textwrap.wrap(marginal_note, width=22)
            my = curr_y + 8
            for ml in marg_wrapped[:10]:
                draw.text((inner_left + 8, my), ml, fill=ink_med, font=font_marginal)
                my += 24

            # Título de la partida
            text_x = margin_x + 25
            draw.text((text_x, curr_y), title, fill=ink_dark, font=font_entry_title)
            curr_y += 42

            # Líneas manuscritas del cuerpo
            max_chars = 68 if not is_dp else 54
            for b_line in body_lines:
                wrapped_sub = textwrap.wrap(b_line, width=max_chars)
                for w_line in wrapped_sub:
                    jx = rng.randint(-2, 2)
                    jy = rng.randint(-1, 1)
                    draw.text((text_x + jx, curr_y + jy), w_line, fill=ink_dark, font=font_script)

                    # Si el folio es 'doubtful' (mutilado/manchado para probar Ctrl+U), aplicar borrón de tinta sobre una línea intermedia
                    if stress == "doubtful" and 480 <= curr_y <= 580:
                        blot_x = text_x + 180
                        draw.ellipse([blot_x, curr_y - 6, blot_x + 250, curr_y + 32], fill=(38, 25, 15, 225))
                        draw.text((blot_x + 265, curr_y), "[...mancha / roto ilegible Ctrl+U...]", fill=ink_med, font=font_marginal)

                    curr_y += 42

            # Rúbrica / firma parroquial al pie de la partida
            curr_y += 10
            sig_x = inner_right - 380
            draw.text((sig_x, curr_y), "Pbro. Dr. Juan Bautista Carrión (Rúbrica)", fill=ink_med, font=font_script)
            draw.arc([sig_x + 20, curr_y + 22, sig_x + 240, curr_y + 52], start=0, end=180, fill=ink_dark, width=2)
            curr_y += 75

            # Separador entre partidas
            if idx < len(page_entries) - 1:
                mid_x = (text_x + inner_right) // 2
                draw.line([(mid_x - 140, curr_y - 20), (mid_x + 140, curr_y - 20)], fill=ink_med, width=2)
                curr_y += 18

        # Sello parroquial circular al pie de página
        seal_cx = inner_right - 130
        seal_cy = height - 150
        draw.ellipse([seal_cx - 75, seal_cy - 75, seal_cx + 75, seal_cy + 75], outline=(90, 52, 42, 185), width=3)
        draw.ellipse([seal_cx - 63, seal_cy - 63, seal_cx + 63, seal_cy + 63], outline=(90, 52, 42, 150), width=1)
        draw.text((seal_cx - 48, seal_cy - 36), "DIÓCESIS DE", fill=(90, 52, 42, 190), font=font_seal)
        draw.text((seal_cx - 44, seal_cy - 16), "CARÚPANO", fill=(90, 52, 42, 190), font=font_seal)
        draw.text((seal_cx - 52, seal_cy + 8), "PARROQUIA", fill=(90, 52, 42, 190), font=font_seal)
        draw.text((seal_cx - 52, seal_cy + 26), "SANTA ROSA", fill=(90, 52, 42, 190), font=font_seal)

    entries = metadata.get("entries") or []
    if is_dp:
        left_entries = [e for e in entries if e.get("page_region") == "left_page"] or entries[:1]
        right_entries = [e for e in entries if e.get("page_region") == "right_page"] or entries[1:]
        render_page_column(0, width // 2 - 20, left_entries, "VERSO (Página Izquierda)")
        render_page_column(width // 2 + 20, width, right_entries, "RECTO (Página Derecha)")
    else:
        render_page_column(0, width, entries)

    return img


def generate_paleographic_folio_file(metadata: Dict[str, Any], output_path_base: str) -> str:
    """
    Genera el archivo fotográfico .jpg real de alta resolución (quality=88) y retorna su ruta absoluta.
    """
    jpg_path = os.path.splitext(output_path_base)[0] + ".jpg"
    os.makedirs(os.path.dirname(jpg_path), exist_ok=True)
    img = generate_paleographic_jpg_image(metadata)
    img.save(jpg_path, format="JPEG", quality=88, optimize=True)
    return jpg_path


def generate_all_local_images(manifest: Dict[str, Any], target_dir: str) -> List[str]:
    """Genera las 60 imágenes .jpg paleográficas en el directorio local."""
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
        jpg_file = generate_paleographic_folio_file(folio, filepath_base)
        generated.append(jpg_file)

    return generated


def purge_r2_legacy_objects(s3_client, bucket_name: str, tenant_id: str, valid_canonical_keys: Optional[set] = None) -> Dict[str, int]:
    """
    Tarea M1-01:
    1. Lista y elimina todos los archivos viejos de prueba en `{tenant_id}/` que no pertenezcan al corpus canónico (o todos antes de subir).
    2. Lista y elimina todos los objetos dentro de `corpus/` para que la carpeta huérfana desaparezca por completo.
    3. Respeta estrictamente otros tenants (`df5018a9-ae76-406d-9505-e62d1b4c9157/`) y `_system/`.
    """
    deleted_tenant_legacy = 0
    deleted_corpus_folder = 0

    # 1. Purgar objetos viejos en 4bf4e846-b22d-4105-aacf-3751cc0de60c/
    tenant_prefix = f"{tenant_id}/"
    resp_tenant = s3_client.list_objects_v2(Bucket=bucket_name, Prefix=tenant_prefix)
    tenant_contents = resp_tenant.get("Contents", [])
    keys_to_delete_tenant = []
    for obj in tenant_contents:
        k = obj["Key"]
        if valid_canonical_keys is None or k not in valid_canonical_keys:
            keys_to_delete_tenant.append({"Key": k})

    if keys_to_delete_tenant:
        print(f"[R2 Purge] Eliminando {len(keys_to_delete_tenant)} objetos obsoletos en '{tenant_prefix}':")
        for item in keys_to_delete_tenant:
            print(f"   - {item['Key']}")
        s3_client.delete_objects(Bucket=bucket_name, Delete={"Objects": keys_to_delete_tenant})
        deleted_tenant_legacy = len(keys_to_delete_tenant)

    # 2. Purgar por completo la carpeta huérfana corpus/
    paginator = s3_client.get_paginator("list_objects_v2")
    corpus_keys = []
    for page in paginator.paginate(Bucket=bucket_name, Prefix="corpus/"):
        for obj in page.get("Contents", []):
            corpus_keys.append({"Key": obj["Key"]})

    if corpus_keys:
        print(f"[R2 Purge] Eliminando {len(corpus_keys)} objetos mal ubicados en 'corpus/'...")
        # delete_objects soporta hasta 1000 por llamada
        for i in range(0, len(corpus_keys), 1000):
            batch = corpus_keys[i:i + 1000]
            s3_client.delete_objects(Bucket=bucket_name, Delete={"Objects": batch})
        deleted_corpus_folder = len(corpus_keys)

    return {
        "deleted_tenant_legacy": deleted_tenant_legacy,
        "deleted_corpus_folder": deleted_corpus_folder
    }


def upload_folio_image(s3_client, file_path: str, bucket_name: str, object_key: str):
    """Sube un archivo de imagen .jpg a S3/R2 con ContentType image/jpeg y cache headers."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Archivo de imagen no encontrado: {file_path}")

    extra_args = {
        "ContentType": "image/jpeg",
        "CacheControl": "public, max-age=31536000, immutable"
    }

    s3_client.upload_file(file_path, bucket_name, object_key, ExtraArgs=extra_args)


def resolve_manifest_urls(manifest: Dict[str, Any], public_url_prefix: str, tenant_id: str = DEFAULT_TENANT_ID) -> Dict[str, Any]:
    """
    Actualiza remote_image_url y r2_url en corpus_manifest.json usando siempre el prefijo Multi-Tenant:
    4bf4e846-b22d-4105-aacf-3751cc0de60c/{canonical_filename}
    """
    prefix = public_url_prefix.rstrip("/")
    for folio in manifest.get("folios", []):
        canonical_name = folio.get("canonical_filename", "")
        base_name = os.path.splitext(canonical_name)[0]
        jpg_filename = f"{base_name}.jpg"
        folio["canonical_filename"] = jpg_filename
        r2_key = f"{tenant_id}/{jpg_filename}"
        folio["r2_url"] = r2_key
        folio["remote_image_url"] = f"{prefix}/{r2_key}"
    return manifest


def update_supabase_folios(manifest: Dict[str, Any], tenant_id: str = DEFAULT_TENANT_ID) -> int:
    """
    Tarea M1-03:
    Actualiza la columna r2_url en la tabla folios de Supabase para los 60 folios del tenant
    para que apunten exactamente a `4bf4e846-b22d-4105-aacf-3751cc0de60c/{canonical_filename}`.
    """
    supabase = get_supabase_client()
    if not supabase:
        print("[Aviso] Cliente de Supabase no disponible o credenciales incompletas.")
        return 0

    folios = manifest.get("folios", [])
    updated_count = 0

    for folio in folios:
        canonical_name = folio.get("canonical_filename", "")
        base_name = os.path.splitext(canonical_name)[0]
        jpg_filename = f"{base_name}.jpg"
        svg_filename = f"{base_name}.svg"
        r2_key = f"{tenant_id}/{jpg_filename}"

        try:
            res = (
                supabase.table("folios")
                .update({
                    "r2_url": r2_key,
                    "canonical_filename": jpg_filename
                })
                .eq("tenant_id", tenant_id)
                .or_(f"canonical_filename.eq.{jpg_filename},canonical_filename.eq.{svg_filename},original_filename.eq.{jpg_filename}")
                .execute()
            )
            if res.data and len(res.data) > 0:
                updated_count += len(res.data)
        except Exception as e:
            print(f"[Aviso] Error actualizando Supabase para {jpg_filename}: {e}")

    print(f"[Supabase] Se actualizaron r2_url para {updated_count} folios del tenant {tenant_id}.")
    return updated_count


def sync_corpus_to_r2(
    manifest_path: str,
    images_dir: Optional[str] = None,
    dry_run: bool = False,
    tenant_id: str = DEFAULT_TENANT_ID
) -> Dict[str, Any]:
    """
    Orquesta la purga de archivos basura en R2, generación de 60 imágenes .jpg reales,
    subida bajo `{tenant_id}/{canonical_filename}` y sincronización de `folios.r2_url` en Supabase.
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

    print(f"-> Generando 60 imágenes paleográficas fotográficas (.jpg reales) en {images_dir}...")
    generated_files = generate_all_local_images(manifest, images_dir)
    print(f"-> Generadas {len(generated_files)} imágenes .jpg locales.")

    s3_client = None
    if not dry_run and has_valid_creds:
        s3_client = create_s3_client(cfg)
        print(f"-> Conexión a Cloudflare R2 inicializada (bucket: '{bucket}')")

    # Definir el conjunto exacto de las 60 claves canónicas válidas
    valid_keys = set()
    for folio in manifest.get("folios", []):
        cname = folio.get("canonical_filename", "")
        bname = os.path.splitext(cname)[0]
        valid_keys.add(f"{tenant_id}/{bname}.jpg")

    purge_stats = {"deleted_tenant_legacy": 0, "deleted_corpus_folder": 0}
    if not dry_run and s3_client is not None:
        purge_stats = purge_r2_legacy_objects(s3_client, bucket, tenant_id, valid_canonical_keys=valid_keys)

    synced_items = []
    uploaded_count = 0
    for folio in manifest.get("folios", []):
        series = folio.get("series", "bautismo")
        folder = SERIES_FOLDER_MAP.get(series, series)
        canonical_name = folio.get("canonical_filename", "")
        base_name = os.path.splitext(canonical_name)[0]
        jpg_filename = f"{base_name}.jpg"
        local_jpg_path = os.path.join(images_dir, folder, jpg_filename)
        s3_key = f"{tenant_id}/{jpg_filename}"

        if not dry_run and s3_client is not None:
            upload_folio_image(s3_client, local_jpg_path, bucket, s3_key)
            uploaded_count += 1
            if uploaded_count % 10 == 0 or uploaded_count == len(manifest.get("folios", [])):
                print(f"   Subidos a R2: {uploaded_count}/{len(manifest.get('folios', []))}...")

        synced_items.append({
            "filename": jpg_filename,
            "s3_key": s3_key,
            "url": f"{public_prefix}/{s3_key}"
        })

    print(f"-> Subidos a R2: {uploaded_count}/{len(synced_items)} folios .jpg en '{tenant_id}/'.")

    # Actualizar manifiesto con el prefijo del tenant
    manifest = resolve_manifest_urls(manifest, public_prefix, tenant_id=tenant_id)
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
        "purge_stats": purge_stats,
        "uploaded_count": uploaded_count,
        "supabase_updated": supabase_updated,
        "synced": synced_items,
        "manifest_path": manifest_path
    }


def main():
    parser = argparse.ArgumentParser(description="Upload and sync paleographic JPG corpus to Cloudflare R2 and Supabase")
    parser.add_argument("--manifest", default=os.path.join(os.path.dirname(__file__), "corpus_manifest.json"),
                        help="Ruta al corpus_manifest.json")
    parser.add_argument("--images-dir", default=os.path.join(os.path.dirname(__file__), "corpus"),
                        help="Directorio local para almacenar las imágenes .jpg")
    parser.add_argument("--tenant-id", default=DEFAULT_TENANT_ID,
                        help="ID del tenant en R2 y Supabase")
    parser.add_argument("--dry-run", action="store_true",
                        help="Genera las imágenes y actualiza el manifiesto sin subir a S3/R2 ni Supabase")
    args = parser.parse_args()

    print("=== Iniciando Pipeline M1 de Imágenes Paleográficas JPG (R2 + Supabase) ===")
    result = sync_corpus_to_r2(args.manifest, args.images_dir, dry_run=args.dry_run, tenant_id=args.tenant_id)
    print(
        f"Completado exitosamente. Sincronizados {len(result['synced'])} folios JPG. "
        f"Subidos a R2: {result['uploaded_count']}, Supabase actualizados: {result['supabase_updated']}."
    )


if __name__ == "__main__":
    main()
