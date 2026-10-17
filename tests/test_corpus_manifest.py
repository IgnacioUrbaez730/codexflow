"""
Test de validación exhaustiva para tools/seeding/corpus_manifest.json
Verifica estructura, tipos, volumen (60 folios: 20 BAU, 20 MAT, 20 DEF),
balance 50/50 completed vs pending/blank, casos de estrés y metadatos canónicos.
"""
import json
import os
import pytest

MANIFEST_PATH = os.path.join(os.path.dirname(__file__), "..", "tools", "seeding", "corpus_manifest.json")


def load_manifest():
    assert os.path.exists(MANIFEST_PATH), f"Manifest file does not exist at {MANIFEST_PATH}"
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def test_manifest_is_valid_json_and_has_structure():
    data = load_manifest()
    assert isinstance(data, dict)
    assert "version" in data
    assert "organization" in data
    assert data["organization"] == "codexflow-folios"
    assert "volumes" in data
    assert len(data["volumes"]) == 3
    assert "folios" in data
    assert len(data["folios"]) == 60


def test_series_distribution_and_volume_links():
    data = load_manifest()
    folios = data["folios"]

    series_counts = {"bautismo": 0, "matrimonio": 0, "defuncion": 0}
    for f in folios:
        s = f.get("series")
        assert s in series_counts, f"Serie no válida: {s}"
        series_counts[s] += 1
        assert f.get("tome_number") == 1
        assert 1 <= f.get("sequence_order") <= 20
        assert 1 <= f.get("folio_number") <= 20
        assert f.get("folio_side") in ["recto", "verso", "double_page", "unica"]
        assert f.get("canonical_filename") is not None
        assert f.get("status") in ["completed", "pending", "blank"]
        assert f.get("stress_case") in [
            "standard",
            "double_page",
            "continued",
            "degraded",
            "doubtful",
            "blank",
            "marginal_notes",
        ]
        assert "prompt" in f and len(f["prompt"]) > 20
        assert "entries" in f
        assert isinstance(f["entries"], list)

    assert series_counts["bautismo"] == 20
    assert series_counts["matrimonio"] == 20
    assert series_counts["defuncion"] == 20


def test_status_balance_50_50():
    data = load_manifest()
    folios = data["folios"]

    for series_name in ["bautismo", "matrimonio", "defuncion"]:
        series_folios = [f for f in folios if f["series"] == series_name]
        completed = [f for f in series_folios if f["status"] == "completed"]
        non_completed = [f for f in series_folios if f["status"] in ["pending", "blank"]]
        assert len(completed) == 10, f"{series_name} debe tener 10 completed, tiene {len(completed)}"
        assert len(non_completed) == 10, f"{series_name} debe tener 10 pendientes/blank, tiene {len(non_completed)}"


def test_stress_cases_representation():
    data = load_manifest()
    folios = data["folios"]

    for series_name in ["bautismo", "matrimonio", "defuncion"]:
        s_folios = {f["sequence_order"]: f for f in folios if f["series"] == series_name}

        # 1.5.1 Doble página en 6 y 7
        assert s_folios[6]["stress_case"] == "double_page"
        assert s_folios[7]["stress_case"] == "double_page"
        assert s_folios[6]["folio_side"] == "double_page"
        assert s_folios[7]["folio_side"] == "double_page"

        # 1.5.2 Partidas continuadas en 8 y 9
        assert s_folios[8]["stress_case"] == "continued"
        assert s_folios[9]["stress_case"] == "continued"
        entry_f8 = [e for e in s_folios[8]["entries"] if e.get("is_continued_to_next")]
        entry_f9 = [e for e in s_folios[9]["entries"] if e.get("is_continued")]
        assert len(entry_f8) >= 1, f"Serie {series_name} Folio 8 debe contener partida que continúa"
        assert len(entry_f9) >= 1, f"Serie {series_name} Folio 9 debe marcar is_continued: True"

        # 1.5.3 Degradadas en 10, 11, 12
        for seq in [10, 11, 12]:
            assert s_folios[seq]["stress_case"] == "degraded"

        # 1.5.4 Dudoso / Mutilado en 13, 14
        for seq in [13, 14]:
            assert s_folios[seq]["stress_case"] == "doubtful"

        # 1.5.5 Folio en blanco en 15
        assert s_folios[15]["stress_case"] == "blank"
        assert s_folios[15]["status"] == "blank"

        # 1.5.6 Notas marginales en 16, 17
        for seq in [16, 17]:
            assert s_folios[seq]["stress_case"] == "marginal_notes"
            entries = s_folios[seq]["entries"]
            assert any(e.get("has_marginal_notes") for e in entries)


def test_canonical_entries_metadata_structure():
    data = load_manifest()
    folios = data["folios"]

    completed_folios = [f for f in folios if f["status"] == "completed"]
    assert len(completed_folios) == 30

    for f in completed_folios:
        assert len(f["entries"]) > 0, f"Folio completado {f['canonical_filename']} debe tener al menos una entrada"
        for e in f["entries"]:
            assert e.get("status") == "completed"
            meta = e.get("metadata", {})
            series = f["series"]

            if series == "bautismo":
                assert "nombres" in meta or "bautizado" in meta
                assert "fecha_sacramento" in meta
                assert "nombre_padre" in meta
                assert "nombre_madre" in meta
                assert "padrinos" in meta
                assert "ministro" in meta
            elif series == "matrimonio":
                assert "contrayente_1" in meta or "novio" in meta
                assert "contrayente_2" in meta or "novia" in meta
                assert "fecha_sacramento" in meta or "fecha_matrimonio" in meta
                assert "testigos" in meta
                assert "ministro" in meta
            elif series == "defuncion":
                assert "difunto" in meta
                assert "fecha_defuncion" in meta or "fecha_sacramento" in meta
                assert "causa_muerte" in meta
                assert "sepultura" in meta
