import os
import pytest
from unittest.mock import patch, MagicMock
from worker import process_file

@patch("worker.boto3.client")
@patch("worker.supabase")
@patch("worker.convert_from_path")
@patch("worker.pyvips.Image.new_from_file")
@patch("worker.os.remove")
@patch("worker.shutil.rmtree")
def test_process_file_pdf(mock_rmtree, mock_remove, mock_vips, mock_convert, mock_supabase, mock_boto3):
    # Setup mock for boto3
    s3_mock = MagicMock()
    mock_boto3.return_value = s3_mock
    
    # Setup mock for pdf2image
    mock_page = MagicMock()
    mock_convert.return_value = [mock_page]
    
    # Setup mock for pyvips
    mock_vips_img = MagicMock()
    mock_vips.return_value = mock_vips_img
    
    folio_id = "folio-123"
    file_key = "uploads/test.pdf"
    
    # Call process
    process_file(folio_id, file_key)
    
    # Assert download
    assert s3_mock.download_file.call_count == 1
    
    # Assert pdf2image called
    assert mock_convert.call_count == 1
    
    # Assert vips dzsave called
    assert mock_vips_img.dzsave.call_count == 1
    
    # Assert upload
    assert s3_mock.upload_file.call_count >= 1
    
    # Assert supabase update
    assert mock_supabase.table.call_count >= 1

@patch("worker.boto3.client")
@patch("worker.supabase")
@patch("worker.pyvips.Image.new_from_file")
@patch("worker.os.remove")
@patch("worker.shutil.rmtree")
def test_process_file_image(mock_rmtree, mock_remove, mock_vips, mock_supabase, mock_boto3):
    s3_mock = MagicMock()
    mock_boto3.return_value = s3_mock
    
    mock_vips_img = MagicMock()
    mock_vips.return_value = mock_vips_img
    
    folio_id = "folio-124"
    file_key = "uploads/test.jpg"
    
    process_file(folio_id, file_key)
    
    assert s3_mock.download_file.call_count == 1
    assert mock_vips.call_count == 1
    assert mock_vips_img.dzsave.call_count == 1
    assert mock_supabase.table.call_count >= 1
