#!/usr/bin/env python3
"""
Test Suite: test_auth_cache.py
Frente 2 / T03-F2-01 y T03-F2-02: Caché en memoria TTL (5 min) para get_auth_context
e invalidación reactiva ante cambios en user_profiles.
"""

import os
import sys
import time
import hashlib
from pathlib import Path
from unittest.mock import MagicMock, patch

# Configurar sys.path para importar backend.main
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(BACKEND_DIR))

# Cargar variables de entorno si existen
env_file = BACKEND_DIR / ".env"
if env_file.exists():
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

import unittest
import asyncio
from backend.main import (
    app,
    get_auth_context,
    _AUTH_CACHE,
    AUTH_CACHE_TTL_SECONDS,
    invalidate_auth_cache_for_user,
    supabase as main_supabase,
)


class TestAuthCache(unittest.TestCase):
    def setUp(self):
        _AUTH_CACHE.clear()
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)
        self.test_token = "mock-bearer-token-12345"
        self.token_hash = hashlib.sha256(self.test_token.encode("utf-8")).hexdigest()
        self.test_user_id = "user-cache-test-uuid-99"
        self.test_tenant_id = "4bf4e846-b22d-4105-aacf-3751cc0de60c"

        self.mock_auth_user = MagicMock()
        self.mock_auth_user.user.id = self.test_user_id
        self.mock_auth_user.user.email = "cache_tester@codexflow.internal"

        self.mock_profile_data = [{
            "tenant_id": self.test_tenant_id,
            "role": "digitizer",
            "is_active": True,
            "tenants": {"is_active": True}
        }]

    def tearDown(self):
        self.loop.close()
        _AUTH_CACHE.clear()

    def test_cache_population_and_hit(self):
        """Valida que la 1ra petición popule la caché y la 2da use el caché sin tocar Supabase."""
        with patch.object(main_supabase.auth, "get_user", return_value=self.mock_auth_user) as mock_get_user, \
             patch.object(main_supabase, "table") as mock_table:

            mock_query = MagicMock()
            mock_query.select.return_value = mock_query
            mock_query.eq.return_value = mock_query
            mock_query.execute.return_value = MagicMock(data=self.mock_profile_data)
            mock_table.return_value = mock_query

            # Primera llamada: debe consultar Supabase y almacenar en _AUTH_CACHE
            auth_ctx1 = self.loop.run_until_complete(get_auth_context(authorization=f"Bearer {self.test_token}"))
            self.assertEqual(auth_ctx1["user_id"], self.test_user_id)
            self.assertEqual(auth_ctx1["tenant_id"], self.test_tenant_id)
            self.assertEqual(auth_ctx1["role"], "digitizer")
            self.assertIn(self.token_hash, _AUTH_CACHE, "El hash del token debe existir en _AUTH_CACHE")
            self.assertEqual(mock_get_user.call_count, 1, "Supabase auth.get_user debió llamarse exactamente una vez")

            # Segunda llamada con el mismo token: debe servirse de caché sin tocar Supabase
            auth_ctx2 = self.loop.run_until_complete(get_auth_context(authorization=f"Bearer {self.test_token}"))
            self.assertEqual(auth_ctx2["user_id"], self.test_user_id)
            self.assertEqual(auth_ctx2["role"], "digitizer")
            self.assertEqual(mock_get_user.call_count, 1, "Supabase auth.get_user NO debió llamarse en la segunda petición (servida de caché)")

    def test_cache_ttl_expiration(self):
        """Valida que entradas expiradas por TTL (> 300 s) refresquen desde Supabase."""
        with patch.object(main_supabase.auth, "get_user", return_value=self.mock_auth_user) as mock_get_user, \
             patch.object(main_supabase, "table") as mock_table:

            mock_query = MagicMock()
            mock_query.select.return_value = mock_query
            mock_query.eq.return_value = mock_query
            mock_query.execute.return_value = MagicMock(data=self.mock_profile_data)
            mock_table.return_value = mock_query

            auth_ctx1 = self.loop.run_until_complete(get_auth_context(authorization=f"Bearer {self.test_token}"))
            self.assertEqual(mock_get_user.call_count, 1)

            # Forzar timestamp antiguo en la entrada de caché
            old_time = time.time() - (AUTH_CACHE_TTL_SECONDS + 10)
            _AUTH_CACHE[self.token_hash] = (old_time, auth_ctx1)

            auth_ctx3 = self.loop.run_until_complete(get_auth_context(authorization=f"Bearer {self.test_token}"))
            self.assertEqual(mock_get_user.call_count, 2, "Al expirar el TTL, Supabase auth.get_user debió llamarse nuevamente")

    def test_reactive_cache_invalidation(self):
        """Valida que invalidate_auth_cache_for_user purgue reactivamente la entrada de caché."""
        with patch.object(main_supabase.auth, "get_user", return_value=self.mock_auth_user) as mock_get_user, \
             patch.object(main_supabase, "table") as mock_table:

            mock_query = MagicMock()
            mock_query.select.return_value = mock_query
            mock_query.eq.return_value = mock_query
            mock_query.execute.return_value = MagicMock(data=self.mock_profile_data)
            mock_table.return_value = mock_query

            auth_ctx1 = self.loop.run_until_complete(get_auth_context(authorization=f"Bearer {self.test_token}"))
            self.assertIn(self.token_hash, _AUTH_CACHE, "La clave debe existir antes de invalidar")

            invalidate_auth_cache_for_user(self.test_user_id)
            self.assertNotIn(self.token_hash, _AUTH_CACHE, "invalidate_auth_cache_for_user debió purgar la entrada de la caché")

            # Próxima llamada vuelve a consultar porque fue invalidado reactivamente
            auth_ctx4 = self.loop.run_until_complete(get_auth_context(authorization=f"Bearer {self.test_token}"))
            self.assertEqual(mock_get_user.call_count, 2, "Tras invalidación reactiva, se consulta Supabase de inmediato")


if __name__ == "__main__":
    unittest.main()
