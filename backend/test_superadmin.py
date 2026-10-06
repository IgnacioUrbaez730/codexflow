import pytest
from fastapi import HTTPException
from unittest.mock import patch, MagicMock
from main import get_superadmin_context

@pytest.mark.asyncio
async def test_get_superadmin_context_missing_auth():
    with pytest.raises(HTTPException) as exc:
        await get_superadmin_context(authorization="")
    assert exc.value.status_code == 401

@pytest.mark.asyncio
@patch("main.supabase")
async def test_get_superadmin_context_invalid_token(mock_supabase):
    mock_supabase.auth.get_user.return_value = None
    with pytest.raises(HTTPException) as exc:
        await get_superadmin_context(authorization="Bearer badtoken")
    assert exc.value.status_code == 401

@pytest.mark.asyncio
@patch("main.supabase")
async def test_get_superadmin_context_not_superadmin(mock_supabase):
    mock_user = MagicMock()
    mock_user.user.id = "user123"
    mock_supabase.auth.get_user.return_value = mock_user
    
    mock_response = MagicMock()
    mock_response.data = [{"role": "admin"}]
    mock_supabase.table().select().eq().execute.return_value = mock_response

    with pytest.raises(HTTPException) as exc:
        await get_superadmin_context(authorization="Bearer validtoken")
    assert exc.value.status_code == 403
    assert "Superadmin access required" in str(exc.value.detail)

@pytest.mark.asyncio
@patch("main.supabase")
async def test_get_superadmin_context_is_superadmin(mock_supabase):
    mock_user = MagicMock()
    mock_user.user.id = "user123"
    mock_supabase.auth.get_user.return_value = mock_user
    
    mock_response = MagicMock()
    mock_response.data = [{"role": "superadmin"}]
    mock_supabase.table().select().eq().execute.return_value = mock_response

    context = await get_superadmin_context(authorization="Bearer validtoken")
    assert context["user_id"] == "user123"
    assert context["role"] == "superadmin"
