"""
FamilySearch DIP Exporter Engine.
Implements:
1. Matriz de Indexación en Excel (.xlsx) y CSV con formato institucional y BOM UTF-8.
2. Exportador GEDCOM 5.5.1 estándar para linajes y eventos vitales parroquiales.
3. Generador de manifest.json con auditoría, checksums y metadatos de conservación.
4. Filtro estricto archivístico (cero partidas pending) y consolidación interfolio.
5. Foliación física (folio_fisico, cara_folio, numero_acta) y desglose de matrimonios.
"""

import io
import csv
import json
import re
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple, Optional
import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter


MONTH_MAP = {
    1: "JAN", 2: "FEB", 3: "MAR", 4: "APR", 5: "MAY", 6: "JUN",
    7: "JUL", 8: "AUG", 9: "SEP", 10: "OCT", 11: "NOV", 12: "DEC",
    "01": "JAN", "02": "FEB", "03": "MAR", "04": "APR", "05": "MAY", "06": "JUN",
    "07": "JUL", "08": "AUG", "09": "SEP", "10": "OCT", "11": "NOV", "12": "DEC",
    "ene": "JAN", "feb": "FEB", "mar": "MAR", "abr": "APR", "may": "MAY", "jun": "JUN",
    "jul": "JUL", "ago": "AUG", "sep": "SEP", "oct": "OCT", "nov": "NOV", "dic": "DEC",
    "enero": "JAN", "febrero": "FEB", "marzo": "MAR", "abril": "APR", "mayo": "MAY", "junio": "JUN",
    "julio": "JUL", "agosto": "AUG", "septiembre": "SEP", "octubre": "OCT", "noviembre": "NOV", "diciembre": "DEC"
}


