"""
tests/test_seed_realistic_corpus.py
Tests unitarios para la asignación de batch_id en seed_realistic_corpus.py
"""

import os
import unittest
from tools.seeding.seed_realistic_corpus import CorpusSeeder, TENANT_ID, DEFAULT_USER_ID


class TestSeedRealisticCorpusBatch(unittest.TestCase):
    def setUp(self):
        manifest_path = os.path.join(os.path.dirname(__file__), "..", "tools", "seeding", "corpus_manifest.json")
        self.seeder = CorpusSeeder(manifest_path=manifest_path, dry_run=True, clean=False)

    def test_ensure_batches_generates_all_series_batches(self):
        batch_map = self.seeder.ensure_batches(series_filter="all")
        self.assertIn("bautismo", batch_map)
        self.assertIn("matrimonio", batch_map)
        self.assertIn("defuncion", batch_map)
        for series, b_id in batch_map.items():
            self.assertTrue(len(b_id) > 0)

    def test_seed_corpus_dry_run_assigns_batch_id_to_folios(self):
        report = self.seeder.seed_corpus(series_filter="all", count=5)
        self.assertEqual(report["status"], "success")
        self.assertEqual(report["folios_processed"], 5)
        self.assertEqual(report["volumes_processed"], 3)


if __name__ == "__main__":
    unittest.main()
