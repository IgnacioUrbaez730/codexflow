import pytest
from unittest.mock import MagicMock
from backend.main import (
    build_canonical_place,
    _resolve_folder_inherited_context,
    FolderMetadata,
    GeographicSuggestionsResponse
)


def test_build_canonical_place():
    # 1. Caso completo: orden ascendente (localidad, municipio, estado, país)
    res = build_canonical_place("Carúpano", "Bermúdez", "Sucre", "Venezuela")
    assert res == "Carúpano, Bermúdez, Sucre, Venezuela"

    # 2. Caso con espacios en blanco y vacíos
    res2 = build_canonical_place("  Carúpano  ", "", "  Sucre ", None)
    assert res2 == "Carúpano, Sucre"

    # 3. Caso todo vacío
    res3 = build_canonical_place(None, "", "  ", None)
    assert res3 is None


def test_folder_metadata_schema():
    meta = FolderMetadata(
        country="Venezuela",
        state="Sucre",
        municipality="Bermúdez",
        city_or_locality="Carúpano",
        diocese_name="Diócesis de Carúpano",
        parish_name="Parroquia Santa Rosa de Lima"
    )
    assert meta.country == "Venezuela"
    assert meta.state == "Sucre"
    assert meta.municipality == "Bermúdez"
    assert meta.city_or_locality == "Carúpano"
    assert meta.diocese_name == "Diócesis de Carúpano"
    assert meta.parish_name == "Parroquia Santa Rosa de Lima"


def test_resolve_folder_inherited_context_ascendance():
    # Mock de client Supabase
    mock_client = MagicMock()

    # Estructura del árbol:
    # root (Diócesis): country="Venezuela", state="Sucre", diocese_name="Diócesis de Carúpano"
    # parish (Parroquia): parent=root, municipality="Bermúdez", parish_name="Santa Rosa"
    # tome (Tomo): parent=parish, city_or_locality="Carúpano", tome_number="1", year_start=1850, year_end=1875

    folders = {
        "folder-tome": {
            "id": "folder-tome",
            "parent_id": "folder-parish",
            "folder_type": "tome",
            "name": "Tomo 1 Bautismos",
            "metadata": {
                "tome_number": "1",
                "year_start": 1850,
                "year_end": 1875,
                "city_or_locality": "Carúpano"
            }
        },
        "folder-parish": {
            "id": "folder-parish",
            "parent_id": "folder-root",
            "folder_type": "parish",
            "name": "Parroquia Santa Rosa de Lima",
            "metadata": {
                "parish_name": "Santa Rosa de Lima",
                "municipality": "Bermúdez"
            }
        },
        "folder-root": {
            "id": "folder-root",
            "parent_id": None,
            "folder_type": "root",
            "name": "Diócesis de Carúpano",
            "metadata": {
                "diocese_name": "Diócesis de Carúpano",
                "state": "Sucre",
                "country": "Venezuela"
            }
        }
    }

    def fake_table(name):
        mock_query = MagicMock()
        if name == "document_folders":
            def fake_eq(col, val):
                mock_eq = MagicMock()
                if col == "id":
                    current_id = val
                    def fake_eq2(col2, val2):
                        mock_exec = MagicMock()
                        folder_data = [folders[current_id]] if current_id in folders else []
                        mock_exec.execute.return_value = MagicMock(data=folder_data)
                        return mock_exec
                    mock_eq.eq = fake_eq2
                return mock_eq
            mock_query.select.return_value.eq = fake_eq
        elif name == "tenants":
            mock_query.select.return_value.eq.return_value.execute.return_value = MagicMock(
                data=[{"country": "Default Country", "state": "Default State"}]
            )
        return mock_query

    mock_client.table.side_effect = fake_table

    ctx = _resolve_folder_inherited_context(mock_client, "folder-tome", "tenant-1")

    # Verificación de herencia y sobreescritura parcial
    assert ctx["country"] == "Venezuela"
    assert ctx["state"] == "Sucre"
    assert ctx["municipality"] == "Bermúdez"
    assert ctx["city_or_locality"] == "Carúpano"
    assert ctx["diocese_name"] == "Diócesis de Carúpano"
    assert ctx["parish_name"] == "Santa Rosa de Lima"
    assert ctx["tome_number"] == "1"
    assert ctx["year_start"] == 1850
    assert ctx["year_end"] == 1875
    assert ctx["canonical_place"] == "Carúpano, Bermúdez, Sucre, Venezuela"


def test_resolve_folder_inherited_context_fallback_tenant():
    mock_client = MagicMock()
    # Carpeta huérfana o sin datos geográficos
    def fake_table(name):
        mock_query = MagicMock()
        if name == "document_folders":
            mock_query.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
                data=[{
                    "id": "tome-solo",
                    "parent_id": None,
                    "folder_type": "tome",
                    "name": "Tomo Aislado",
                    "metadata": {"city_or_locality": "El Pilar"}
                }]
            )
        elif name == "tenants":
            mock_query.select.return_value.eq.return_value.execute.return_value = MagicMock(
                data=[{"country": "Venezuela", "state": "Sucre"}]
            )
        return mock_query

    mock_client.table.side_effect = fake_table

    ctx = _resolve_folder_inherited_context(mock_client, "tome-solo", "tenant-1")
    assert ctx["country"] == "Venezuela"
    assert ctx["state"] == "Sucre"
    assert ctx["city_or_locality"] == "El Pilar"
    assert ctx["canonical_place"] == "El Pilar, Sucre, Venezuela"
