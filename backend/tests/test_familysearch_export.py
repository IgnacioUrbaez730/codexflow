import pytest
import io
import json
import zipfile
import openpyxl
from backend.exporters.familysearch import (
    generate_familysearch_matrix,
    generate_gedcom_551,
    generate_manifest_json,
    parse_gedcom_date
)

def test_parse_gedcom_date():
    assert parse_gedcom_date("1855-04-12") == "12 APR 1855"
    assert parse_gedcom_date("1855-04") == "APR 1855"
    assert parse_gedcom_date("1855") == "1855"
    assert parse_gedcom_date("15/04/1855") == "15 APR 1855"
    assert parse_gedcom_date(None) is None
    assert parse_gedcom_date("") is None


def test_familysearch_matrix_generation():
    folios = [
        {
            "id": "folio-1",
            "sequence_order": 1,
            "canonical_filename": "DIOC_CAR_BAU_T01_F0001.jpg",
            "original_filename": "IMG_001.jpg"
        }
    ]
    entries = [
        {
            "folio_id": "folio-1",
            "entry_number": 1,
            "status": "completed",
            "metadata": {
                "primer_nombre": "Juan",
                "apellidos": "Pérez Gómez",
                "sexo": "M",
                "fecha_acta": "1855-04-12",
                "fecha_nacimiento": "1855-04-10",
                "padre": "Pedro Pérez",
                "madre": "María Gómez",
                "padrinos": "José García y Ana Romero",
                "observaciones": "Acta legible"
            }
        }
    ]
    tome_metadata = {
        "parish_name": "Parroquia Santa Rosa",
        "tome_number": "1",
        "diocese_name": "Diócesis de Carúpano"
    }

    excel_bytes, csv_bytes = generate_familysearch_matrix(entries, folios, tome_metadata)

    # 1. Validar Excel
    assert len(excel_bytes) > 0
    wb = openpyxl.load_workbook(io.BytesIO(excel_bytes))
    ws = wb.active
    assert ws.title == "Matriz FamilySearch"
    headers = [cell.value for cell in ws[1]]
    assert "image_file_name" in headers
    assert "entry_number" in headers
    assert "primer_nombre" in headers

    row_2 = [cell.value for cell in ws[2]]
    assert row_2[0] == "DIOC_CAR_BAU_T01_F0001.jpg"
    assert row_2[1] == 1  # folio_number / sequence_order
    assert row_2[2] == 1  # entry_number
    assert row_2[4] == "Juan"
    assert row_2[5] == "Pérez Gómez"

    # 2. Validar CSV
    assert csv_bytes.startswith(b"\xef\xbb\xbf")  # BOM UTF-8
    csv_str = csv_bytes.decode("utf-8")
    assert csv_str.startswith("\ufeffsep=;\r\n")
    lines = csv_str.splitlines()
    assert "image_file_name" in lines[1]
    assert "DIOC_CAR_BAU_T01_F0001.jpg;1;1;completed;Juan;Pérez Gómez" in lines[2]


def test_gedcom_551_generation():
    folios = [
        {
            "id": "folio-1",
            "sequence_order": 42,
            "canonical_filename": "DIOC_CAR_BAU_T01_F0042.jpg"
        }
    ]
    entries = [
        {
            "folio_id": "folio-1",
            "entry_number": 1,
            "status": "completed",
            "metadata": {
                "primer_nombre": "Juan",
                "apellidos": "Pérez",
                "sexo": "M",
                "fecha_acta": "1855-04-12",
                "padre": "Pedro Pérez",
                "madre": "María González",
                "padrinos": "José Martínez"
            }
        }
    ]
    tome_metadata = {
        "parish_name": "Parroquia San José",
        "diocese_name": "Diócesis de Carúpano",
        "series_code": "BAU"
    }

    gedcom_str = generate_gedcom_551(entries, folios, tome_metadata)

    # Validaciones obligatorias de la especificación GEDCOM 5.5.1
    assert "0 HEAD" in gedcom_str
    assert "1 SOUR CODEXFLOW" in gedcom_str
    assert "1 GEDC" in gedcom_str
    assert "2 VERS 5.5.1" in gedcom_str
    assert "2 FORM LINEAGE-LINKED" in gedcom_str
    assert "1 CHAR UTF-8" in gedcom_str

    # Individuo principal
    assert "0 @I1@ INDI" in gedcom_str
    assert "1 NAME Juan /Pérez/" in gedcom_str
    assert "1 SEX M" in gedcom_str
    assert "1 CHR" in gedcom_str
    assert "2 DATE 12 APR 1855" in gedcom_str
    assert "Parroquia San José, Diócesis de Carúpano" in gedcom_str

    # Objeto digital asociado
    assert "1 OBJE" in gedcom_str
    assert "2 FILE images/DIOC_CAR_BAU_T01_F0042.jpg" in gedcom_str

    # Padres y familia
    assert "0 @I2@ INDI" in gedcom_str
    assert "1 NAME Pedro Pérez //" in gedcom_str
    assert "0 @I3@ INDI" in gedcom_str
    assert "1 NAME María González //" in gedcom_str
    assert "0 @F1@ FAM" in gedcom_str
    assert "1 HUSB @I2@" in gedcom_str
    assert "1 WIFE @I3@" in gedcom_str
    assert "1 CHIL @I1@" in gedcom_str

    # Cierre
    assert "0 TRLR" in gedcom_str


def test_manifest_json_generation():
    folder = {
        "id": "tome-001",
        "name": "Libro 01 (1850-1875)",
        "folder_type": "tome",
        "metadata": {
            "tome_number": "1",
            "year_start": 1850,
            "year_end": 1875,
            "parish_name": "San José",
            "diocese_name": "Carúpano"
        }
    }
    folios = [
        {
            "id": "f-1",
            "sequence_order": 1,
            "original_filename": "IMG_001.jpg",
            "canonical_filename": "DIOC_CAR_BAU_T01_F0001.jpg",
            "status": "completed"
        }
    ]
    entries = [
        {
            "folio_id": "f-1",
            "entry_number": 1,
            "status": "completed",
            "metadata": {"primer_nombre": "Juan"}
        },
        {
            "folio_id": "f-1",
            "entry_number": 2,
            "status": "revision",
            "metadata": {"primer_nombre": "Pedro"}
        }
    ]

    manifest = generate_manifest_json(folder, folios, entries, total_completed=1, total_revision=1)

    assert manifest["project_name"] == "CodexFlow - FamilySearch DIP Export"
    assert manifest["dip_version"] == "1.0"
    assert manifest["standard"] == "FamilySearch DIP Homologation"
    assert "generated_at" in manifest
    assert manifest["tome_info"]["name"] == "Libro 01 (1850-1875)"
    assert manifest["tome_info"]["tome_number"] == "1"
    assert manifest["statistics"]["total_folios"] == 1
    assert manifest["statistics"]["total_entries"] == 2
    assert manifest["statistics"]["completed_entries"] == 1
    assert manifest["statistics"]["revision_entries"] == 1
    assert manifest["statistics"]["quality_score_percentage"] == 50.0
    assert len(manifest["files"]) == 1
    assert manifest["files"][0]["canonical_filename"] == "DIOC_CAR_BAU_T01_F0001.jpg"
    assert manifest["files"][0]["entries_count"] == 2
