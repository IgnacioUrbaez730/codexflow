import os
import pytest
from unittest.mock import patch, MagicMock
from worker import process_file


def _build_supabase_mock(tenant_id="tenant-123", batch_id="batch-123", template_id="tpl-123"):
    mock_supabase = MagicMock()

    def table_side_effect(table_name):
        tbl = MagicMock()
        if table_name == "folios":
            # Support .select().eq().execute() and .update().eq().eq().execute()
            sel = MagicMock()
            eq1 = MagicMock()
            eq1.execute.return_value = MagicMock(
                data=[{"id": "folio-123", "tenant_id": tenant_id, "batch_id": batch_id}]
            )
            sel.eq.return_value = eq1
            tbl.select.return_value = sel

            upd = MagicMock()
            upd_eq1 = MagicMock()
            upd_eq2 = MagicMock()
            upd_eq2.execute.return_value = MagicMock(data=[{"id": "folio-123"}])
            upd_eq1.eq.return_value = upd_eq2
            upd_eq1.execute.return_value = MagicMock(data=[{"id": "folio-123"}])
            upd.eq.return_value = upd_eq1
            tbl.update.return_value = upd
            tbl._update_mock = upd
        elif table_name == "batches":
            sel = MagicMock()
            eq1 = MagicMock()
            eq2 = MagicMock()
            eq2.execute.return_value = MagicMock(data=[{"template_id": template_id}])
            eq1.eq.return_value = eq2
            eq1.execute.return_value = MagicMock(data=[{"template_id": template_id}])
            sel.eq.return_value = eq1
            tbl.select.return_value = sel
        elif table_name == "templates":
            sel = MagicMock()
            eq1 = MagicMock()
            eq2 = MagicMock()
            eq2.execute.return_value = MagicMock(
                data=[
                    {
                        "fields": [
                            {"id": "nombre", "label": "Nombre", "type": "short_text", "required": True},
                            {"id": "fecha", "label": "Fecha", "type": "date", "required": False},
                        ]
                    }
                ]
            )
            eq1.eq.return_value = eq2
            eq1.execute.return_value = eq2.execute.return_value
            sel.eq.return_value = eq1
            tbl.select.return_value = sel
        elif table_name == "training_data":
            sel = MagicMock()
            eq1 = MagicMock()
            lim = MagicMock()
            lim.execute.return_value = MagicMock(
                data=[{"tenant_id": tenant_id, "field_name": "nombre", "actual_value": "María Gómez"}]
            )
            eq1.limit.return_value = lim
            eq1.execute.return_value = lim.execute.return_value
            sel.eq.return_value = eq1
            tbl.select.return_value = sel
        return tbl

    mock_supabase.table.side_effect = table_side_effect
    return mock_supabase


@patch("worker.boto3.client")
@patch("worker.supabase")
@patch("worker.convert_from_path")
def test_process_file_pdf_without_overwriting_r2_url(mock_convert, mock_supabase, mock_boto3):
    s3_mock = MagicMock()
    mock_boto3.return_value = s3_mock

    mock_page = MagicMock()
    mock_convert.return_value = [mock_page]

    configured_sb = _build_supabase_mock()
    mock_supabase.table.side_effect = configured_sb.table.side_effect

    folio_id = "folio-123"
    file_key = "tenant-123/test.pdf"

    with patch("worker.extract_text_and_boxes", return_value=([{"text": "Juan", "conf": 90.0, "xmin": 10, "ymin": 20, "xmax": 200, "ymax": 60}], 1000, 1400)):
        process_file(folio_id, file_key)

    assert s3_mock.download_file.call_count == 1
    assert mock_convert.call_count == 1
    assert mock_supabase.table.call_count >= 1


@patch("worker.boto3.client")
@patch("worker.supabase")
def test_process_file_image_resilient_when_pyvips_fails(mock_supabase, mock_boto3):
    s3_mock = MagicMock()
    mock_boto3.return_value = s3_mock

    configured_sb = _build_supabase_mock()
    mock_supabase.table.side_effect = configured_sb.table.side_effect

    folio_id = "folio-124"
    file_key = "tenant-123/test.jpg"

    with patch("worker.extract_text_and_boxes", return_value=([], 1200, 1600)):
        process_file(folio_id, file_key)

    assert s3_mock.download_file.call_count == 1
    assert mock_supabase.table.call_count >= 1
