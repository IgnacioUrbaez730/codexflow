"""
tools/seeding/test_phase2_phase3.py

Tests unitarios para verificar la Fase 2 (Pipeline de Imágenes Paleográficas / R2)
y la Fase 3 (Seeding Idempotente del Corpus en Base de Datos).
"""

import os
import sys
import json
import unittest
from unittest.mock import MagicMock, patch

# Asegurar que el path del proyecto esté disponible
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from tools.seeding.upload_corpus_to_r2 import (
    generate_paleographic_svg,
    generate_paleographic_folio_image,
    generate_all_local_images,
    resolve_manifest_urls,
    get_r2_config,
    SERIES_FOLDER_MAP
)


class TestCorpusPhase2(unittest.TestCase):
    def setUp(self):
        self.manifest_path = os.path.join(os.path.dirname(__file__), "corpus_manifest.json")
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            self.manifest = json.load(f)

    def test_manifest_structure(self):
        self.assertEqual(len(self.manifest["volumes"]), 3)
        self.assertEqual(len(self.manifest["folios"]), 60)
        
        # 20 de cada serie
        bautismos = [f for f in self.manifest["folios"] if f["series"] == "bautismo"]
        matrimonios = [f for f in self.manifest["folios"] if f["series"] == "matrimonio"]
        defunciones = [f for f in self.manifest["folios"] if f["series"] == "defuncion"]
        self.assertEqual(len(bautismos), 20)
        self.assertEqual(len(matrimonios), 20)
        self.assertEqual(len(defunciones), 20)

    def test_generate_paleographic_svg(self):
        metadata = {
            "series": "bautismo",
            "folio_number": 1,
            "folio_side": "recto",
            "canonical_filename": "CARUPANO_BAU_T01_F001R.jpg",
            "stress_case": "standard"
        }
        svg = generate_paleographic_svg(metadata)
        self.assertIn("<svg", svg)
        self.assertIn("PARROQUIA SANTA ROSA DE CARÚPANO", svg)
        self.assertIn("FOLIO 1", svg)
        self.assertIn("RECTO", svg)

    def test_generate_paleographic_svg_double_page(self):
        metadata = {
            "series": "bautismo",
            "folio_number": 6,
            "folio_side": "double_page",
            "canonical_filename": "CARUPANO_BAU_T01_F006DP.jpg",
            "stress_case": "double_page"
        }
        svg = generate_paleographic_svg(metadata)
        self.assertIn("<svg", svg)
        self.assertIn('viewBox="0 0 2400 1600"', svg)
        self.assertIn("F006DP", svg)

    def test_resolve_manifest_urls(self):
        test_manifest = {
            "folios": [
                {
                    "series": "bautismo",
                    "canonical_filename": "CARUPANO_BAU_T01_F001R.jpg"
                }
            ]
        }
        resolved = resolve_manifest_urls(test_manifest, "https://my-r2.test")
        self.assertEqual(
            resolved["folios"][0]["remote_image_url"],
            "https://my-r2.test/corpus/bautismos/CARUPANO_BAU_T01_F001R.jpg"
        )


class TestCorpusPhase3(unittest.TestCase):
    def setUp(self):
        self.manifest_path = os.path.join(os.path.dirname(__file__), "corpus_manifest.json")
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            self.manifest = json.load(f)

    def test_seeding_script_import_and_dry_run(self):
        from tools.seeding.seed_realistic_corpus import (
            CorpusSeeder,
            TENANT_ID,
            ORGANIZATION_SLUG
        )
        self.assertEqual(ORGANIZATION_SLUG, "codexflow-folios")
        self.assertEqual(TENANT_ID, "4bf4e846-b22d-4105-aacf-3751cc0de60c")

        seeder = CorpusSeeder(manifest_path=self.manifest_path, dry_run=True)
        report = seeder.seed_corpus(series_filter="all", count=None)

        self.assertEqual(report["status"], "success")
        self.assertEqual(report["dry_run"], True)
        self.assertEqual(report["volumes_processed"], 3)
        self.assertEqual(report["folios_processed"], 60)
        self.assertGreater(report["entries_processed"], 0)

    def test_seeding_filter_type(self):
        from tools.seeding.seed_realistic_corpus import CorpusSeeder
        seeder = CorpusSeeder(manifest_path=self.manifest_path, dry_run=True)
        report_bau = seeder.seed_corpus(series_filter="bautismo", count=None)
        self.assertEqual(report_bau["volumes_processed"], 1)
        self.assertEqual(report_bau["folios_processed"], 20)

    def test_continued_entries_resolution(self):
        from tools.seeding.seed_realistic_corpus import CorpusSeeder
        seeder = CorpusSeeder(manifest_path=self.manifest_path, dry_run=True)
        # Buscar en bautismo folios 8 y 9
        f8 = [f for f in self.manifest["folios"] if f["series"] == "bautismo" and f["folio_number"] == 8][0]
        f9 = [f for f in self.manifest["folios"] if f["series"] == "bautismo" and f["folio_number"] == 9][0]
        self.assertTrue(f8["entries"][0].get("is_continued_to_next"))
        self.assertTrue(f9["entries"][0].get("is_continued"))


if __name__ == "__main__":
    unittest.main()
