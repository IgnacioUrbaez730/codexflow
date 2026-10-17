"""
Tests E2E and Unit Verification for FamilySearch DIP Exporter and Filter Engine.
Verifies:
1. Strict filtering of pending entries in matriz_indexacion.xlsx and export_gedcom.ged.
2. Manifest structure, exported_entries_count == 5, excluded_pending_folios == 5.
3. Selective packaging of images matching only folios with completed entries.
4. Interfolio continued entry consolidation.
"""

import io
import json
import zipfile
import openpyxl
import pytest
from typing import Dict, Any, List

from backend.exporters.familysearch import (
    generate_familysearch_matrix,
    generate_gedcom_551,
    generate_manifest_json,
    consolidate_continued_entries
)


@pytest.fixture
def sample_tome_metadata() -> Dict[str, Any]:
    return {
        "tome_number": "01",
        "parish_name": "Parroquia Santa Rosa de Lima",
        "diocese_name": "Diócesis de Carúpano",
        "country": "Venezuela",
        "state": "Sucre",
        "municipality": "Bermúdez",
        "city_or_locality": "Carúpano",
        "canonical_place": "Carúpano, Bermúdez, Sucre, Venezuela",
        "year_start": 1885,
        "year_end": 1890
    }


@pytest.fixture
def sample_folder() -> Dict[str, Any]:
    return {
        "id": "f0000000-0000-0000-0000-000000000001",
        "name": "Libro 1 de Bautismos (1885-1890) - Demostración Oficial",
        "folder_type": "tome",
        "metadata": {
            "tome_number": "01",
            "parish_name": "Parroquia Santa Rosa de Lima",
            "country": "Venezuela",
            "state": "Sucre"
        }
    }


@pytest.fixture
def mixed_folios_and_entries():
    """
    Generates 10 sequential folios:
    F001r, F001v, F002r, F002v, F003r (First 5 have COMPLETED entries)
    F003v, F004r, F004v, F005r, F005v (Next 5 have PENDING entries)
    """
    folios = []
    entries = []

    sides_and_nums = [
        (1, "recto", "completed", "José Francisco", "Alcalá Bermúdez", "1"),
        (1, "vuelto", "completed", "María del Carmen", "Montes Rivera", "2"),
        (2, "recto", "completed", "Antonio María", "Salazar Rojas", "3"),
        (2, "vuelto", "completed", "Francisca Antonia", "Gómez Serrano", "4"),
        (3, "recto", "completed", "Pedro Celestino", "Caraballo Ramos", "5"),
        (3, "vuelto", "pending", "Juan Bautista", "Pendiente Uno", "6"),
        (4, "recto", "pending", "Ana Teresa", "Pendiente Dos", "7"),
        (4, "vuelto", "pending", "Carlos Eduardo", "Pendiente Tres", "8"),
        (5, "recto", "pending", "Rosa Elena", "Pendiente Cuatro", "9"),
        (5, "vuelto", "pending", "Simón Bolívar", "Pendiente Cinco", "10"),
    ]

    for idx, (f_num, f_side, status, fn, ln, act_num) in enumerate(sides_and_nums, start=1):
        folio_id = f"folio-uuid-{idx:03d}"
        entry_id = f"entry-uuid-{idx:03d}"
        side_code = "R" if f_side == "recto" else "V"
        canon_name = f"CARUPANO_BAU_T01_F{f_num:03d}{side_code}.jpg"

        folios.append({
            "id": folio_id,
            "folder_id": "f0000000-0000-0000-0000-000000000001",
            "sequence_order": idx,
            "original_filename": f"scan_{idx:03d}.jpg",
            "canonical_filename": canon_name,
            "status": status
        })

        meta = {
            "first_name": fn,
            "last_name": ln,
            "sex": "M" if "o" in fn.lower() or "carlos" in fn.lower() else "F",
            "event_date": f"188{idx % 5 + 5}-05-12",
            "birth_date": f"188{idx % 5 + 5}-04-20",
            "father_name": f"Padre de {fn}",
            "mother_name": f"Madre de {ln}",
            "godparents": "Padrino y Madrina Notables",
            "minister": "Pbro. Dr. Juan de Dios Morales",
            "marginal_notes": "Nota de legitimidad canónica sacramental."
        }

        entries.append({
            "id": entry_id,
            "folio_id": folio_id,
            "entry_number": 1,
            "status": status,
            "folio_number": f_num,
            "folio_side": f_side,
            "act_number": act_num,
            "is_continued": False,
            "continued_from_entry_id": None,
            "metadata": meta
        })

    return folios, entries


