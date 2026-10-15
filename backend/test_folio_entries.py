import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from backend.main import (
    app,
    FolioEntryCreate,
    FolioEntryUpdate,
    BatchSaveEntriesRequest,
    _resolve_folder_inherited_context
)

def test_models_instantiation():
    entry_create = FolioEntryCreate(
        entry_number=1,
        metadata={"first_name": "Juan", "last_name": "Pérez"},
        status="completed",
        bounding_box={"ymin": 0.1, "xmin": 0.1, "ymax": 0.4, "xmax": 0.9}
    )
    assert entry_create.entry_number == 1
    assert entry_create.metadata["first_name"] == "Juan"
    assert entry_create.status == "completed"

    entry_update = FolioEntryUpdate(
        metadata={"first_name": "Pedro"},
        status="revision"
    )
    assert entry_update.metadata["first_name"] == "Pedro"
    assert entry_update.status == "revision"

    batch_req = BatchSaveEntriesRequest(
        entries=[entry_create],
        final_status="completed"
    )
    assert len(batch_req.entries) == 1
    assert batch_req.final_status == "completed"


def test_resolve_folder_inherited_context_empty():
    mock_client = MagicMock()
    ctx = _resolve_folder_inherited_context(mock_client, None, "tenant-123")
    assert ctx["parish_name"] is None
    assert ctx["tome_number"] is None


def test_resolve_folder_inherited_context_with_tome():
    mock_client = MagicMock()
    # Mock folder response
    tome_folder = {
        "id": "tome-1",
        "parent_id": "parish-1",
        "folder_type": "tome",
        "name": "Libro 01 (1850-1875)",
        "metadata": {
            "tome_number": "1",
            "year_start": 1850,
            "year_end": 1875
        }
    }
    parish_folder = {
        "id": "parish-1",
        "parent_id": None,
        "folder_type": "parish",
        "name": "Parroquia San José",
        "metadata": {}
    }

    def mock_table(table_name):
        chain = MagicMock()
        if table_name == "document_folders":
            def mock_eq(col, val):
                eq_chain = MagicMock()
                if val == "tome-1":
                    eq_chain.eq.return_value.execute.return_value.data = [tome_folder]
                elif val == "parish-1":
                    eq_chain.eq.return_value.execute.return_value.data = [parish_folder]
                else:
                    eq_chain.eq.return_value.execute.return_value.data = []
                return eq_chain
            chain.select.return_value.eq.side_effect = mock_eq
        return chain

    mock_client.table.side_effect = mock_table
    ctx = _resolve_folder_inherited_context(mock_client, "tome-1", "tenant-123")
    assert ctx["tome_number"] == "1"
    assert ctx["year_start"] == 1850
    assert ctx["year_end"] == 1875
    assert ctx["parish_name"] == "Parroquia San José"
