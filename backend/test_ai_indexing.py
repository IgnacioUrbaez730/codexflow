import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from main import app

client = TestClient(app)

def test_ai_metrics_unauthorized():
    response = client.get("/api/v1/ai/metrics")
    assert response.status_code == 401

def test_ai_feedback_unauthorized():
    response = client.post("/api/v1/ai/feedback", json={
        "folio_id": "folio-123",
        "items": [
            {
                "field_name": "nombre_bautizado",
                "predicted_value": "Juan",
                "actual_value": "Juan Carlos",
                "confidence": 0.85,
                "action_type": "corrected_text"
            }
        ]
    })
    assert response.status_code == 401

@patch("main.get_auth_context")
def test_ai_metrics_success(mock_auth):
    mock_auth.return_value = {
        "tenant_id": "tenant-test-123",
        "user_id": "user-test-456",
        "role": "admin",
        "user_client": MagicMock()
    }
    # Mock supabase response for training_data query
    mock_data = [
        {"action_type": "accepted_exact", "field_name": "nombre_bautizado"},
        {"action_type": "accepted_exact", "field_name": "fecha_sacramento"},
        {"action_type": "corrected_text", "field_name": "nombre_bautizado"},
        {"action_type": "rejected_blank", "field_name": "padrinos"}
    ]
    mock_query = MagicMock()
    mock_query.select.return_value = mock_query
    mock_query.eq.return_value = mock_query
    mock_query.execute.return_value = MagicMock(data=mock_data)
    
    with patch("main.supabase.table", return_value=mock_query):
        app.dependency_overrides[app.dependency_overrides.get("get_auth_context", None)] = lambda: mock_auth.return_value
        response = client.get("/api/v1/ai/metrics", headers={"Authorization": "Bearer mock-token"})
        app.dependency_overrides.clear()
        
        assert response.status_code == 200
        json_data = response.json()
        assert json_data["status"] == "success"
        data = json_data["data"]
        assert "acceptance_rate" in data
        assert "total_suggestions" in data
        assert "total_accepted" in data
        assert "total_corrected" in data