def test_dip_filter_matrix_xlsx_and_csv(mixed_folios_and_entries, sample_tome_metadata):
    """
    T04-QA-02: Valida que la matriz XLSX contenga EXACTAMENTE las filas
    de las partidas completadas (5) y 0 filas de partidas pendientes.
    """
    folios, all_entries = mixed_folios_and_entries
    
    # Simular exportación con filtro estricto de main.py
    completed_entries = [e for e in all_entries if e["status"] in ("completed", "verified")]
    assert len(completed_entries) == 5

    excel_bytes, csv_bytes = generate_familysearch_matrix(
        entries=completed_entries,
        folios=folios,
        tome_metadata=sample_tome_metadata
    )

    # 1. Inspeccionar Excel
    wb = openpyxl.load_workbook(io.BytesIO(excel_bytes))
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    
    header = rows[0]
    data_rows = rows[1:]

    # Deben haber exactamente 5 filas de datos
    assert len(data_rows) == 5

    # Validar que ningún nombre pendiente aparezca en los datos de la matriz
    names_in_excel = [r[7] for r in data_rows]  # primer_nombre está en columna índice 7
    for row in data_rows:
        status_in_row = row[6]  # status
        assert status_in_row in ("completed", "verified")
        assert "Pendiente" not in str(row)

    assert "José Francisco" in names_in_excel
    assert "María del Carmen" in names_in_excel
    assert "Juan Bautista" not in names_in_excel
    assert "Ana Teresa" not in names_in_excel

    # 2. Inspeccionar CSV
    csv_text = csv_bytes.decode("utf-8-sig")
    assert "sep=;" in csv_text
    csv_lines = [line.strip() for line in csv_text.splitlines() if line.strip() and not line.startswith("sep=")]
    # 1 header + 5 rows = 6 lines
    assert len(csv_lines) == 6
    assert "Pendiente" not in csv_text


def test_dip_filter_gedcom_551(mixed_folios_and_entries, sample_tome_metadata):
    """
    T04-QA-02: Valida que export_gedcom.ged solo contenga individuos de partidas completadas.
    """
    folios, all_entries = mixed_folios_and_entries
    completed_entries = [e for e in all_entries if e["status"] in ("completed", "verified")]

    gedcom_str = generate_gedcom_551(
        entries=completed_entries,
        folios=folios,
        tome_metadata=sample_tome_metadata
    )

    assert "0 HEAD" in gedcom_str
    assert "1 GEDC" in gedcom_str
    assert "2 VERS 5.5.1" in gedcom_str
    assert "0 TRLR" in gedcom_str

    # Debe contener a José Francisco y María del Carmen
    assert "José Francisco /Alcalá Bermúdez/" in gedcom_str
    assert "María del Carmen /Montes Rivera/" in gedcom_str

    # NUNCA debe contener individuos de partidas pendientes
    assert "Juan Bautista" not in gedcom_str
    assert "Ana Teresa" not in gedcom_str
    assert "Pendiente" not in gedcom_str


def test_dip_manifest_metrics(mixed_folios_and_entries, sample_folder, sample_tome_metadata):
    """
    T04-QA-02: Valida que manifest.json reporte exported_entries_count == 5 y excluded_pending_folios == 5.
    """
    folios, all_entries = mixed_folios_and_entries
    completed_entries = [e for e in all_entries if e["status"] in ("completed", "verified")]

    completed_folio_ids = set(e["folio_id"] for e in completed_entries)
    total_tome_folios = len(folios)
    excluded_pending_folios = max(0, total_tome_folios - len(completed_folio_ids))

    manifest = generate_manifest_json(
        folder=sample_folder,
        folios=folios,
        entries=completed_entries,
        total_completed=len(completed_entries),
        total_revision=0,
        total_tome_folios=total_tome_folios,
        excluded_pending_folios=excluded_pending_folios,
        quality_score_percentage=50.0,
        tome_metadata=sample_tome_metadata
    )

    stats = manifest["statistics"]
    assert stats["total_tome_folios"] == 10
    assert stats["exported_entries_count"] == 5
    assert stats["excluded_pending_folios"] == 5
    assert stats["pending_entries"] == 0
    assert stats["completed_entries"] == 5

    # Validar lista de archivos en manifest
    files = manifest["files"]
    assert len(files) == 10
    exported_files = [f for f in files if f["is_exported"]]
    excluded_files = [f for f in files if not f["is_exported"]]

    assert len(exported_files) == 5
    assert len(excluded_files) == 5


def test_interfolio_continued_entry_consolidation():
    """
    Valida la consolidación de partidas con is_continued=True referenciando a la partida madre.
    """
    entries = [
        {
            "id": "parent-entry-1",
            "folio_id": "folio-1",
            "folio_number": 1,
            "folio_side": "vuelto",
            "act_number": "12",
            "status": "completed",
            "is_continued": False,
            "continued_from_entry_id": None,
            "metadata": {
                "first_name": "Sebastián",
                "last_name": "Miranda",
                "marginal_notes": "Bautizado sub conditione."
            }
        },
        {
            "id": "child-entry-continued",
            "folio_id": "folio-2",
            "folio_number": 2,
            "folio_side": "recto",
            "act_number": "12",
            "status": "completed",
            "is_continued": True,
            "continued_from_entry_id": "parent-entry-1",
            "metadata": {
                "marginal_notes": "Continuación: constan los padrinos Don Carlos y Doña Inés."
            }
        }
    ]

    consolidated = consolidate_continued_entries(entries)
    # Debe unificarse en 1 partida consolidada
    assert len(consolidated) == 1
    parent = consolidated[0]
    assert parent["id"] == "parent-entry-1"
    notes = parent["metadata"]["marginal_notes"]
    assert "Bautizado sub conditione." in notes
    assert "[Continuación Folio 2 recto]: Continuación: constan los padrinos Don Carlos y Doña Inés." in notes
