import pytest
from fastapi.testclient import TestClient
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from main import app

client = TestClient(app)

def test_regenerate_api_key_unauthorized():
    response = client.post("/api/v1/keys/regenerate", json={"tenant_id": "test-tenant"})
    assert response.status_code == 401
