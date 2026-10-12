import pytest
from unittest.mock import patch, MagicMock
from PIL import Image, ImageDraw
from backend.ai_engine import (
    extract_text_and_boxes,
    generate_template_ai_predictions,
    map_ocr_to_template,
)


def test_extract_text_and_boxes():
    mock_data = {
        "level": [1, 2, 3],
        "text": [" ", "Hello", "World"],
        "conf": ["-1", "95", "8"],
        "left": [0, 10, 50],
        "top": [0, 20, 20],
        "width": [100, 30, 40],
        "height": [100, 15, 15],
    }

    mock_img = MagicMock()
    mock_img.size = (1000, 1400)

    with patch("backend.ai_engine.Image.open", return_value=mock_img):
        with patch("backend.ai_engine.pytesseract.image_to_data", return_value=mock_data):
            out = extract_text_and_boxes("dummy.jpg")
            assert isinstance(out, tuple)
            results, width, height = out

            assert width == 1000
            assert height == 1400
            assert len(results) == 1
            res = results[0]
            assert res["text"] == "Hello"
            assert res["conf"] == 95.0
            assert res["xmin"] == 10
            assert res["ymin"] == 20
            assert res["xmax"] == 40
            assert res["ymax"] == 35


def test_extract_text_and_boxes_pil_vision_fallback(tmp_path):
    # Create a real synthetic manuscript image with dark horizontal lines of ink
    img_path = tmp_path / "manuscript.jpg"
    img = Image.new("RGB", (800, 1000), color=(245, 242, 235))
    draw = ImageDraw.Draw(img)
    # Draw 4 horizontal ink lines across the document
    for y in [180, 320, 460, 620]:
        draw.rectangle([100, y, 680, y + 22], fill=(25, 25, 25))
    img.save(str(img_path))

    with patch(
        "backend.ai_engine.pytesseract.image_to_data",
        side_effect=RuntimeError("tesseract is not installed"),
    ):
        boxes, width, height = extract_text_and_boxes(str(img_path))
        assert width == 800
        assert height == 1000
        assert len(boxes) >= 4
        for b in boxes:
            assert "xmin" in b and "ymin" in b and "xmax" in b and "ymax" in b
            assert 0 <= b["xmin"] < b["xmax"] <= width
            assert 0 <= b["ymin"] < b["ymax"] <= height


def test_generate_template_ai_predictions():
    template_fields = [
        {"id": "nombre_bautizado", "label": "Nombre del Bautizado", "type": "short_text", "required": True},
        {"id": "fecha_sacramento", "label": "Fecha del Sacramento", "type": "date", "required": True},
        {"id": "tipo_evento", "label": "Tipo de Evento", "type": "dropdown", "options": ["Bautismo", "Matrimonio"]},
    ]
    ocr_boxes = [
        {"text": "", "conf": 82.0, "xmin": 120, "ymin": 200, "xmax": 900, "ymax": 260},
        {"text": "1895-04-12", "conf": 88.0, "xmin": 140, "ymin": 340, "xmax": 600, "ymax": 395},
    ]
    training_rows = [
        {
            "tenant_id": "tenant-1",
            "field_name": "nombre_bautizado",
            "predicted_value": "",
            "actual_value": "Juan Bautista Pérez",
            "action_type": "corrected_text",
        }
    ]

    preds = generate_template_ai_predictions(
        template_fields=template_fields,
        ocr_boxes=ocr_boxes,
        img_width=1200,
        img_height=1600,
        training_rows=training_rows,
        folio_id="folio-12345678-abcd",
    )

    assert len(preds) == 3
    for p in preds:
        assert "bbox" in p
        assert 0.0 <= p["bbox"]["x"] <= 1.0
        assert 0.0 <= p["bbox"]["y"] <= 1.0
        assert 0.0 < p["bbox"]["width"] <= 1.0
        assert 0.0 < p["bbox"]["height"] <= 1.0
        assert "bbox_array" in p and len(p["bbox_array"]) == 4
        assert "bbox_coords" in p and len(p["bbox_coords"]) == 4
        assert p["modelVersion"] == "v2.0-active-learning"
        assert p["isValidSyntax"] is True

    # Check active learning suggestion
    p_name = next(p for p in preds if p["fieldKey"] == "nombre_bautizado")
    assert p_name["suggestedText"] == "Juan Bautista Pérez"

    # Check date format validity when confidence >= 0.80
    p_date = next(p for p in preds if p["fieldKey"] == "fecha_sacramento")
    if p_date["confidence"] >= 0.80:
        import re
        assert re.match(r"^\d{4}-\d{2}-\d{2}$", p_date["suggestedText"])


def test_map_ocr_to_template():
    ocr_data = [
        {"text": "Invoice: 12345", "conf": 95.0, "xmin": 10, "ymin": 10, "xmax": 100, "ymax": 20},
        {"text": "Total: $100.00", "conf": 90.0, "xmin": 10, "ymin": 30, "xmax": 100, "ymax": 40},
        {"text": "Invoice: 999", "conf": 80.0, "xmin": 200, "ymin": 200, "xmax": 250, "ymax": 220},
    ]

    template = {
        "invoice_number": {"regex_pattern": r"Invoice:\s*\d+"},
        "total_amount": {"regex_pattern": r"\$\d+\.\d{2}"},
        "no_match": {"regex_pattern": r"XYZ"},
    }

    result = map_ocr_to_template(ocr_data, template)

    assert isinstance(result, list)
    assert len(result) == 2

    invoice = next(r for r in result if r["field_name"] == "invoice_number")
    assert invoice["confidence"] == 95.0
    assert invoice["predicted_value"] == "Invoice: 12345"

    total = next(r for r in result if r["field_name"] == "total_amount")
    assert total["predicted_value"] == "Total: $100.00"

    assert not any(r["field_name"] == "no_match" for r in result)
