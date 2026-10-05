import pytest
from unittest.mock import patch, MagicMock
from backend.ai_engine import extract_text_and_boxes

def test_extract_text_and_boxes():
    mock_data = {
        'level': [1, 2, 3],
        'text': [' ', 'Hello', 'World'],
        'conf': ['-1', '95', '8'],
        'left': [0, 10, 50],
        'top': [0, 20, 20],
        'width': [100, 30, 40],
        'height': [100, 15, 15]
    }
    
    with patch('backend.ai_engine.Image.open') as mock_open:
        with patch('backend.ai_engine.pytesseract.image_to_data', return_value=mock_data) as mock_ocr:
            results = extract_text_and_boxes('dummy.jpg')
            
            # 1st: empty after strip -> skip
            # 2nd: 'Hello', conf 95 -> keep
            # 3rd: 'World', conf 8 < 10 -> skip
            
            assert len(results) == 1
            res = results[0]
            assert res['text'] == 'Hello'
            assert res['conf'] == 95.0
            assert res['xmin'] == 10
            assert res['ymin'] == 20
            assert res['xmax'] == 40
            assert res['ymax'] == 35
from backend.ai_engine import map_ocr_to_template

def test_map_ocr_to_template():
    ocr_data = [
        {'text': 'Invoice: 12345', 'conf': 95.0, 'xmin': 10, 'ymin': 10, 'xmax': 100, 'ymax': 20},
        {'text': 'Total: $100.00', 'conf': 90.0, 'xmin': 10, 'ymin': 30, 'xmax': 100, 'ymax': 40},
        {'text': 'Invoice: 999', 'conf': 80.0, 'xmin': 200, 'ymin': 200, 'xmax': 250, 'ymax': 220},
    ]
    
    template = {
        'invoice_number': {'regex_pattern': r'Invoice:\s*\d+'},
        'total_amount': {'regex_pattern': r'\$\d+\.\d{2}'},
        'no_match': {'regex_pattern': r'XYZ'}
    }
    
    result = map_ocr_to_template(ocr_data, template)
    
    assert isinstance(result, list)
    assert len(result) == 2
    
    invoice = next(r for r in result if r['field_name'] == 'invoice_number')
    assert invoice['confidence'] == 95.0
    assert invoice['predicted_value'] == 'Invoice: 12345'
    
    total = next(r for r in result if r['field_name'] == 'total_amount')
    assert total['predicted_value'] == 'Total: $100.00'
    
    assert not any(r['field_name'] == 'no_match' for r in result)