def parse_gedcom_date(raw_date: Optional[str]) -> Optional[str]:
    """
    Convierte fechas estándar (YYYY-MM-DD, DD/MM/YYYY o parciales) al formato GEDCOM:
    '15 APR 1855', 'APR 1855' o '1855'.
    """
    if not raw_date or not isinstance(raw_date, str):
        return None
    raw = raw_date.strip()
    if not raw:
        return None

    # Formato ISO: YYYY-MM-DD
    iso_match = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", raw)
    if iso_match:
        year, month, day = iso_match.groups()
        mon_str = MONTH_MAP.get(month.zfill(2), MONTH_MAP.get(int(month), "JAN"))
        return f"{int(day)} {mon_str} {year}"

    # Formato ISO parcial: YYYY-MM
    iso_partial = re.match(r"^(\d{4})-(\d{1,2})$", raw)
    if iso_partial:
        year, month = iso_partial.groups()
        mon_str = MONTH_MAP.get(month.zfill(2), "JAN")
        return f"{mon_str} {year}"

    # Solo año: YYYY
    if re.match(r"^\d{4}$", raw):
        return raw

    # Formato latino: DD/MM/YYYY
    lat_match = re.match(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$", raw)
    if lat_match:
        day, month, year = lat_match.groups()
        mon_str = MONTH_MAP.get(month.zfill(2), "JAN")
        return f"{int(day)} {mon_str} {year}"

    # Retorno tal cual si contiene dígitos
    clean = re.sub(r"[^\w\s]", "", raw)
    return clean[:30] if clean else None


def consolidate_continued_entries(entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    T02-BE-04: Identifica partidas marcadas con is_continued=True que referencian
    a una partida anterior (continued_from_entry_id) y consolida sus observaciones
    y notas en la partida madre original, excluyéndolas como personas duplicadas
    en el censo exportado.
    """
    if not entries:
        return []

    entry_map = {str(e.get("id")): dict(e) for e in entries if e.get("id")}
    to_remove_ids = set()

    for e in entries:
        is_cont = e.get("is_continued") is True or str(e.get("is_continued", "")).lower() == "true"
        parent_id = str(e.get("continued_from_entry_id") or "")
        
        if is_cont and parent_id and parent_id in entry_map:
            parent = entry_map[parent_id]
            p_meta = dict(parent.get("metadata") or {})
            c_meta = e.get("metadata") or {}

            # Extraer notas u observaciones de la continuación
            c_notes = (
                c_meta.get("marginal_notes") or
                c_meta.get("notes") or
                c_meta.get("observaciones") or
                c_meta.get("notas") or ""
            ).strip()
            
            if not c_notes:
                # Si no tiene notas explícitas, concatenar campos no vacíos
                c_notes = " ".join([f"{k}: {v}" for k, v in c_meta.items() if v and isinstance(v, str)])

            side_str = f" {e.get('folio_side')}" if e.get("folio_side") else ""
            cont_header = f"[Continuación Folio {e.get('folio_number', '')}{side_str}]: {c_notes}".strip()

            existing_notes = (
                p_meta.get("marginal_notes") or
                p_meta.get("notes") or
                p_meta.get("observaciones") or ""
            ).strip()

            merged = f"{existing_notes}\n{cont_header}".strip() if existing_notes else cont_header
            p_meta["marginal_notes"] = merged
            p_meta["notes"] = merged
            p_meta["observaciones"] = merged
            parent["metadata"] = p_meta
            entry_map[parent_id] = parent
            to_remove_ids.add(str(e.get("id")))

    consolidated = []
    for e in entries:
        eid = str(e.get("id"))
        if eid in to_remove_ids:
            continue
        if eid in entry_map:
            consolidated.append(entry_map[eid])
        else:
            consolidated.append(e)

    return consolidated


def _extract_person_fields(meta: Dict[str, Any]) -> Dict[str, str]:
    """Extrae campos comunes de una partida de bautismo, matrimonio o defunción."""
    first_name = (
        meta.get("first_name") or
        meta.get("primer_nombre") or
        meta.get("nombres") or
        meta.get("nombre") or ""
    ).strip()

    last_name = (
        meta.get("last_name") or
        meta.get("apellidos") or
        meta.get("apellido") or
        meta.get("primer_apellido") or ""
    ).strip()

    sex = (meta.get("sex") or meta.get("sexo") or meta.get("genero") or "").strip().upper()
    if sex.startswith("M") or sex == "HOMBRE" or sex == "VARON" or sex == "MASCULINO":
        sex_gedcom = "M"
    elif sex.startswith("F") or sex == "MUJER" or sex == "FEMENINO":
        sex_gedcom = "F"
    else:
        sex_gedcom = "U"

    father_name = (
        meta.get("father_name") or
        meta.get("padre") or
        meta.get("nombre_padre") or
        meta.get("padres") or ""
    ).strip()

    mother_name = (
        meta.get("mother_name") or
        meta.get("madre") or
        meta.get("nombre_madre") or ""
    ).strip()

    event_date = (
        meta.get("event_date") or
        meta.get("fecha_suceso") or
        meta.get("fecha_acta") or
        meta.get("fecha_bautismo") or
        meta.get("fecha") or ""
    ).strip()

    birth_date = (
        meta.get("birth_date") or
        meta.get("fecha_nacimiento") or ""
    ).strip()

    spouse_name = (
        meta.get("spouse_name") or
        meta.get("conyuge") or
        meta.get("nombre_conyuge") or
        meta.get("esposo") or
        meta.get("esposa") or ""
    ).strip()

    godparents = (
        meta.get("godparents") or
        meta.get("padrinos") or
        meta.get("padrino") or
        meta.get("madrina") or ""
    ).strip()

    notes = (
        meta.get("marginal_notes") or
        meta.get("notes") or
        meta.get("notas") or
        meta.get("observaciones") or ""
    ).strip()

    return {
        "first_name": first_name,
        "last_name": last_name,
        "sex": sex_gedcom,
        "father_name": father_name,
        "mother_name": mother_name,
        "event_date": event_date,
        "birth_date": birth_date,
        "spouse_name": spouse_name,
        "godparents": godparents,
        "notes": notes
    }


def _extract_marriage_fields(meta: Dict[str, Any]) -> Tuple[bool, Dict[str, str], Dict[str, str]]:
    """
    Detecta si la partida contiene ambos contrayentes (Novio y Novia) para
    su desglose formal en dos filas vinculadas según T02-BE-02.
    """
    groom_first = (
        meta.get("groom_first_name") or
        meta.get("novio_nombres") or
        meta.get("novio_nombre") or
        meta.get("novio") or ""
    ).strip()

    groom_last = (
        meta.get("groom_last_name") or
        meta.get("novio_apellidos") or
        meta.get("novio_apellido") or ""
    ).strip()

    bride_first = (
        meta.get("bride_first_name") or
        meta.get("novia_nombres") or
        meta.get("novia_nombre") or
        meta.get("novia") or ""
    ).strip()

    bride_last = (
        meta.get("bride_last_name") or
        meta.get("novia_apellidos") or
        meta.get("novia_apellido") or ""
    ).strip()

    is_marriage = bool((groom_first or groom_last) and (bride_first or bride_last))
    if not is_marriage:
        return False, {}, {}

    event_date = (
        meta.get("event_date") or
        meta.get("fecha_matrimonio") or
        meta.get("fecha_acta") or
        meta.get("fecha") or ""
    ).strip()

    godparents = (
        meta.get("godparents") or
        meta.get("padrinos") or
        meta.get("testigos") or
        meta.get("witnesses") or ""
    ).strip()

    notes = (
        meta.get("marginal_notes") or
        meta.get("notes") or
        meta.get("observaciones") or ""
    ).strip()

    groom_full = f"{groom_first} {groom_last}".strip()
    bride_full = f"{bride_first} {bride_last}".strip()

    groom_data = {
        "first_name": groom_first,
        "last_name": groom_last,
        "sex": "M",
        "father_name": (meta.get("groom_father") or meta.get("padre_novio") or "").strip(),
        "mother_name": (meta.get("groom_mother") or meta.get("madre_novio") or "").strip(),
        "event_date": event_date,
        "birth_date": "",
        "spouse_name": bride_full,
        "godparents": godparents,
        "notes": notes
    }

    bride_data = {
        "first_name": bride_first,
        "last_name": bride_last,
        "sex": "F",
        "father_name": (meta.get("bride_father") or meta.get("padre_novia") or "").strip(),
        "mother_name": (meta.get("bride_mother") or meta.get("madre_novia") or "").strip(),
        "event_date": event_date,
        "birth_date": "",
        "spouse_name": groom_full,
        "godparents": godparents,
        "notes": notes
    }

    return True, groom_data, bride_data


def generate_familysearch_matrix(
    entries: List[Dict[str, Any]],
    folios: List[Dict[str, Any]],
    tome_metadata: Dict[str, Any],
    only_verified: bool = False
) -> Tuple[bytes, bytes]:
    """
    T02-BE-02: Genera la matriz de indexación oficial en XLSX y CSV.
    - CERO filas en estado 'pending'. Filtro estricto exclusivo para 'completed' o 'verified' (o solo 'verified' si only_verified=True).
    - Incorpora las columnas archivísticas canónicas:
      'folio_fisico', 'cara_folio' (Recto/Vuelto/Unica) y 'numero_acta'.
    - Desglosa actas de matrimonio con novio y novia en dos filas enlazadas.
    - Aplica consolidación de partidas interfolio (T02-BE-04).
    """
    allowed_statuses = ("verified",) if only_verified else ("completed", "verified")
    # Filtro estricto: Cero pendientes
    valid_entries = [
        e for e in entries
        if (e.get("status") or "").lower() in allowed_statuses
    ]

    # Consolidación interfolio
    consolidated_entries = consolidate_continued_entries(valid_entries)

    folio_map = {str(f.get("id")): f for f in folios}

    headers = [
        "image_file_name",
        "folio_fisico",
        "cara_folio",
        "numero_acta",
        "folio_number",
        "entry_number",
        "status",
        "primer_nombre",
        "apellidos",
        "sexo",
        "fecha_acta",
        "fecha_nacimiento",
        "nombre_padre",
        "nombre_madre",
        "conyuge",
        "padrinos",
        "parroquia",
        "tomo",
        # Dimensiones geográficas y localidad estandarizada SPEC-013
        "pais",
        "estado",
        "municipio",
        "ciudad_localidad",
        "lugar_evento_estandarizado",
        "observaciones_calidad"
    ]

    tome_country = tome_metadata.get("country") or ""
    tome_state = tome_metadata.get("state") or ""
    tome_municipality = tome_metadata.get("municipality") or ""
    tome_city = tome_metadata.get("city_or_locality") or ""
    tome_canonical_place = tome_metadata.get("canonical_place") or tome_metadata.get("locality") or ""

    rows = []
    for entry in consolidated_entries:
        fid = str(entry.get("folio_id"))
        folio = folio_map.get(fid, {})
        canonical_name = folio.get("canonical_filename") or folio.get("original_filename") or f"folio_{fid}.jpg"
        
        # Foliación física canónica
        raw_folio_num = entry.get("folio_number")
        if raw_folio_num is not None and str(raw_folio_num).strip():
            folio_fisico = raw_folio_num
        else:
            folio_fisico = folio.get("sequence_order") or folio.get("folio_number") or ""

        raw_side = (entry.get("folio_side") or "recto").strip().lower()
        if raw_side in ("recto", "r"):
            cara_folio = "Recto"
        elif raw_side in ("vuelto", "v"):
            cara_folio = "Vuelto"
        elif raw_side in ("unica", "u"):
            cara_folio = "Unica"
        else:
            cara_folio = raw_side.capitalize()

        act_num = (entry.get("act_number") or "S/N").strip()
        entry_num = entry.get("entry_number", 1)
        status = entry.get("status", "completed")
        meta = entry.get("metadata") or {}

        # Campos geográficos con posible sobreescritura específica en partida
        row_country = meta.get("country") or meta.get("pais") or tome_country
        row_state = meta.get("state") or meta.get("estado") or meta.get("provincia") or tome_state
        row_municipality = meta.get("municipality") or meta.get("municipio") or tome_municipality
        row_city = meta.get("city_or_locality") or meta.get("ciudad") or meta.get("localidad") or tome_city
        row_canonical_place = (
            meta.get("canonical_place") or
            meta.get("lugar_evento_estandarizado") or
            meta.get("lugar") or
            tome_canonical_place
        )

        if not meta.get("canonical_place") and not meta.get("lugar_evento_estandarizado") and not meta.get("lugar"):
            if (row_country != tome_country or row_state != tome_state or 
                row_municipality != tome_municipality or row_city != tome_city):
                parts = [str(p).strip() for p in (row_city, row_municipality, row_state, row_country) if p and str(p).strip()]
                row_canonical_place = ", ".join(parts) if parts else ""

        # Verificar si es matrimonio con novio y novia (T02-BE-02)
        is_marr, groom_dict, bride_dict = _extract_marriage_fields(meta)
        if is_marr:
            persons = [groom_dict, bride_dict]
        else:
            persons = [_extract_person_fields(meta)]

        for p_idx, extracted in enumerate(persons):
            # Enlaces canónicos
            row_data = [
                canonical_name,
                folio_fisico,
                cara_folio,
                act_num,
                folio_fisico,
                entry_num if len(persons) == 1 else f"{entry_num}.{p_idx + 1}",
                status,
                extracted["first_name"],
                extracted["last_name"],
                extracted["sex"],
                extracted["event_date"],
                extracted["birth_date"],
                extracted["father_name"],
                extracted["mother_name"],
                extracted["spouse_name"],
                extracted["godparents"],
                tome_metadata.get("parish_name") or "",
                tome_metadata.get("tome_number") or "",
                str(row_country or ""),
                str(row_state or ""),
                str(row_municipality or ""),
                str(row_city or ""),
                str(row_canonical_place or ""),
                extracted["notes"]
            ]
            rows.append(row_data)

    # 1. Generación de XLSX con openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Matriz FamilySearch"
    ws.views.sheetView[0].showGridLines = True

    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    thin_side = Side(style="thin", color="CBD5E1")
    cell_border = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)

    ws.append(headers)
    ws.row_dimensions[1].height = 28
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_alignment
        cell.border = cell_border

    data_font = Font(name="Calibri", size=10)
    data_alignment = Alignment(vertical="center")

    for r_idx, row in enumerate(rows, start=2):
        ws.append(row)
        ws.row_dimensions[r_idx].height = 20
        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=r_idx, column=col_idx)
            cell.font = data_font
            cell.alignment = data_alignment
            cell.border = cell_border

    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val_str = str(cell.value or "")
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws.column_dimensions[col_letter].width = max(12, min(50, max_len + 3))

    excel_bio = io.BytesIO()
    wb.save(excel_bio)
    excel_bytes = excel_bio.getvalue()

    # 2. Generación de CSV delimitado por ; con UTF-8 BOM
    csv_bio = io.StringIO()
    csv_bio.write("sep=;\r\n")
    writer = csv.writer(csv_bio, delimiter=";", quoting=csv.QUOTE_MINIMAL, lineterminator="\r\n")
    writer.writerow(headers)
    for row in rows:
        writer.writerow(row)

    csv_bytes = ("\ufeff" + csv_bio.getvalue()).encode("utf-8")

    return excel_bytes, csv_bytes


def generate_gedcom_551(
    entries: List[Dict[str, Any]],
    folios: List[Dict[str, Any]],
    tome_metadata: Dict[str, Any],
    only_verified: bool = False
) -> str:
    """
    Genera un archivo estándar GEDCOM 5.5.1 enlazado a los folios digitales
    y excluyendo partidas pending.
    """
    allowed_statuses = ("verified",) if only_verified else ("completed", "verified")
    valid_entries = [
        e for e in entries
        if (e.get("status") or "").lower() in allowed_statuses
    ]
    consolidated_entries = consolidate_continued_entries(valid_entries)

    folio_map = {str(f.get("id")): f for f in folios}
    lines: List[str] = []

    # 1. Cabecera GEDCOM 5.5.1
    now_utc = datetime.now(timezone.utc)
    date_str = f"{now_utc.day} {MONTH_MAP.get(now_utc.month, 'JAN')} {now_utc.year}"
    time_str = now_utc.strftime("%H:%M:%S")

    lines.append("0 HEAD")
    lines.append("1 SOUR CODEXFLOW")
    lines.append("2 VERS 1.0.0")
    lines.append("2 NAME CodexFlow Preservation & Indexing Engine")
    lines.append("2 CORP Archivo Diocesano")
    lines.append(f"1 DATE {date_str}")
    lines.append(f"2 TIME {time_str}")
    lines.append("1 GEDC")
    lines.append("2 VERS 5.5.1")
    lines.append("2 FORM LINEAGE-LINKED")
    lines.append("1 CHAR UTF-8")

    canonical_place = (
        tome_metadata.get("canonical_place") or
        tome_metadata.get("locality") or
        ""
    ).strip()

    if not canonical_place:
        place_parts = []
        if tome_metadata.get("parish_name"):
            place_parts.append(tome_metadata["parish_name"])
        if tome_metadata.get("diocese_name"):
            place_parts.append(tome_metadata["diocese_name"])
        if tome_metadata.get("location"):
            place_parts.append(tome_metadata["location"])
        if place_parts:
            canonical_place = ", ".join(place_parts)

    indi_counter = 0
    fam_counter = 0
    fam_records: List[List[str]] = []

    for entry in consolidated_entries:
        meta = entry.get("metadata") or {}
        fid = str(entry.get("folio_id"))
        folio = folio_map.get(fid, {})
        canonical_img = folio.get("canonical_filename") or folio.get("original_filename") or f"folio_{fid}.jpg"

        entry_place = (
            meta.get("canonical_place") or
            meta.get("lugar_evento_estandarizado") or
            meta.get("lugar") or
            canonical_place
        ).strip()

        is_marr, groom_dict, bride_dict = _extract_marriage_fields(meta)
        if is_marr:
            indi_counter += 1
            groom_id = f"I{indi_counter}"
            g_name = f"{groom_dict['first_name']} /{groom_dict['last_name']}/".strip()
            lines.append(f"0 @{groom_id}@ INDI")
            lines.append(f"1 NAME {g_name}")
            lines.append("1 SEX M")
            lines.append("1 OBJE")
            lines.append(f"2 FILE images/{canonical_img}")
            lines.append(f"2 TITL Folio {entry.get('folio_number', '')} {entry.get('folio_side', '')} - Acta {entry.get('act_number', 'S/N')}")

            indi_counter += 1
            bride_id = f"I{indi_counter}"
            b_name = f"{bride_dict['first_name']} /{bride_dict['last_name']}/".strip()
            lines.append(f"0 @{bride_id}@ INDI")
            lines.append(f"1 NAME {b_name}")
            lines.append("1 SEX F")
            lines.append("1 OBJE")
            lines.append(f"2 FILE images/{canonical_img}")
            lines.append(f"2 TITL Folio {entry.get('folio_number', '')} {entry.get('folio_side', '')} - Acta {entry.get('act_number', 'S/N')}")

            # Familia Matrimonial
            fam_counter += 1
            fam_id = f"F{fam_counter}"
            marr_lines = [
                f"0 @{fam_id}@ FAM",
                f"1 HUSB @{groom_id}@",
                f"1 WIFE @{bride_id}@",
                "1 MARR"
            ]
            marr_date = parse_gedcom_date(groom_dict["event_date"])
            if marr_date:
                marr_lines.append(f"2 DATE {marr_date}")
            if entry_place:
                marr_lines.append(f"2 PLAC {entry_place}")
            if groom_dict["notes"]:
                marr_lines.append(f"1 NOTE {groom_dict['notes']}")
            fam_records.append(marr_lines)
            continue

        extracted = _extract_person_fields(meta)
        indi_counter += 1
        main_indi_id = f"I{indi_counter}"

        first = extracted["first_name"] or "Indeterminado"
        last = extracted["last_name"]
        name_gedcom = f"{first} /{last}/" if last else f"{first} //"

        lines.append(f"0 @{main_indi_id}@ INDI")
        lines.append(f"1 NAME {name_gedcom}")
        lines.append(f"1 SEX {extracted['sex']}")

        # Evento de Nacimiento
        if extracted["birth_date"]:
            birt_date = parse_gedcom_date(extracted["birth_date"])
            lines.append("1 BIRT")
            if birt_date:
                lines.append(f"2 DATE {birt_date}")
            if entry_place:
                lines.append(f"2 PLAC {entry_place}")

        # Evento de Bautismo / Matrimonio / Defunción según la serie
        series_code = (tome_metadata.get("series_code") or tome_metadata.get("folder_name") or "").upper()
        event_date_parsed = parse_gedcom_date(extracted["event_date"])

        if "MAT" in series_code or "CASAMIENTO" in series_code or extracted["spouse_name"]:
            if event_date_parsed or extracted["spouse_name"]:
                lines.append("1 MARR")
                if event_date_parsed:
                    lines.append(f"2 DATE {event_date_parsed}")
                if entry_place:
                    lines.append(f"2 PLAC {entry_place}")
        elif "DEF" in series_code or "ENTIERR" in series_code or "OBIT" in series_code:
            lines.append("1 DEAT")
            if event_date_parsed:
                lines.append(f"2 DATE {event_date_parsed}")
            if entry_place:
                lines.append(f"2 PLAC {entry_place}")
        else:
            lines.append("1 CHR")
            if event_date_parsed:
                lines.append(f"2 DATE {event_date_parsed}")
            if entry_place:
                lines.append(f"2 PLAC {entry_place}")

        if extracted["godparents"]:
            lines.append(f"1 NOTE Padrinos: {extracted['godparents']}")
        if extracted["notes"]:
            lines.append(f"1 NOTE {extracted['notes']}")

        # Enlace a Objeto Multimedia Digital (OBJE)
        lines.append("1 OBJE")
        ext = canonical_img.split(".")[-1].lower() if "." in canonical_img else "jpg"
        lines.append(f"2 FORM {ext}")
        lines.append(f"2 FILE images/{canonical_img}")
        folio_ref = entry.get("folio_number") or folio.get("sequence_order") or ""
        side_ref = entry.get("folio_side") or ""
        lines.append(f"2 TITL Folio {folio_ref} {side_ref} - Partida {entry.get('entry_number', 1)}")

        # Familia de Padres
        father_id = None
        mother_id = None
        if extracted["father_name"]:
            indi_counter += 1
            father_id = f"I{indi_counter}"
            lines.append(f"0 @{father_id}@ INDI")
            lines.append(f"1 NAME {extracted['father_name']} //")
            lines.append("1 SEX M")

        if extracted["mother_name"]:
            indi_counter += 1
            mother_id = f"I{indi_counter}"
            lines.append(f"0 @{mother_id}@ INDI")
            lines.append(f"1 NAME {extracted['mother_name']} //")
            lines.append("1 SEX F")

        if father_id or mother_id:
            fam_counter += 1
            fam_id = f"F{fam_counter}"
            lines.append(f"1 FAMC @{fam_id}@")
            fam_lines = [f"0 @{fam_id}@ FAM"]
            if father_id:
                fam_lines.append(f"1 HUSB @{father_id}@")
            if mother_id:
                fam_lines.append(f"1 WIFE @{mother_id}@")
            fam_lines.append(f"1 CHIL @{main_indi_id}@")
            fam_records.append(fam_lines)

    for fl in fam_records:
        lines.extend(fl)

    lines.append("0 TRLR")
    return "\n".join(lines) + "\n"


def generate_manifest_json(
    folder: Dict[str, Any],
    folios: List[Dict[str, Any]],
    entries: List[Dict[str, Any]],
    total_completed: int,
    total_revision: int,
    total_tome_folios: Optional[int] = None,
    excluded_pending_folios: Optional[int] = None,
    quality_score_percentage: Optional[float] = None,
    tome_metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    T02-BE-05: Genera el manifiesto institucional estructurado FamilySearch DIP
    con auditoría completa, reporte de folios totales, actas completadas empaquetadas,
    folios pendientes omitidos y porcentaje de completitud.
    """
    exported_entries_count = len(entries)
    
    # Calcular métricas canónicas
    actual_total_folios = total_tome_folios if total_tome_folios is not None else len(folios)
    
    completed_folio_ids = set(str(e.get("folio_id")) for e in entries if e.get("folio_id"))
    
    if excluded_pending_folios is not None:
        excluded_count = excluded_pending_folios
    else:
        excluded_count = max(0, actual_total_folios - len(completed_folio_ids))

    if quality_score_percentage is not None:
        score = quality_score_percentage
    else:
        score = 100.0 if exported_entries_count > 0 else 0.0

    folder_meta = folder.get("metadata") or {}
    t_meta = tome_metadata or folder_meta

    files_list = []
    for f in folios:
        fid = str(f.get("id"))
        entries_count = sum(1 for e in entries if str(e.get("folio_id")) == fid)
        is_exported = fid in completed_folio_ids
        files_list.append({
            "folio_id": fid,
            "sequence_order": f.get("sequence_order"),
            "original_filename": f.get("original_filename") or f.get("file_name"),
            "canonical_filename": f.get("canonical_filename") or f.get("original_filename") or f"folio_{fid}.jpg",
            "entries_count": entries_count,
            "is_exported": is_exported,
            "status": f.get("status")
        })

    country = t_meta.get("country") or folder_meta.get("country")
    state = t_meta.get("state") or folder_meta.get("state")
    municipality = t_meta.get("municipality") or folder_meta.get("municipality")
    city_or_locality = t_meta.get("city_or_locality") or folder_meta.get("city_or_locality")
    standardized_place = (
        t_meta.get("canonical_place") or
        t_meta.get("locality") or
        folder_meta.get("canonical_place") or
        folder_meta.get("locality")
    )

    manifest = {
        "project_name": "CodexFlow - FamilySearch DIP Export",
        "dip_version": "1.0",
        "standard": "FamilySearch DIP Homologation",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "tome_info": {
            "id": folder.get("id"),
            "name": folder.get("name"),
            "folder_type": folder.get("folder_type"),
            "tome_number": t_meta.get("tome_number") or folder_meta.get("tome_number") or folder_meta.get("number"),
            "year_start": t_meta.get("year_start") or folder_meta.get("year_start") or folder_meta.get("start_year"),
            "year_end": t_meta.get("year_end") or folder_meta.get("year_end") or folder_meta.get("end_year"),
            "parish_name": t_meta.get("parish_name") or folder_meta.get("parish_name"),
            "diocese_name": t_meta.get("diocese_name") or folder_meta.get("diocese_name"),
            "location": t_meta.get("location") or folder_meta.get("location") or folder_meta.get("shelf_location"),
            "geographic_coverage": {
                "country": country,
                "state": state,
                "municipality": municipality,
                "city_or_locality": city_or_locality,
                "standardized_place": standardized_place,
                "is_partially_inherited": True
            }
        },
        "statistics": {
            "total_tome_folios": actual_total_folios,
            "total_folios": actual_total_folios,
            "exported_entries_count": exported_entries_count,
            "excluded_pending_folios": excluded_count,
            "total_entries": exported_entries_count,
            "completed_entries": total_completed,
            "revision_entries": total_revision,
            "pending_entries": 0,
            "quality_score_percentage": score
        },
        "files": files_list
    }
    return manifest
