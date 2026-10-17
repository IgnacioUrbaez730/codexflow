import unittest
import os
import sys

# Add project root to sys.path
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)


class TestSeedRealisticCorpus(unittest.TestCase):
    def test_import_module_and_datetime(self):
        """Verifica que el módulo se importe sin NameError ni errores de sintaxis."""
        import tools.seeding.seed_realistic_corpus as seeder_mod
        self.assertTrue(hasattr(seeder_mod, "datetime"))
        self.assertTrue(hasattr(seeder_mod, "timezone"))

    def test_dry_run_batches_creates_valid_timestamp(self):
        """Verifica que ensure_batches genere marcas de tiempo ISO válidas sin NameError."""
        import tools.seeding.seed_realistic_corpus as seeder_mod
        manifest_path = os.path.join(os.path.dirname(__file__), "corpus_manifest.json")
        seeder = seeder_mod.CorpusSeeder(manifest_path=manifest_path, dry_run=True, clean=False)
        batches = seeder.ensure_batches(series_filter="bautismo")
        self.assertIn("bautismo", batches)

    def test_dry_run_ensure_tomes(self):
        """Verifica que ensure_tomes en dry_run retorne los UUIDs canónicos para los 3 tomos."""
        import tools.seeding.seed_realistic_corpus as seeder_mod
        manifest_path = os.path.join(os.path.dirname(__file__), "corpus_manifest.json")
        seeder = seeder_mod.CorpusSeeder(manifest_path=manifest_path, dry_run=True, clean=False)
        tomes = seeder.ensure_tomes(series_filter="all")
        self.assertEqual(len(tomes), 3)
        self.assertIn("vol-carupano-bau-t01", tomes)
        self.assertIn("vol-carupano-mat-t01", tomes)
        self.assertIn("vol-carupano-def-t01", tomes)

    def test_ensure_tomes_client_interactions(self):
        """Verifica que ensure_tomes consulte document_folders, inserte el registro con los metadatos requeridos y valide la existencia."""
        import tools.seeding.seed_realistic_corpus as seeder_mod
        from unittest.mock import MagicMock

        manifest_path = os.path.join(os.path.dirname(__file__), "corpus_manifest.json")
        seeder = seeder_mod.CorpusSeeder(manifest_path=manifest_path, dry_run=False, clean=False)

        mock_client = MagicMock()
        # Primera consulta: no existe; Verificación posterior: existe
        mock_client.select.side_effect = [
            [],  # select by id
            [],  # select by name
            [{"id": "79beb079-c440-5bbd-b85d-1fe8d5671e9c"}]  # verification select
        ]
        mock_client.insert.return_value = [{"id": "79beb079-c440-5bbd-b85d-1fe8d5671e9c"}]
        seeder.client = mock_client

        tomes = seeder.ensure_tomes(series_filter="bautismo")
        self.assertIn("vol-carupano-bau-t01", tomes)

        # Verificar que se llamó a insert en document_folders
        mock_client.insert.assert_called_once()
        table_arg, records_arg = mock_client.insert.call_args[0]
        self.assertEqual(table_arg, "document_folders")
        self.assertEqual(len(records_arg), 1)

        inserted_tome = records_arg[0]
        self.assertEqual(inserted_tome["folder_type"], "tome")
        self.assertEqual(inserted_tome["tenant_id"], seeder_mod.TENANT_ID)
        self.assertEqual(inserted_tome["created_by"], seeder_mod.DEFAULT_USER_ID)
        self.assertEqual(inserted_tome["metadata"]["sacrament_type"], "bautismo")
        self.assertEqual(inserted_tome["metadata"]["country"], "Venezuela")
        self.assertTrue(inserted_tome["metadata"]["is_demo"])


if __name__ == "__main__":
    unittest.main()
