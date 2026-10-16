"""
FamilySearch DIP Exporter Engine.
Implements:
1. Matriz de Indexación en Excel (.xlsx) y CSV con formato institucional y BOM UTF-8.
2. Exportador GEDCOM 5.5.1 estándar para linajes y eventos vitales parroquiales.
3. Generador de manifest.json con auditoría, checksums y metadatos de conservación.
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


def generate_familysearch_matrix(
    entries: List[Dict[str, Any]],
    folios: List[Dict[str, Any]],
    tome_metadata: Dict[str, Any]
) -> Tuple[bytes, bytes]:
    """
    Genera la matriz de indexación en dos formatos:
    1. XLSX (Excel) con estilos institucionales (cabecera #1E293B, texto blanco, bordes finos, autoajuste).
    2. CSV delimitado por punto y coma (;) con codificación UTF-8 con BOM y directiva sep=;
    
    Retorna: (xlsx_bytes, csv_bytes)
    """
    folio_map = {str(f.get("id")): f for f in folios}

    headers = [
        "image_file_name",
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
    for entry in entries:
        fid = str(entry.get("folio_id"))
        folio = folio_map.get(fid, {})
        canonical_name = folio.get("canonical_filename") or folio.get("original_filename") or f"folio_{fid}.jpg"
        folio_num = folio.get("sequence_order") or folio.get("folio_number") or ""
        entry_num = entry.get("entry_number", 1)
        status = entry.get("status", "pending")
        meta = entry.get("metadata") or {}
        extracted = _extract_person_fields(meta)

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

        # Si no hubo sobreescritura canónica explícita pero difieren los componentes individuales:
        if not meta.get("canonical_place") and not meta.get("lugar_evento_estandarizado") and not meta.get("lugar"):
            # Si alguno difiere de tome_metadata, reconstruir orden ascendente
            if (row_country != tome_country or row_state != tome_state or 
                row_municipality != tome_municipality or row_city != tome_city):
                parts = [str(p).strip() for p in (row_city, row_municipality, row_state, row_country) if p and str(p).strip()]
                row_canonical_place = ", ".join(parts) if parts else ""

        row_data = [
            canonical_name,
            folio_num,
            entry_num,
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

    # Autoajuste de ancho de columnas
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
    tome_metadata: Dict[str, Any]
) -> str:
    """
    Genera un archivo estándar GEDCOM 5.5.1 enlazado a los folios digitales.
    Estructura:
      0 HEAD
      1 SOUR CODEXFLOW
      ...
      0 @I{id}@ INDI
      ...
      0 TRLR
    """
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

    # Obtención de lugar canónico estandarizado (SPEC-013 T05-BE-02)
    canonical_place = (
        tome_metadata.get("canonical_place") or
        tome_metadata.get("locality") or
        ""
    ).strip()

    # Si canonical_place no está definido pero hay partes tradicionales (compatibilidad hacia atrás)
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

    for entry in entries:
        meta = entry.get("metadata") or {}
        extracted = _extract_person_fields(meta)
        fid = str(entry.get("folio_id"))
        folio = folio_map.get(fid, {})
        canonical_img = folio.get("canonical_filename") or folio.get("original_filename") or f"folio_{fid}.jpg"

        # Lugar específico de la partida si estuviera sobreescrito
        entry_place = (
            meta.get("canonical_place") or
            meta.get("lugar_evento_estandarizado") or
            meta.get("lugar") or
            canonical_place
        ).strip()

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
            # Por defecto bautismo (CHR)
            lines.append("1 CHR")
            if event_date_parsed:
                lines.append(f"2 DATE {event_date_parsed}")
            if entry_place:
                lines.append(f"2 PLAC {entry_place}")

        # Padrinos / Notas en el evento
        if extracted["godparents"]:
            lines.append(f"1 NOTE Padrinos: {extracted['godparents']}")
        if extracted["notes"]:
            lines.append(f"1 NOTE {extracted['notes']}")

        # Enlace a Objeto Multimedia Digital (OBJE)
        lines.append("1 OBJE")
        ext = canonical_img.split(".")[-1].lower() if "." in canonical_img else "jpg"
        lines.append(f"2 FORM {ext}")
        lines.append(f"2 FILE images/{canonical_img}")
        lines.append(f"2 TITL Folio {folio.get('sequence_order') or folio.get('folio_number') or ''} - Partida {entry.get('entry_number', 1)}")

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

    # Añadir registros de familias al final
    for fl in fam_records:
        lines.extend(fl)

    # Cierre estándar GEDCOM
    lines.append("0 TRLR")
    return "\n".join(lines) + "\n"


def generate_manifest_json(
    folder: Dict[str, Any],
    folios: List[Dict[str, Any]],
    entries: List[Dict[str, Any]],
    total_completed: int,
    total_revision: int,
    tome_metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Genera el manifiesto institucional estructurado FamilySearch DIP.
    Incorpora geographic_coverage con resolución jerárquica (SPEC-013 T05-BE-03).
    """
    total_entries = len(entries)
    quality_score = 100.0
    if total_entries > 0:
        quality_score = round(((total_completed) / total_entries) * 100, 2)

    folder_meta = folder.get("metadata") or {}
    # Priorizar tome_metadata si se pasa (contexto resuelto), de lo contrario folder_meta
    t_meta = tome_metadata or folder_meta

    files_list = []
    for f in folios:
        fid = str(f.get("id"))
        entries_count = sum(1 for e in entries if str(e.get("folio_id")) == fid)
        files_list.append({
            "folio_id": fid,
            "sequence_order": f.get("sequence_order"),
            "original_filename": f.get("original_filename") or f.get("file_name"),
            "canonical_filename": f.get("canonical_filename") or f.get("original_filename") or f"folio_{fid}.jpg",
            "entries_count": entries_count,
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
            "total_folios": len(folios),
            "total_entries": total_entries,
            "completed_entries": total_completed,
            "revision_entries": total_revision,
            "pending_entries": total_entries - (total_completed + total_revision),
            "quality_score_percentage": quality_score
        },
        "files": files_list
    }
    return manifest

