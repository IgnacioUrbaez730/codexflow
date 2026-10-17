import pytest

def extract_record_fields(raw_meta):
    if not isinstance(raw_meta, dict):
        raw_meta = {}

    meta = raw_meta.get("data") if isinstance(raw_meta.get("data"), dict) and len(raw_meta.get("data")) > 0 else raw_meta

    first_name = (meta.get("first_name") or meta.get("primer_nombre") or meta.get("nombres") or meta.get("nombre") or meta.get("difunto_nombres") or "").strip()
    last_name = (meta.get("last_name") or meta.get("apellidos") or meta.get("apellido") or meta.get("difunto_apellidos") or "").strip()

    full_name = f"{first_name} {last_name}".strip()
    if not full_name:
        full_name = (
            meta.get("bautizado") or 
            meta.get("nombre_completo") or 
            meta.get("nombre_bautizado") or 
            meta.get("difunto") or 
            meta.get("nombre_difunto") or
            ""
        )
    if not full_name and (meta.get("novio_nombres") or meta.get("novia_nombres") or meta.get("contrayente_1") or meta.get("contrayente_2")):
        novio = f"{meta.get('novio_nombres', '')} {meta.get('novio_apellidos', '')}".strip() or meta.get("contrayente_1", "").strip()
        novia = f"{meta.get('novia_nombres', '')} {meta.get('novia_apellidos', '')}".strip() or meta.get("contrayente_2", "").strip()
        full_name = f"{novio} y {novia}".strip(" y ")

    principal_person = full_name or "Sin titular registrado"

    event_date = (
        meta.get("event_date") or 
        meta.get("fecha_sacramento") or 
        meta.get("fecha_matrimonio") or 
        meta.get("fecha_defuncion") or 
        meta.get("fecha_entierro") or 
        meta.get("fecha_bautismo") or 
        meta.get("fecha_acta") or 
        meta.get("fecha") or 
        ""
    ).strip()
    birth_date = (meta.get("birth_date") or meta.get("fecha_nacimiento") or "").strip()
    record_type = (
        raw_meta.get("entry_type") or 
        meta.get("record_type") or 
        meta.get("tipo_acta") or 
        "Partida"
    ).capitalize()

    return {
        "principal_person": principal_person,
        "event_date": event_date,
        "birth_date": birth_date,
        "record_type": record_type
    }


def test_baptism_nested_data():
    raw_meta = {
        'data': {
            'bautizado': 'José Francisco Alcalá Gómez',
            'nombres': 'José Francisco',
            'apellidos': 'Alcalá Gómez',
            'fecha_sacramento': '1885-01-14'
        },
        'entry_type': 'bautismo'
    }
    res = extract_record_fields(raw_meta)
    assert res["principal_person"] == "José Francisco Alcalá Gómez"
    assert res["event_date"] == "1885-01-14"
    assert res["record_type"] == "Bautismo"


def test_marriage_nested_data():
    raw_meta = {
        'data': {
            'novio_nombres': 'Juan',
            'novio_apellidos': 'Pérez',
            'novia_nombres': 'María',
            'novia_apellidos': 'González',
            'fecha_matrimonio': '1910-06-20'
        },
        'entry_type': 'matrimonio'
    }
    res = extract_record_fields(raw_meta)
    assert res["principal_person"] == "Juan Pérez y María González"
    assert res["event_date"] == "1910-06-20"
    assert res["record_type"] == "Matrimonio"


def test_death_nested_data():
    raw_meta = {
        'data': {
            'difunto_nombres': 'Antonio',
            'difunto_apellidos': 'Sánchez',
            'fecha_defuncion': '1940-03-12'
        },
        'entry_type': 'defunción'
    }
    res = extract_record_fields(raw_meta)
    assert res["principal_person"] == "Antonio Sánchez"
    assert res["event_date"] == "1940-03-12"
    assert res["record_type"] == "Defunción"


def test_death_with_difunto_string():
    raw_meta = {
        'data': {
            'difunto': 'Antonio Sánchez',
            'fecha_entierro': '1940-03-13'
        },
        'entry_type': 'defuncion'
    }
    res = extract_record_fields(raw_meta)
    assert res["principal_person"] == "Antonio Sánchez"
    assert res["event_date"] == "1940-03-13"
    assert res["record_type"] == "Defuncion"


def test_flat_metadata():
    raw_meta = {
        'primer_nombre': 'Pedro',
        'apellido': 'Infante',
        'fecha_acta': '1917-11-18',
        'record_type': 'nacimiento'
    }
    res = extract_record_fields(raw_meta)
    assert res["principal_person"] == "Pedro Infante"
    assert res["event_date"] == "1917-11-18"
    assert res["record_type"] == "Nacimiento"


def test_empty_metadata():
    res = extract_record_fields({})
    assert res["principal_person"] == "Sin titular registrado"
    assert res["event_date"] == ""
    assert res["record_type"] == "Partida"


if __name__ == "__main__":
    test_baptism_nested_data()
    test_marriage_nested_data()
    test_death_nested_data()
    test_death_with_difunto_string()
    test_flat_metadata()
    test_empty_metadata()
    print("All tests passed successfully!")
