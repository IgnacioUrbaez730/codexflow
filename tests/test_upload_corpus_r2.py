"""
Tests unitarios y de integración para tools/seeding/upload_corpus_to_r2.py (Fase 2 de SPEC-015).
Valida:
1. Conexión y configuración de R2 / S3 mediante variables de entorno (Task 2.2).
2. Generación/síntesis de imágenes paleográficas realistas con dimensiones y nombres canónicos (Task 2.3).
3. Carga y sincronización mockeada hacia Cloudflare R2 con Content-Type y Cache-Control (Task 2.4).
4. Actualización y resolución de URLs públicas en corpus_manifest.json (Task 2.5).
"""

import os
import json
import pytest
from unittest.mock import MagicMock, patch

from tools.seeding.upload_corpus_to_r2 import (
    get_r2_config,
    create_s3_client,
    generate_paleographic_folio_image,
    generate_all_local_images,
    upload_folio_image,
    sync_corpus_to_r2,
    resolve_manifest_urls
)


def test_get_r2_config_defaults_and_env(monkeypatch):
    # Test fallback / defaults
    monkeypatch.delenv("R2_BUCKET_NAME", raising=False)
    monkeypatch.delenv("R2_ACCESS_KEY_ID", raising=False)
    monkeypatch.delenv("R2_SECRET_ACCESS_KEY", raising=False)
    monkeypatch.delenv("R2_ENDPOINT_URL", raising=False)
    monkeypatch.delenv("R2_PUBLIC_URL_PREFIX", raising=False)

    cfg = get_r2_config()
    assert cfg["bucket_name"] == "codexflow-folios"
    assert "pub-codexflow.r2.dev" in cfg["public_url_prefix"]

    # Test custom env vars
    monkeypatch.setenv("R2_BUCKET_NAME", "custom-bucket")
    monkeypatch.setenv("R2_ACCESS_KEY_ID", "test_key_id")
    monkeypatch.setenv("R2_SECRET_ACCESS_KEY", "test_secret_key")
    monkeypatch.setenv("R2_ENDPOINT_URL", "https://custom.r2.cloudflarestorage.com")
    monkeypatch.setenv("R2_PUBLIC_URL_PREFIX", "https://assets.custom.org")

    cfg_custom = get_r2_config()
    assert cfg_custom["bucket_name"] == "custom-bucket"
    assert cfg_custom["access_key_id"] == "test_key_id"
    assert cfg_custom["secret_access_key"] == "test_secret_key"
    assert cfg_custom["endpoint_url"] == "https://custom.r2.cloudflarestorage.com"
    assert cfg_custom["public_url_prefix"] == "https://assets.custom.org"


def test_create_s3_client_mock():
    cfg = {
        "access_key_id": "mock_id",
        "secret_access_key": "mock_secret",
        "endpoint_url": "https://test.r2.cloudflarestorage.com"
    }
    with patch("boto3.client") as mock_boto:
        mock_boto.return_value = MagicMock()
        client = create_s3_client(cfg)
        assert client is not None
        mock_boto.assert_called_once()
        args, kwargs = mock_boto.call_args
        assert args[0] == "s3"
        assert kwargs["endpoint_url"] == "https://test.r2.cloudflarestorage.com"
        assert kwargs["aws_access_key_id"] == "mock_id"


def test_generate_paleographic_folio_image(tmp_path):
    output_path = tmp_path / "CARUPANO_BAU_T01_F001R.jpg"
    metadata = {
        "canonical_filename": "CARUPANO_BAU_T01_F001R.jpg",
        "series": "bautismo",
        "folio_number": 1,
        "folio_side": "recto",
        "stress_case": "standard",
        "prompt": "Authentic 1885 Carupano baptism sacramental register page."
    }

    result_path = generate_paleographic_folio_image(metadata, str(output_path))
    assert os.path.exists(result_path)
    # Check that it's a valid JPEG file with non-zero size
    file_size = os.path.getsize(result_path)
    assert file_size > 1000  # JPEG with texture/render has realistic weight


