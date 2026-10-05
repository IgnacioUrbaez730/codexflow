import pytesseract
from PIL import Image

def extract_text_and_boxes(image_path: str) -> list:
    """
    Extrae texto, confianza y bounding boxes de una imagen usando Tesseract OCR.
    Filtra resultados vacíos o con confianza menor a 10.
    Retorna una lista de diccionarios:
    [{'text': str, 'conf': float, 'xmin': int, 'ymin': int, 'xmax': int, 'ymax': int}]
    """
    try:
        img = Image.open(image_path)
    except Exception as e:
        print(f"Error opening image {image_path}: {e}")
        return []

    try:
        data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
    except Exception as e:
        print(f"Error running OCR: {e}")
        return []

    results = []
    n_boxes = len(data.get('level', []))
    for i in range(n_boxes):
        text = data['text'][i].strip() if isinstance(data['text'][i], str) else str(data['text'][i]).strip()
        conf_str = data['conf'][i]
        
        try:
            conf = float(conf_str)
        except (ValueError, TypeError):
            continue

        if text and conf >= 10:
            x = data['left'][i]
            y = data['top'][i]
            w = data['width'][i]
            h = data['height'][i]
            
            results.append({
                'text': text,
                'conf': conf,
                'xmin': x,
                'ymin': y,
                'xmax': x + w,
                'ymax': y + h
            })

    return results

import re

def map_ocr_to_template(ocr_data: list, template_schema: dict) -> dict:
    """
    Evalúa expresiones regulares sobre los textos extraídos por OCR.
    Devuelve un diccionario con la coincidencia de mayor confianza para cada campo.
    """
    results = {}
    for field_name, field_config in template_schema.items():
        pattern = field_config.get("regex_pattern")
        if not pattern:
            continue
            
        best_match = None
        highest_conf = -1.0
        
        try:
            regex = re.compile(pattern)
        except re.error:
            continue
            
        for box in ocr_data:
            text = box.get('text', '')
            conf = box.get('conf', 0.0)
            
            # Buscar en el texto completo usando el regex
            if regex.search(text):
                if conf > highest_conf:
                    highest_conf = conf
                    best_match = box
                    
        if best_match:
            results[field_name] = best_match
            
    return results
