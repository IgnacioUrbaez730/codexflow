import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_create_demo_request_success():
    payload = {
        "full_name": "Dr. Fernando Morales",
        "organization": "Archivo Histórico Diocesano",
        "email": "fmorales@diocesis.org",
        "phone": "+58 412 1234567",
        "message": "Solicitud para evaluar transcripción de libros sacramentales del siglo XVIII"
    }
    
    with patch("main.supabase.table") as mock_table:
        mock_insert = MagicMock()
        mock_insert.execute.return_value = MagicMock(data=[{"id": "test-uuid", **payload, "status": "pending"}])
        mock_table.return_value.insert.return_value = mock_insert
        
        response = client.post("/api/v1/demo-requests", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["data"][0]["email"] == "fmorales@diocesis.org"

def test_create_demo_request_validation_error():
    # Missing required full_name and email
    payload = {
        "organization": "Archivo Histórico"
    }
    response = client.post("/api/v1/demo-requests", json=payload)
    assert response.status_code == 422
