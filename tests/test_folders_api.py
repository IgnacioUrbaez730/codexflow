import pytest
from enum import Enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ValidationError
from fastapi import HTTPException
import asyncio

# Import schemas from backend.main or define directly
from backend.main import (
    FolderType,
    FolderMetadata,
    FolderCreate,
    FolderUpdate,
    FolderResponse,
    AssignFoliosRequest,
    create_folder,
    update_folder,
    delete_folder,
    get_folders_tree,
    assign_folios_to_folder
)

def test_folder_type_enum():
    assert FolderType.root.value == "root"
    assert FolderType.parish.value == "parish"
    assert FolderType.series.value == "series"
    assert FolderType.tome.value == "tome"
    
    with pytest.raises(ValueError):
        FolderType("invalid_type")

def test_folder_metadata():
    meta = FolderMetadata(
        tome_number="1",
        year_start=1850,
        year_end=1875,
        location="Estante A",
        template_id="uuid-template",
        parish_name="San José",
        diocese_name="Carúpano"
    )
    assert meta.tome_number == "1"
    assert meta.year_start == 1850
    assert meta.year_end == 1875
    assert meta.location == "Estante A"
    assert meta.template_id == "uuid-template"
    assert meta.parish_name == "San José"
    assert meta.diocese_name == "Carúpano"

def test_folder_create_defaults():
    create_req = FolderCreate(name="Libro 1")
    assert create_req.name == "Libro 1"
    assert create_req.folder_type == FolderType.tome
    assert create_req.parent_id is None
    assert create_req.metadata is None

def test_folder_update_optional():
    update_req = FolderUpdate(name="Nuevo Nombre")
    assert update_req.name == "Nuevo Nombre"
    assert update_req.metadata is None

def test_folder_response():
    resp = FolderResponse(
        id="folder-123",
        tenant_id="tenant-456",
        name="Tomo I",
        folder_type="tome"
    )
    assert resp.total_folios == 0
    assert resp.total_entries == 0
    assert resp.parent_id is None

def test_assign_folios_request():
    req = AssignFoliosRequest(folio_ids=["f1", "f2", "f3"])
    assert len(req.folio_ids) == 3
    assert req.folio_ids[0] == "f1"

# Tests for RBAC and Endpoints Logic
class MockTable:
    def __init__(self, data=None):
        self._data = data or []
        self._last_op = None
        self._filters = {}

    def select(self, *args, **kwargs):
        return self

    def insert(self, payload):
        item = {**payload, "id": "new-id-123"}
        self._data.append(item)
        self._last_inserted = item
        return self

    def update(self, payload):
        self._last_updated = payload
        return self

    def delete(self):
        self._deleted = True
        return self

    def eq(self, field, value):
        self._filters[field] = value
        return self

    def order(self, field, **kwargs):
        return self

    def limit(self, n):
        return self

    def execute(self):
        class Result:
            pass
        res = Result()
        res.data = self._data
        return res

class MockSupabase:
    def __init__(self):
        self.tables = {}

    def table(self, name):
        if name not in self.tables:
            self.tables[name] = MockTable()
        return self.tables[name]

def test_create_folder_rbac_digitizer_forbidden():
    auth = {"role": "digitizer", "tenant_id": "tenant-1", "user_id": "user-1"}
    req = FolderCreate(name="Subcarpeta")
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(create_folder(folder_in=req, auth=auth))
    assert exc_info.value.status_code == 403
    assert "solo administradores o archivistas" in exc_info.value.detail

def test_update_folder_rbac_digitizer_forbidden():
    auth = {"role": "digitizer", "tenant_id": "tenant-1", "user_id": "user-1"}
    req = FolderUpdate(name="Nombre Editado")
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(update_folder(folder_id="f1", folder_in=req, auth=auth))
    assert exc_info.value.status_code == 403

def test_delete_folder_rbac_digitizer_forbidden():
    auth = {"role": "digitizer", "tenant_id": "tenant-1", "user_id": "user-1"}
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(delete_folder(folder_id="f1", auth=auth))
    assert exc_info.value.status_code == 403

def test_assign_folios_rbac_digitizer_forbidden():
    auth = {"role": "digitizer", "tenant_id": "tenant-1", "user_id": "user-1"}
    req = AssignFoliosRequest(folio_ids=["fol-1"])
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(assign_folios_to_folder(folder_id="f1", request=req, auth=auth))
    assert exc_info.value.status_code == 403
