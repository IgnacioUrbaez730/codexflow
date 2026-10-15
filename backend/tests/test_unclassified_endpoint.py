import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

def test_unclassified_folios_logic():
    from main import app, get_auth_context

    client = TestClient(app)

    # Mock auth context
    mock_auth = {
        "tenant_id": "test-tenant-123",
        "user_client": MagicMock(),
        "user_id": "user-456",
        "role": "admin"
    }

    app.dependency_overrides[get_auth_context] = lambda: mock_auth

    # Mock supabase tables
    with patch("main.supabase") as mock_supabase:
        mock_folders_query = MagicMock()
        mock_folders_res = MagicMock()
        mock_folders_res.data = [
            {
                "id": "folder-unclass-999",
                "name": "Sin Clasificar (Migración inicial)",
                "metadata": {"system_managed": True}
            }
        ]
        mock_folders_query.select.return_value.eq.return_value.execute.return_value = mock_folders_res
        
        mock_folios_query = MagicMock()
        mock_folios_res = MagicMock()
        mock_folios_res.data = [
            {
                "id": "folio-1",
                "folder_id": "folder-unclass-999",
                "tenant_id": "test-tenant-123",
                "batches": {"id": "batch-1", "template_id": "tpl-1", "templates": {"name": "Bautismos"}}
            },
            {
                "id": "folio-2",
                "folder_id": None,
                "tenant_id": "test-tenant-123",
                "batches": {"id": "batch-1", "template_id": "tpl-1", "templates": {"name": "Bautismos"}}
            }
        ]
        
        mock_select = MagicMock()
        mock_eq = MagicMock()
        mock_or = MagicMock()
        mock_order = MagicMock()
        mock_limit = MagicMock()
        
        mock_folios_query.select.return_value = mock_select
        mock_select.eq.return_value = mock_eq
        mock_eq.or_.return_value = mock_or
        mock_or.order.return_value = mock_order
        mock_order.limit.return_value.execute.return_value = mock_folios_res

        def table_dispatch(name):
            if name == "document_folders":
                return mock_folders_query
            elif name == "folios":
                return mock_folios_query
            return MagicMock()

        mock_supabase.table.side_effect = table_dispatch

        response = client.get("/api/v1/folders/unclassified-folios")
        assert response.status_code == 200
        json_data = response.json()
        assert json_data["status"] == "success"
        assert json_data["unclassified_folder_id"] == "folder-unclass-999"
        assert len(json_data["data"]) == 2

    app.dependency_overrides.clear()