def test_generate_all_local_images(tmp_path):
    # Test generation for subset of manifest
    sample_manifest = {
        "organization": "codexflow-folios",
        "folios": [
            {
                "canonical_filename": "CARUPANO_BAU_T01_F001R.jpg",
                "series": "bautismo",
                "folio_number": 1,
                "folio_side": "recto",
                "stress_case": "standard",
                "prompt": "Prompt 1"
            },
            {
                "canonical_filename": "CARUPANO_MAT_T01_F006DP.jpg",
                "series": "matrimonio",
                "folio_number": 6,
                "folio_side": "double_page",
                "stress_case": "double_page",
                "prompt": "Prompt 2"
            },
            {
                "canonical_filename": "CARUPANO_DEF_T01_F010V.jpg",
                "series": "defuncion",
                "folio_number": 10,
                "folio_side": "verso",
                "stress_case": "degraded",
                "prompt": "Prompt 3"
            }
        ]
    }
    
    generated_files = generate_all_local_images(sample_manifest, str(tmp_path))
    assert len(generated_files) == 3
    for fpath in generated_files:
        assert os.path.exists(fpath)
        assert os.path.getsize(fpath) > 0


def test_upload_folio_image_s3_call():
    mock_s3 = MagicMock()
    file_path = "/tmp/CARUPANO_BAU_T01_F001R.jpg"
    key = "corpus/bautismos/CARUPANO_BAU_T01_F001R.jpg"
    bucket = "codexflow-folios"

    with patch("os.path.exists", return_value=True):
        upload_folio_image(mock_s3, file_path, bucket, key)
        mock_s3.upload_file.assert_called_once()
        args, kwargs = mock_s3.upload_file.call_args
        assert args[0] == file_path
        assert args[1] == bucket
        assert args[2] == key
        assert kwargs["ExtraArgs"]["ContentType"] == "image/jpeg"
        assert "CacheControl" in kwargs["ExtraArgs"]


def test_resolve_manifest_urls():
    sample_manifest = {
        "folios": [
            {
                "series": "bautismo",
                "canonical_filename": "CARUPANO_BAU_T01_F001R.jpg",
                "remote_image_url": "https://pub-codexflow.r2.dev/corpus/bautismos/CARUPANO_BAU_T01_F001R.jpg"
            },
            {
                "series": "matrimonio",
                "canonical_filename": "CARUPANO_MAT_T01_F001R.jpg",
                "remote_image_url": "https://pub-codexflow.r2.dev/corpus/matrimonios/CARUPANO_MAT_T01_F001R.jpg"
            },
            {
                "series": "defuncion",
                "canonical_filename": "CARUPANO_DEF_T01_F001R.jpg",
                "remote_image_url": "https://pub-codexflow.r2.dev/corpus/defunciones/CARUPANO_DEF_T01_F001R.jpg"
            }
        ]
    }

    updated = resolve_manifest_urls(sample_manifest, "https://cdn.myheritage.org")
    assert updated["folios"][0]["remote_image_url"] == "https://cdn.myheritage.org/corpus/bautismos/CARUPANO_BAU_T01_F001R.jpg"
    assert updated["folios"][1]["remote_image_url"] == "https://cdn.myheritage.org/corpus/matrimonios/CARUPANO_MAT_T01_F001R.jpg"
    assert updated["folios"][2]["remote_image_url"] == "https://cdn.myheritage.org/corpus/defunciones/CARUPANO_DEF_T01_F001R.jpg"


def test_sync_corpus_to_r2_dry_run(tmp_path):
    # In dry run mode, it shouldn't connect to S3
    sample_manifest = {
        "folios": [
            {
                "series": "bautismo",
                "canonical_filename": "CARUPANO_BAU_T01_F001R.jpg",
                "remote_image_url": "https://pub-codexflow.r2.dev/corpus/bautismos/CARUPANO_BAU_T01_F001R.jpg",
                "prompt": "Test prompt"
            }
        ]
    }
    manifest_path = tmp_path / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(sample_manifest, f)

    results = sync_corpus_to_r2(str(manifest_path), images_dir=str(tmp_path), dry_run=True)
    assert len(results["synced"]) == 1
    assert results["dry_run"] is True
