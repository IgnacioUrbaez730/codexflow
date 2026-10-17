import json
import os

def generate_corpus_manifest():
    volumes = [
        {
            "id": "vol-carupano-bau-t01",
            "series": "bautismo",
            "tome_number": 1,
            "title": "Libro 1 de Bautismos (1885-1890)",
            "template_code": "BAUTISMO_CANONICO",
            "year_start": 1885,
            "year_end": 1890,
            "total_folios": 20
        },
        {
            "id": "vol-carupano-mat-t01",
            "series": "matrimonio",
            "tome_number": 1,
            "title": "Libro 1 de Matrimonios (1885-1895)",
            "template_code": "MATRIMONIO_CANONICO",
            "year_start": 1885,
            "year_end": 1895,
            "total_folios": 20
        },
        {
            "id": "vol-carupano-def-t01",
            "series": "defuncion",
            "tome_number": 1,
            "title": "Libro 1 de Defunciones (1885-1892)",
            "template_code": "DEFUNCION_CANONICA",
            "year_start": 1885,
            "year_end": 1892,
            "total_folios": 20
        }
    ]

    folios = []

    # Helper definitions
    # F001-F005: completed, standard (R, V, R, V, R)
    # F006-F007: double_page (F006 completed, F007 pending)
    # F008-F009: continued (F008V -> F009R), both completed
    # F010-F012: degraded, pending
    # F013-F014: doubtful/mutilated, pending
    # F015: blank (auto de visita), blank
    # F016-F017: marginal_notes, completed
    # F018-F020: standard, pending

    # 1. BAUTISMOS
    bau_data = [
        # 1: F001R
        {
            "seq": 1, "folio": 1, "side": "recto", "code": "R", "status": "completed", "stress": "standard",
            "prompt": "Authentic 1885 Carupano baptism sacramental register page, folio 1 recto, high resolution historical photograph, sepia toned laid rag paper with slight edge browning, neat Spanish clerical cursive handwriting in dark iron gall ink, 2 structured sacramental entries with marginal headers, ornate calligraphy on signatures.",
            "entries": [
                {
                    "entry_number": 1, "status": "completed", "has_marginal_notes": False,
                    "metadata": {
                        "nombres": "José Francisco", "apellidos": "Alcalá Gómez", "sexo": "M",
                        "fecha_sacramento": "1885-01-14", "fecha_nacimiento": "1885-01-02",
                        "lugar_nacimiento": "Parroquia Santa Rosa de Lima de Carúpano",
                        "nombre_padre": "Manuel Vicente Alcalá", "nombre_madre": "María Antonia Gómez",
                        "abuelos_paternos": "Francisco de Paula Alcalá y Carmen Bermúdez",
                        "abuelos_maternos": "José María Gómez y Rosa Ramos",
                        "padrinos": "Dr. Andrés Salazar y Josefa Montes",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión"
                    }
                },
                {
                    "entry_number": 2, "status": "completed", "has_marginal_notes": False,
                    "metadata": {
                        "nombres": "Rosa Emilia", "apellidos": "Bermúdez Montes", "sexo": "F",
                        "fecha_sacramento": "1885-01-20", "fecha_nacimiento": "1885-01-08",
                        "lugar_nacimiento": "Carúpano, Estado Bermúdez",
                        "nombre_padre": "Carlos Bermúdez Velásquez", "nombre_madre": "Francisca Antonia Montes",
                        "abuelos_paternos": "Antonio Bermúdez y Luisa Serrano",
                        "abuelos_maternos": "Pedro Montes y Juana Rivera",
                        "padrinos": "Santiago Alcalá y Carmen Rosa Caraballo",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión"
                    }
                }
            ]
        },
        # 2: F002V
        {
            "seq": 2, "folio": 2, "side": "verso", "code": "V", "status": "completed", "stress": "standard",
            "prompt": "Sacramental parish archive book page, 1885 Carupano, folio 2 verso, iron gall ink handwriting on antique linen paper, minor ink bleedthrough from recto side, two clean Latin American 19th century baptism certificates.",
            "entries": [
                {
                    "entry_number": 3, "status": "completed", "has_marginal_notes": False,
                    "metadata": {
                        "nombres": "Manuel Antonio", "apellidos": "Salazar Sucre", "sexo": "M",
                        "fecha_sacramento": "1885-02-04", "fecha_nacimiento": "1885-01-25",
                        "lugar_nacimiento": "Playa Grande, Carúpano",
                        "nombre_padre": "Domingo Salazar Rivera", "nombre_madre": "Mercedes Sucre de Salazar",
                        "abuelos_paternos": "Vicente Salazar y Petra Gómez",
                        "abuelos_maternos": "Felipe Sucre y Ana Josefa Caraballo",
                        "padrinos": "Lic. Ramón Bermúdez y Ana Josefa Velásquez",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión"
                    }
                }
            ]
        },
        # 3: F003R
        {
            "seq": 3, "folio": 3, "side": "recto", "code": "R", "status": "completed", "stress": "standard",
            "prompt": "1885 Catholic church register baptism record folio 3 recto, sharp macro photo, historical paper texture, elegant Latin American parish clerk script, complete records.",
            "entries": [
                {
                    "entry_number": 4, "status": "completed", "has_marginal_notes": False,
                    "metadata": {
                        "nombres": "Luisa Ramona", "apellidos": "Velásquez Ramos", "sexo": "F",
                        "fecha_sacramento": "1885-02-18", "fecha_nacimiento": "1885-02-09",
                        "lugar_nacimiento": "Carúpano, Parroquia Santa Rosa",
                        "nombre_padre": "Eusebio Velásquez Serrano", "nombre_madre": "Elena Ramos Alcalá",
                        "abuelos_paternos": "Casimiro Velásquez y Elena Montes",
                        "abuelos_maternos": "Ramón Ramos y María Bermúdez",
                        "padrinos": "Gral. Francisco Gómez y Luisa Caraballo",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión"
                    }
                }
            ]
        },
        # 4: F004V
        {
            "seq": 4, "folio": 4, "side": "verso", "code": "V", "status": "completed", "stress": "standard",
            "prompt": "19th century ecclesiastical parish baptism tome, folio 4 verso, Venezuela, brown handwriting with natural ink fading along margins, parchment folio texture.",
            "entries": [
                {
                    "entry_number": 5, "status": "completed", "has_marginal_notes": False,
                    "metadata": {
                        "nombres": "Pedro Celestino", "apellidos": "Montes Caraballo", "sexo": "M",
                        "fecha_sacramento": "1885-03-01", "fecha_nacimiento": "1885-02-19",
                        "lugar_nacimiento": "Carúpano",
                        "nombre_padre": "José Montes Bermúdez", "nombre_madre": "Rosario Caraballo Salazar",
                        "abuelos_paternos": "Rafael Montes y Teresa Velásquez",
                        "abuelos_maternos": "Blas Caraballo y Josefa Gómez",
                        "padrinos": "Pbro. Lorenzo Ramos y Mercedes Sucre",
                        "ministro": "Pbro. Lorenzo Ramos (Teniente de Cura)"
                    }
                }
            ]
        },
        # 5: F005R
        {
            "seq": 5, "folio": 5, "side": "recto", "code": "R", "status": "completed", "stress": "standard",
            "prompt": "Historic archival manuscript, Carupano church 1885, baptism certificate folio 5 recto, crisp calligraphic script, iron gall ink on laid paper, authentic diocesan stamps.",
            "entries": [
                {
                    "entry_number": 6, "status": "completed", "has_marginal_notes": False,
                    "metadata": {
                        "nombres": "Carmen Antonia", "apellidos": "Caraballo Serrano", "sexo": "F",
                        "fecha_sacramento": "1885-03-12", "fecha_nacimiento": "1885-03-01",
                        "lugar_nacimiento": "Macarapana, Jurisdicción de Carúpano",
                        "nombre_padre": "Bernardo Caraballo Rivera", "nombre_madre": "Inés Serrano Alcalá",
                        "abuelos_paternos": "Andrés Caraballo y Catalina Montes",
                        "abuelos_maternos": "Gaspar Serrano y Carmen Ramos",
                        "padrinos": "Dr. Juan Bautista Gómez y Carmen Alcalá",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión"
                    }
                }
            ]
        },
        # 6: F006DP
        {
            "seq": 6, "folio": 6, "side": "double_page", "code": "DP", "status": "completed", "stress": "double_page",
            "prompt": "Double page spread photograph of an antique open leather-bound Catholic ledger from 1886 Carupano, showing both left folio 5 verso and right folio 6 recto in single camera frame, central gutter with book stitching visible, natural book curve and lighting gradient.",
            "entries": [
                {
                    "entry_number": 7, "status": "completed", "has_marginal_notes": False,
                    "page_region": "left_page",
                    "metadata": {
                        "nombres": "Juan Bautista", "apellidos": "Gómez Sucre", "sexo": "M",
                        "fecha_sacramento": "1886-01-10", "fecha_nacimiento": "1885-12-28",
                        "lugar_nacimiento": "Carúpano",
                        "nombre_padre": "Dr. Juan Bautista Gómez", "nombre_madre": "Teresa Sucre Alcalá",
                        "abuelos_paternos": "Vicente Gómez y Juana Serrano",
                        "abuelos_maternos": "Coronel Antonio Sucre y Elena Bermúdez",
                        "padrinos": "Manuel Vicente Alcalá y Rosa Bermúdez",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión"
                    }
                },
                {
                    "entry_number": 8, "status": "completed", "has_marginal_notes": False,
                    "page_region": "right_page",
                    "metadata": {
                        "nombres": "María de la Consolación", "apellidos": "Rivera Montes", "sexo": "F",
                        "fecha_sacramento": "1886-01-15", "fecha_nacimiento": "1886-01-03",
                        "lugar_nacimiento": "Carúpano, Parroquia Santa Rosa",
                        "nombre_padre": "Francisco Rivera Velásquez", "nombre_madre": "Juana Montes Salazar",
                        "abuelos_paternos": "Pedro Rivera y Francisca Ramos",
                        "abuelos_maternos": "Domingo Montes y Teresa Caraballo",
                        "padrinos": "Carlos Bermúdez y Luisa Serrano",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión"
                    }
                }
            ]
        },
        # 7: F007DP
        {
            "seq": 7, "folio": 7, "side": "double_page", "code": "DP", "status": "pending", "stress": "double_page",
            "prompt": "Archival open book double page spread, 1886 baptism register, high resolution wide shot capturing both pages of volume, dark iron gall ink, multiple handwritten baptismal acts awaiting digitization.",
            "entries": [
                {"entry_number": 9, "status": "pending", "page_region": "left_page", "metadata": {}},
                {"entry_number": 10, "status": "pending", "page_region": "right_page", "metadata": {}}
            ]
        },
        # 8: F008V (Continued start)
        {
            "seq": 8, "folio": 8, "side": "verso", "code": "V", "status": "completed", "stress": "continued",
            "prompt": "Antique baptismal manuscript page, 1886 Carupano, folio 8 verso, lower half showing entry ending abruptly with 'continúa en el folio siguiente al recto...', sepia rag paper, vintage calligraphy.",
            "entries": [
                {
                    "entry_number": 11, "status": "completed", "has_marginal_notes": False,
                    "is_continued_to_next": True, "continued_to_seq": 9,
                    "notes": "Partida iniciada al pie del folio 8 vuelto y continuada en el folio 9 recto",
                    "metadata": {
                        "nombres": "Antonio José", "apellidos": "Sucre Bermúdez", "sexo": "M",
                        "fecha_sacramento": "1886-04-10", "fecha_nacimiento": "1886-03-22",
                        "lugar_nacimiento": "Carúpano, Puerto de San José",
                        "nombre_padre": "Marcos Sucre Velásquez", "nombre_madre": "Isabel Bermúdez Gómez",
                        "abuelos_paternos": "Antonio Sucre y María Ramos",
                        "abuelos_maternos": "Rafael Bermúdez y Concepción Alcalá",
                        "padrinos": "Pasa al folio 9 recto para mención de padrinos y firmas",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión"
                    }
                }
            ]
        },
        # 9: F009R (Continued end)
        {
            "seq": 9, "folio": 9, "side": "recto", "code": "R", "status": "completed", "stress": "continued",
            "prompt": "Antique baptismal parish register, 1886 Carupano, folio 9 recto, top entry starting with 'Viene del folio anterior vuelto...', listing godparents and formal canonical signatures of priest and sponsors.",
            "entries": [
                {
                    "entry_number": 12, "status": "completed", "has_marginal_notes": False,
                    "is_continued": True, "continued_from_seq": 8,
                    "metadata": {
                        "nombres": "Antonio José (Conclusión)", "apellidos": "Sucre Bermúdez", "sexo": "M",
                        "fecha_sacramento": "1886-04-10", "fecha_nacimiento": "1886-03-22",
                        "lugar_nacimiento": "Carúpano, Puerto de San José",
                        "nombre_padre": "Marcos Sucre Velásquez", "nombre_madre": "Isabel Bermúdez Gómez",
                        "abuelos_paternos": "Antonio Sucre y María Ramos",
                        "abuelos_maternos": "Rafael Bermúdez y Concepción Alcalá",
                        "padrinos": "Dr. Andrés Salazar y Doña Carmen Bermúdez de Salazar, a quienes advertí el parentesco espiritual y obligaciones.",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión"
                    }
                }
            ]
        },
        # 10: F010R (Degraded)
        {
            "seq": 10, "folio": 10, "side": "recto", "code": "R", "status": "pending", "stress": "degraded",
            "prompt": "Severely faded historical parish register from 1887 Carupano, folio 10 recto, pale brownish iron gall ink with high chemical degradation, faint cursive text requiring high digital contrast enhance, aged parchment stains.",
            "entries": [{"entry_number": 13, "status": "pending", "metadata": {}}]
        },
        # 11: F011V (Degraded)
        {
            "seq": 11, "folio": 11, "side": "verso", "code": "V", "status": "pending", "stress": "degraded",
            "prompt": "Historic manuscript book page damaged by water stains and tropical humidity tide marks along edges, folio 11 verso, yellow and damp mottled paper, partially obscured handwriting.",
            "entries": [{"entry_number": 14, "status": "pending", "metadata": {}}]
        },
        # 12: F012R (Degraded)
        {
            "seq": 12, "folio": 12, "side": "recto", "code": "R", "status": "pending", "stress": "degraded",
            "prompt": "Archival document with severe iron gall ink burn through and paper corrosion, 1887 parish record, acidic ink dissolving through fibers, high difficulty paleographic transcription.",
            "entries": [{"entry_number": 15, "status": "pending", "metadata": {}}]
        },
        # 13: F013V (Doubtful / Mutilated)
        {
            "seq": 13, "folio": 13, "side": "verso", "code": "V", "status": "pending", "stress": "doubtful",
            "prompt": "Historical church document page with torn and mutilated bottom corner, folio 13 verso, ink blot splatters obliterating surname and date fields, ideal for testing unreadable field tagging.",
            "entries": [{"entry_number": 16, "status": "pending", "metadata": {}}]
        },
        # 14: F014R (Doubtful / Mutilated)
        {
            "seq": 14, "folio": 14, "side": "recto", "code": "R", "status": "pending", "stress": "doubtful",
            "prompt": "Mutilated antique parish record with insect holes (bookworm damage) perforating vital names and dates, worm eaten paper lacework over 19th century Spanish handwriting.",
            "entries": [{"entry_number": 17, "status": "pending", "metadata": {}}]
        },
        # 15: F015R (Blank / Canonical auto)
        {
            "seq": 15, "folio": 15, "side": "recto", "code": "R", "status": "blank", "stress": "blank",
            "prompt": "Blank historical folio 15 recto from 1888 parish register, unwritten lined sepia paper with only a single formal canonical inspection notice (Auto de Visita Pastoral) written centered, vast empty paper space.",
            "entries": []
        },
        # 16: F016R (Marginal Notes)
        {
            "seq": 16, "folio": 16, "side": "recto", "code": "R", "status": "completed", "stress": "marginal_notes",
            "prompt": "Parish baptism registry page folio 16 recto with dense 20th century marginal notes written sideways along the left margin in purple ink next to the 1888 original baptism entry, noting subsequent marriage and legitimation.",
            "entries": [
                {
                    "entry_number": 18, "status": "completed", "has_marginal_notes": True,
                    "marginal_notes_text": "Al margen: Contrajo matrimonio en esta Parroquia de Santa Rosa con María Teresa Ramos el día 14 de noviembre de 1912. Doy fe: Pbro. Sixto Sosa.",
                    "metadata": {
                        "nombres": "Félix Ramón", "apellidos": "Alcalá Caraballo", "sexo": "M",
                        "fecha_sacramento": "1888-05-18", "fecha_nacimiento": "1888-05-02",
                        "lugar_nacimiento": "Carúpano, Calle Real",
                        "nombre_padre": "Ramón Alcalá Salazar", "nombre_madre": "Dolores Caraballo Montes",
                        "abuelos_paternos": "Francisco Alcalá y Rosa Gómez",
                        "abuelos_maternos": "José Caraballo y Petra Sucre",
                        "padrinos": "Dr. Andrés Salazar y Francisca Velásquez",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión",
                        "notas_marginales": "Contrajo matrimonio con María Teresa Ramos el 14-Nov-1912 (Libro 5 Matr. Folio 82)."
                    }
                }
            ]
        },
        # 17: F017V (Marginal Notes)
        {
            "seq": 17, "folio": 17, "side": "verso", "code": "V", "status": "completed", "stress": "marginal_notes",
            "prompt": "1888 sacramental manuscript folio 17 verso featuring elaborate episcopal decree marginal note written vertically along left border with official parish stamp seal in faded black ink.",
            "entries": [
                {
                    "entry_number": 19, "status": "completed", "has_marginal_notes": True,
                    "marginal_notes_text": "Nota marginal: Legitimada por subsiguiente matrimonio de sus padres celebrado el 22 de agosto de 1895 en esta Santa Iglesia. Pbro. J.B. Carrión.",
                    "metadata": {
                        "nombres": "Petra Josefa", "apellidos": "Serrano Bermúdez", "sexo": "F",
                        "fecha_sacramento": "1888-08-04", "fecha_nacimiento": "1888-07-21",
                        "lugar_nacimiento": "Carúpano",
                        "nombre_padre": "Gabriel Serrano Rivera", "nombre_madre": "Ana Josefa Bermúdez Velásquez",
                        "abuelos_paternos": "Manuel Serrano y Carmen Caraballo",
                        "abuelos_maternos": "Carlos Bermúdez y Luisa Montes",
                        "padrinos": "Manuel Vicente Alcalá y Rosa Emilia Bermúdez",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión",
                        "notas_marginales": "Legitimada por subsiguiente matrimonio de sus padres el 22-Ago-1895."
                    }
                }
            ]
        },
        # 18: F018R (Standard pending)
        {
            "seq": 18, "folio": 18, "side": "recto", "code": "R", "status": "pending", "stress": "standard",
            "prompt": "Historic 1889 baptismal ledger page folio 18 recto, standard crisp calligraphy, two clear unindexed entries for real-time live demo indexing.",
            "entries": [{"entry_number": 20, "status": "pending", "metadata": {}}]
        },
        # 19: F019V (Standard pending)
        {
            "seq": 19, "folio": 19, "side": "verso", "code": "V", "status": "pending", "stress": "standard",
            "prompt": "1889 ecclesiastical volume folio 19 verso, regular Latin American parish cursive script, waiting for transcription.",
            "entries": [{"entry_number": 21, "status": "pending", "metadata": {}}]
        },
        # 20: F020R (Standard pending)
        {
            "seq": 20, "folio": 20, "side": "recto", "code": "R", "status": "pending", "stress": "standard",
            "prompt": "1890 baptismal register final tome page folio 20 recto, historical manuscript on aged parchment with clerical signatures at the bottom.",
            "entries": [{"entry_number": 22, "status": "pending", "metadata": {}}]
        }
    ]

    for item in bau_data:
        folios.append({
            "series": "bautismo",
            "volume_id": "vol-carupano-bau-t01",
            "tome_number": 1,
            "sequence_order": item["seq"],
            "folio_number": item["folio"],
            "folio_side": item["side"],
            "canonical_filename": f"CARUPANO_BAU_T01_F{item['folio']:03d}{item['code']}.jpg",
            "remote_image_url": f"https://pub-codexflow.r2.dev/corpus/bautismos/CARUPANO_BAU_T01_F{item['folio']:03d}{item['code']}.jpg",
            "status": item["status"],
            "stress_case": item["stress"],
            "prompt": item["prompt"],
            "entries": item["entries"]
        })

    # 2. MATRIMONIOS
    mat_data = [
        # 1: F001R
        {
            "seq": 1, "folio": 1, "side": "recto", "code": "R", "status": "completed", "stress": "standard",
            "prompt": "Historical marriage register folio 1 recto, Carupano church 1885, dark iron gall ink calligraphy, detailed sacramental marriage record of prominent Venezuelan citizens with witnesses and parent details.",
            "entries": [
                {
                    "entry_number": 1, "status": "completed", "has_marginal_notes": False,
                    "metadata": {
                        "contrayente_1": "Don Manuel Vicente Alcalá Ramos",
                        "contrayente_2": "Doña María Antonia Gómez Bermúdez",
                        "edad_contrayente_1": "28", "edad_contrayente_2": "22",
                        "estado_civil_contrayente_1": "Soltero", "estado_civil_contrayente_2": "Soltera",
                        "lugar_origen_contrayente_1": "Carúpano", "lugar_origen_contrayente_2": "Carúpano",
                        "padres_contrayente_1": "Francisco de Paula Alcalá y Carmen Ramos",
                        "padres_contrayente_2": "José María Gómez y Rosa Bermúdez",
                        "fecha_sacramento": "1885-02-15",
                        "testigos": "Dr. Andrés Salazar y General Francisco Gómez",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión",
                        "proclamas": "Dispensadas dos proclamas por el Ilustrísimo Señor Obispo de Guayana"
                    }
                }
            ]
        },
        # 2: F002V
        {
            "seq": 2, "folio": 2, "side": "verso", "code": "V", "status": "completed", "stress": "standard",
            "prompt": "1885 sacramental marriage tome, folio 2 verso, Carupano Catholic parish, elegant Spanish cursive, complete canonical marriage entry with nuptial benediction.",
            "entries": [
                {
                    "entry_number": 2, "status": "completed", "has_marginal_notes": False,
                    "metadata": {
                        "contrayente_1": "Carlos Bermúdez Velásquez",
                        "novio": "Carlos Bermúdez Velásquez",
                        "contrayente_2": "Francisca Antonia Montes Salazar",
                        "novia": "Francisca Antonia Montes Salazar",
                        "edad_contrayente_1": "26", "edad_contrayente_2": "20",
                        "estado_civil_contrayente_1": "Soltero", "estado_civil_contrayente_2": "Soltera",
                        "lugar_origen_contrayente_1": "Carúpano", "lugar_origen_contrayente_2": "Carúpano",
                        "padres_contrayente_1": "Antonio Bermúdez y Luisa Velásquez",
                        "padres_contrayente_2": "Pedro Montes y Juana Salazar",
                        "fecha_sacramento": "1885-04-20",
                        "testigos": "Santiago Alcalá y Carmen Rosa Caraballo",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión",
                        "proclamas": "Corrieron las tres canónicas proclamas en días festivos inter missarum solemnia"
                    }
                }
            ]
        },
        # 3: F003R
        {
            "seq": 3, "folio": 3, "side": "recto", "code": "R", "status": "completed", "stress": "standard",
            "prompt": "Antique marriage record document, folio 3 recto, 1885, crisp handwriting on textured antique cotton paper, official church register format.",
            "entries": [
                {
                    "entry_number": 3, "status": "completed", "has_marginal_notes": False,
                    "metadata": {
                        "contrayente_1": "Domingo Salazar Rivera",
                        "contrayente_2": "Mercedes Sucre Serrano",
                        "edad_contrayente_1": "31", "edad_contrayente_2": "24",
                        "estado_civil_contrayente_1": "Viudo de Josefa Ramos", "estado_civil_contrayente_2": "Soltera",
                        "lugar_origen_contrayente_1": "Río Caribe", "lugar_origen_contrayente_2": "Carúpano",
                        "padres_contrayente_1": "Vicente Salazar y Petra Rivera",
                        "padres_contrayente_2": "Felipe Sucre y Ana Serrano",
                        "fecha_sacramento": "1885-06-11",
                        "testigos": "Lic. Ramón Bermúdez y Doña Elena Montes",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión",
                        "proclamas": "Tres proclamas sin impedimento canónico"
                    }
                }
            ]
        },
        # 4: F004V
        {
            "seq": 4, "folio": 4, "side": "verso", "code": "V", "status": "completed", "stress": "standard",
            "prompt": "1885 ecclesiastical folio 4 verso marriage act, Venezuela, sepia ink script with flourishing signatures of priest, bridegroom, bride and padrinos.",
            "entries": [
                {
                    "entry_number": 4, "status": "completed", "has_marginal_notes": False,
                    "metadata": {
                        "contrayente_1": "Eusebio Velásquez Serrano",
                        "contrayente_2": "Elena Ramos Alcalá",
                        "edad_contrayente_1": "25", "edad_contrayente_2": "21",
                        "estado_civil_contrayente_1": "Soltero", "estado_civil_contrayente_2": "Soltera",
                        "lugar_origen_contrayente_1": "Carúpano", "lugar_origen_contrayente_2": "Carúpano",
                        "padres_contrayente_1": "Casimiro Velásquez y Elena Serrano",
                        "padres_contrayente_2": "Ramón Ramos y María Alcalá",
                        "fecha_sacramento": "1885-08-25",
                        "testigos": "José Montes Bermúdez y Rosario Caraballo",
                        "ministro": "Pbro. Lorenzo Ramos (Teniente de Cura)",
                        "proclamas": "Canónicas proclamas leídas en las fiestas de la Asunción y San Bartolomé"
                    }
                }
            ]
        },
        # 5: F005R
        {
            "seq": 5, "folio": 5, "side": "recto", "code": "R", "status": "completed", "stress": "standard",
            "prompt": "1886 parish marriage tome folio 5 recto, fine quill penmanship on heavy paper, high quality scan appearance.",
            "entries": [
                {
                    "entry_number": 5, "status": "completed", "has_marginal_notes": False,
                    "metadata": {
                        "contrayente_1": "José Montes Bermúdez",
                        "contrayente_2": "Rosario Caraballo Salazar",
                        "edad_contrayente_1": "29", "edad_contrayente_2": "23",
                        "estado_civil_contrayente_1": "Soltero", "estado_civil_contrayente_2": "Soltera",
                        "lugar_origen_contrayente_1": "Carúpano", "lugar_origen_contrayente_2": "El Pilar",
                        "padres_contrayente_1": "Rafael Montes y Teresa Bermúdez",
                        "padres_contrayente_2": "Blas Caraballo y Josefa Salazar",
                        "fecha_sacramento": "1886-01-08",
                        "testigos": "Bernardo Caraballo y Carmen Alcalá",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión",
                        "proclamas": "Tres proclamas corridas conforme al Santo Concilio de Trento"
                    }
                }
            ]
        },
        # 6: F006DP (Double page completed)
        {
            "seq": 6, "folio": 6, "side": "double_page", "code": "DP", "status": "completed", "stress": "double_page",
            "prompt": "Open book double page spread photograph of 1886 Carupano marriage ledger, left page folio 5 verso and right page folio 6 recto, complete view of massive bound volume with leather spine binding showing in middle.",
            "entries": [
                {
                    "entry_number": 6, "status": "completed", "has_marginal_notes": False,
                    "page_region": "left_page",
                    "metadata": {
                        "contrayente_1": "Bernardo Caraballo Rivera",
                        "contrayente_2": "Inés Serrano Alcalá",
                        "edad_contrayente_1": "27", "edad_contrayente_2": "22",
                        "estado_civil_contrayente_1": "Soltero", "estado_civil_contrayente_2": "Soltera",
                        "lugar_origen_contrayente_1": "Carúpano", "lugar_origen_contrayente_2": "Carúpano",
                        "padres_contrayente_1": "Andrés Caraballo y Catalina Rivera",
                        "padres_contrayente_2": "Gaspar Serrano y Carmen Alcalá",
                        "fecha_sacramento": "1886-02-14",
                        "testigos": "Dr. Juan Bautista Gómez y Teresa Sucre",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión",
                        "proclamas": "Proclamas leídas sin objeción civil ni canónica"
                    }
                },
                {
                    "entry_number": 7, "status": "completed", "has_marginal_notes": False,
                    "page_region": "right_page",
                    "metadata": {
                        "contrayente_1": "Dr. Juan Bautista Gómez Velásquez",
                        "contrayente_2": "Teresa Sucre Alcalá",
                        "edad_contrayente_1": "34", "edad_contrayente_2": "25",
                        "estado_civil_contrayente_1": "Soltero", "estado_civil_contrayente_2": "Soltera",
                        "lugar_origen_contrayente_1": "Cumaná", "lugar_origen_contrayente_2": "Carúpano",
                        "padres_contrayente_1": "Vicente Gómez y Juana Velásquez",
                        "padres_contrayente_2": "Coronel Antonio Sucre y Elena Alcalá",
                        "fecha_sacramento": "1886-03-02",
                        "testigos": "Manuel Vicente Alcalá y Rosa Bermúdez de Alcalá",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión",
                        "proclamas": "Dispensada la tercera proclama por el Vicario Foráneo"
                    }
                }
            ]
        },
        # 7: F007DP (Double page pending)
        {
            "seq": 7, "folio": 7, "side": "double_page", "code": "DP", "status": "pending", "stress": "double_page",
            "prompt": "Double page archival capture of 1886 marriage records book, folios 6 verso and 7 recto, showing full book curvature, gutter distortion, dual pending marriage entries.",
            "entries": [
                {"entry_number": 8, "status": "pending", "page_region": "left_page", "metadata": {}},
                {"entry_number": 9, "status": "pending", "page_region": "right_page", "metadata": {}}
            ]
        },
        # 8: F008V (Continued start)
        {
            "seq": 8, "folio": 8, "side": "verso", "code": "V", "status": "completed", "stress": "continued",
            "prompt": "Antique marriage registry manuscript folio 8 verso, detailed canonical matrimonial investigation with impediment dispensa that extends to next page, footer note 'pasa al folio siguiente...'",
            "entries": [
                {
                    "entry_number": 10, "status": "completed", "has_marginal_notes": False,
                    "is_continued_to_next": True, "continued_to_seq": 9,
                    "notes": "Partida extensa con dispensa de consanguinidad iniciada al pie de F008V y continuada en F009R",
                    "metadata": {
                        "contrayente_1": "Francisco Rivera Velásquez",
                        "contrayente_2": "Juana Montes Salazar",
                        "edad_contrayente_1": "30", "edad_contrayente_2": "24",
                        "estado_civil_contrayente_1": "Soltero", "estado_civil_contrayente_2": "Soltera",
                        "lugar_origen_contrayente_1": "Carúpano", "lugar_origen_contrayente_2": "Carúpano",
                        "padres_contrayente_1": "Pedro Rivera y Francisca Velásquez",
                        "padres_contrayente_2": "Domingo Montes y Teresa Salazar",
                        "fecha_sacramento": "1886-05-18",
                        "dispensa_impedimento": "Obtuvieron dispensa de parentesco de consanguinidad en tercer grado de la Curia Diocesana de Guayana...",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión"
                    }
                }
            ]
        },
        # 9: F009R (Continued end)
        {
            "seq": 9, "folio": 9, "side": "recto", "code": "R", "status": "completed", "stress": "continued",
            "prompt": "Matrimonial ledger folio 9 recto, top text 'Continuación del acta matrimonial del folio anterior vuelto...', detailing witnesses, canonical nuptial blessing and official signatures.",
            "entries": [
                {
                    "entry_number": 11, "status": "completed", "has_marginal_notes": False,
                    "is_continued": True, "continued_from_seq": 8,
                    "metadata": {
                        "contrayente_1": "Francisco Rivera Velásquez (Conclusión)",
                        "contrayente_2": "Juana Montes Salazar (Conclusión)",
                        "fecha_sacramento": "1886-05-18",
                        "testigos": "Carlos Bermúdez y Luisa Serrano, vecinos de este puerto.",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión",
                        "dispensa_impedimento": "Cumplidas las penitencias impuestas en el auto de dispensa, recibieron las bendiciones nupciales.",
                        "firmas": "Juan B. Carrión, Francisco Rivera, Juana Montes, Carlos Bermúdez, Luisa Serrano."
                    }
                }
            ]
        },
        # 10: F010R (Degraded)
        {
            "seq": 10, "folio": 10, "side": "recto", "code": "R", "status": "pending", "stress": "degraded",
            "prompt": "Severe ink bleaching and fading on 1887 matrimonial registry page folio 10 recto, ghosted cursive script, test case for dynamic contrast thresholding.",
            "entries": [{"entry_number": 12, "status": "pending", "metadata": {}}]
        },
        # 11: F011V (Degraded)
        {
            "seq": 11, "folio": 11, "side": "verso", "code": "V", "status": "pending", "stress": "degraded",
            "prompt": "Water damaged 19th century marriage book page with pronounced yellow brown tideline stains covering center lines of handwriting.",
            "entries": [{"entry_number": 13, "status": "pending", "metadata": {}}]
        },
        # 12: F012R (Degraded)
        {
            "seq": 12, "folio": 12, "side": "recto", "code": "R", "status": "pending", "stress": "degraded",
            "prompt": "High chemical oxidation iron gall ink corroded marriage entry, folio 12 recto, dark haloing and paper brittleness.",
            "entries": [{"entry_number": 14, "status": "pending", "metadata": {}}]
        },
        # 13: F013V (Doubtful / Mutilated)
        {
            "seq": 13, "folio": 13, "side": "verso", "code": "V", "status": "pending", "stress": "doubtful",
            "prompt": "Historical marriage document folio 13 verso with torn edge cutting through bride parentage names, blot of ink on date field.",
            "entries": [{"entry_number": 15, "status": "pending", "metadata": {}}]
        },
        # 14: F014R (Doubtful / Mutilated)
        {
            "seq": 14, "folio": 14, "side": "recto", "code": "R", "status": "pending", "stress": "doubtful",
            "prompt": "Vintage parish record with rodent and insect gnawed paper margins, partially missing textual clauses in marriage act.",
            "entries": [{"entry_number": 16, "status": "pending", "metadata": {}}]
        },
        # 15: F015R (Blank)
        {
            "seq": 15, "folio": 15, "side": "recto", "code": "R", "status": "blank", "stress": "blank",
            "prompt": "Clean blank folio 15 recto of marriage book with formal closing certificate for year 1888 signed by bishop secretary, empty lines below.",
            "entries": []
        },
        # 16: F016R (Marginal Notes)
        {
            "seq": 16, "folio": 16, "side": "recto", "code": "R", "status": "completed", "stress": "marginal_notes",
            "prompt": "1889 marriage register folio 16 recto with dense lateral marginal annotation in red ink detailing subsequent civil registry confirmation.",
            "entries": [
                {
                    "entry_number": 17, "status": "completed", "has_marginal_notes": True,
                    "marginal_notes_text": "Anotación marginal: Presentaron certificado de matrimonio civil N° 45 del Juzgado del Distrito Bermúdez, registrado al folio 12 de dicho año.",
                    "metadata": {
                        "contrayente_1": "Marcos Sucre Velásquez",
                        "contrayente_2": "Isabel Bermúdez Gómez",
                        "edad_contrayente_1": "30", "edad_contrayente_2": "23",
                        "estado_civil_contrayente_1": "Soltero", "estado_civil_contrayente_2": "Soltera",
                        "lugar_origen_contrayente_1": "Carúpano", "lugar_origen_contrayente_2": "Carúpano",
                        "padres_contrayente_1": "Antonio Sucre y María Velásquez",
                        "padres_contrayente_2": "Rafael Bermúdez y Concepción Gómez",
                        "fecha_sacramento": "1889-06-20",
                        "testigos": "Manuel Vicente Alcalá y Rosa Emilia Bermúdez",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión",
                        "notas_marginales": "Anotado el registro civil distrital N° 45."
                    }
                }
            ]
        },
        # 17: F017V (Marginal Notes)
        {
            "seq": 17, "folio": 17, "side": "verso", "code": "V", "status": "completed", "stress": "marginal_notes",
            "prompt": "1889 marriage folio 17 verso featuring apostolic dispensa notation written sideways in left column, signed by apostolic delegate.",
            "entries": [
                {
                    "entry_number": 18, "status": "completed", "has_marginal_notes": True,
                    "marginal_notes_text": "Nota marginal: Con dispensa apostólica de afinidad en primer grado concedida por Su Santidad León XIII.",
                    "metadata": {
                        "contrayente_1": "Gabriel Serrano Rivera",
                        "contrayente_2": "Ana Josefa Bermúdez Velásquez",
                        "edad_contrayente_1": "33", "edad_contrayente_2": "27",
                        "estado_civil_contrayente_1": "Viudo de Carmen Bermúdez", "estado_civil_contrayente_2": "Soltera",
                        "lugar_origen_contrayente_1": "Carúpano", "lugar_origen_contrayente_2": "Carúpano",
                        "padres_contrayente_1": "Manuel Serrano y Carmen Rivera",
                        "padres_contrayente_2": "Carlos Bermúdez y Luisa Velásquez",
                        "fecha_sacramento": "1889-10-15",
                        "testigos": "Dr. Andrés Salazar y Doña Francisca Montes",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión",
                        "notas_marginales": "Dispensa de afinidad en primer grado registrada en secretaría episcopal."
                    }
                }
            ]
        },
        # 18: F018R (Standard pending)
        {
            "seq": 18, "folio": 18, "side": "recto", "code": "R", "status": "pending", "stress": "standard",
            "prompt": "1890 wedding book folio 18 recto, standard legible script, unindexed wedding record awaiting entry.",
            "entries": [{"entry_number": 19, "status": "pending", "metadata": {}}]
        },
        # 19: F019V (Standard pending)
        {
            "seq": 19, "folio": 19, "side": "verso", "code": "V", "status": "pending", "stress": "standard",
            "prompt": "1891 marriage register folio 19 verso, typical 19th century ecclesiastical paper, unindexed.",
            "entries": [{"entry_number": 20, "status": "pending", "metadata": {}}]
        },
        # 20: F020R (Standard pending)
        {
            "seq": 20, "folio": 20, "side": "recto", "code": "R", "status": "pending", "stress": "standard",
            "prompt": "1895 matrimonial volume final folio 20 recto, parchment texture, complete marriage document ready for indexing.",
            "entries": [{"entry_number": 21, "status": "pending", "metadata": {}}]
        }
    ]

    for item in mat_data:
        folios.append({
            "series": "matrimonio",
            "volume_id": "vol-carupano-mat-t01",
            "tome_number": 1,
            "sequence_order": item["seq"],
            "folio_number": item["folio"],
            "folio_side": item["side"],
            "canonical_filename": f"CARUPANO_MAT_T01_F{item['folio']:03d}{item['code']}.jpg",
            "remote_image_url": f"https://pub-codexflow.r2.dev/corpus/matrimonios/CARUPANO_MAT_T01_F{item['folio']:03d}{item['code']}.jpg",
            "status": item["status"],
            "stress_case": item["stress"],
            "prompt": item["prompt"],
            "entries": item["entries"]
        })

    # 3. DEFUNCIONES
    def_data = [
        # 1: F001R
        {
            "seq": 1, "folio": 1, "side": "recto", "code": "R", "status": "completed", "stress": "standard",
            "prompt": "Historical burial and death parish book folio 1 recto, Carupano church 1885, sepia ink Latin American handwriting, detailing deceased name, spouse, death cause, received sacraments and cemetery burial location.",
            "entries": [
                {
                    "entry_number": 1, "status": "completed", "has_marginal_notes": False,
                    "metadata": {
                        "difunto": "Don Francisco de Paula Alcalá",
                        "edad": "68 años", "sexo": "M",
                        "estado_civil": "Casado",
                        "conyuge": "Carmen Ramos de Alcalá",
                        "fecha_defuncion": "1885-01-12",
                        "fecha_sacramento": "1885-01-13",
                        "causa_muerte": "Fiebre perniciosa",
                        "sacramentos_administrados": "Penitencia, Viático y Extremaunción",
                        "sepultura": "Cementerio General de Carúpano en sepultura de primera clase",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión"
                    }
                }
            ]
        },
        # 2: F002V
        {
            "seq": 2, "folio": 2, "side": "verso", "code": "V", "status": "completed", "stress": "standard",
            "prompt": "1885 parish death register folio 2 verso, iron gall ink handwriting on laid paper, clear funeral act record.",
            "entries": [
                {
                    "entry_number": 2, "status": "completed", "has_marginal_notes": False,
                    "metadata": {
                        "difunto": "Doña Luisa Serrano de Bermúdez",
                        "edad": "54 años", "sexo": "F",
                        "estado_civil": "Viuda",
                        "conyuge": "Antonio Bermúdez (difunto)",
                        "fecha_defuncion": "1885-03-05",
                        "fecha_sacramento": "1885-03-06",
                        "causa_muerte": "Hidropesía",
                        "sacramentos_administrados": "Confesión y Extremaunción",
                        "sepultura": "Cementerio General de Carúpano",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión"
                    }
                }
            ]
        },
        # 3: F003R
        {
            "seq": 3, "folio": 3, "side": "recto", "code": "R", "status": "completed", "stress": "standard",
            "prompt": "1885 Catholic church death registry folio 3 recto, crisp script, record of child burial (párvulo) with parent details.",
            "entries": [
                {
                    "entry_number": 3, "status": "completed", "has_marginal_notes": False,
                    "metadata": {
                        "difunto": "Pedro Celestino Montes Caraballo (Párvulo)",
                        "edad": "2 meses", "sexo": "M",
                        "estado_civil": "Párvulo",
                        "conyuge": None,
                        "padres": "José Montes Bermúdez y Rosario Caraballo",
                        "fecha_defuncion": "1885-04-18",
                        "fecha_sacramento": "1885-04-19",
                        "causa_muerte": "Tétanos infantil (Mal de siete días)",
                        "sacramentos_administrados": "Bautizado in periculo mortis",
                        "sepultura": "Tramo de párvulos del Cementerio Católico",
                        "ministro": "Pbro. Lorenzo Ramos"
                    }
                }
            ]
        },
        # 4: F004V
        {
            "seq": 4, "folio": 4, "side": "verso", "code": "V", "status": "completed", "stress": "standard",
            "prompt": "1885 burial register folio 4 verso, Carupano, dark ink clerical hand, detailing testament and ecclesiastical suffrages.",
            "entries": [
                {
                    "entry_number": 4, "status": "completed", "has_marginal_notes": False,
                    "metadata": {
                        "difunto": "General Casimiro Velásquez",
                        "edad": "72 años", "sexo": "M",
                        "estado_civil": "Casado",
                        "conyuge": "Elena Montes de Velásquez",
                        "fecha_defuncion": "1885-07-22",
                        "fecha_sacramento": "1885-07-23",
                        "causa_muerte": "Lesión orgánica del corazón",
                        "sacramentos_administrados": "Todos los Santos Sacramentos",
                        "sepultura": "Bóveda de familia en el Cementerio General",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión",
                        "testamento": "Otorgó testamento ante el Registrador Público Don Ramón Bermúdez"
                    }
                }
            ]
        },
        # 5: F005R
        {
            "seq": 5, "folio": 5, "side": "recto", "code": "R", "status": "completed", "stress": "standard",
            "prompt": "1885 death certificate folio 5 recto, antique Spanish document with official cross header and marginal index name.",
            "entries": [
                {
                    "entry_number": 5, "status": "completed", "has_marginal_notes": False,
                    "metadata": {
                        "difunto": "Catalina Rivera de Caraballo",
                        "edad": "61 años", "sexo": "F",
                        "estado_civil": "Casada",
                        "conyuge": "Andrés Caraballo",
                        "fecha_defuncion": "1885-11-09",
                        "fecha_sacramento": "1885-11-10",
                        "causa_muerte": "Pulmonía",
                        "sacramentos_administrados": "Penitencia y Santa Unción",
                        "sepultura": "Cementerio General",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión"
                    }
                }
            ]
        },
        # 6: F006DP (Double page completed)
        {
            "seq": 6, "folio": 6, "side": "double_page", "code": "DP", "status": "completed", "stress": "double_page",
            "prompt": "Open book double page spread photograph of 1886 Carupano death ledger, capturing folios 5 verso and 6 recto in one frame, showing aged heavy paper binding.",
            "entries": [
                {
                    "entry_number": 6, "status": "completed", "has_marginal_notes": False,
                    "page_region": "left_page",
                    "metadata": {
                        "difunto": "Gaspar Serrano",
                        "edad": "65 años", "sexo": "M",
                        "estado_civil": "Viudo",
                        "conyuge": "Carmen Ramos (difunta)",
                        "fecha_defuncion": "1886-01-14",
                        "fecha_sacramento": "1886-01-15",
                        "causa_muerte": "Disentería epidémica",
                        "sacramentos_administrados": "Penitencia y Extremaunción",
                        "sepultura": "Cementerio de Carúpano",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión"
                    }
                },
                {
                    "entry_number": 7, "status": "completed", "has_marginal_notes": False,
                    "page_region": "right_page",
                    "metadata": {
                        "difunto": "María Rosa Ramos de Gómez",
                        "edad": "58 años", "sexo": "F",
                        "estado_civil": "Casada",
                        "conyuge": "José María Gómez",
                        "fecha_defuncion": "1886-02-03",
                        "fecha_sacramento": "1886-02-04",
                        "causa_muerte": "Cólico miserere",
                        "sacramentos_administrados": "Todos los Santos Sacramentos",
                        "sepultura": "Cementerio General",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión"
                    }
                }
            ]
        },
        # 7: F007DP (Double page pending)
        {
            "seq": 7, "folio": 7, "side": "double_page", "code": "DP", "status": "pending", "stress": "double_page",
            "prompt": "Double page archival capture of 1886 death record ledger, folios 6 verso and 7 recto, showing gutter margin curvature, awaiting digitizer entry.",
            "entries": [
                {"entry_number": 8, "status": "pending", "page_region": "left_page", "metadata": {}},
                {"entry_number": 9, "status": "pending", "page_region": "right_page", "metadata": {}}
            ]
        },
        # 8: F008V (Continued start)
        {
            "seq": 8, "folio": 8, "side": "verso", "code": "V", "status": "completed", "stress": "continued",
            "prompt": "Historical burial certificate manuscript folio 8 verso, recording elaborate parish funeral and legacy provisions that cut off at bottom: 'continúa la disposición de misas y entierro al folio inmediato recto...'",
            "entries": [
                {
                    "entry_number": 10, "status": "completed", "has_marginal_notes": False,
                    "is_continued_to_next": True, "continued_to_seq": 9,
                    "notes": "Partida con manda testamentaria que inicia al pie del folio 8 vuelto y concluye en folio 9 recto",
                    "metadata": {
                        "difunto": "Don Vicente Salazar Caraballo",
                        "edad": "76 años", "sexo": "M",
                        "estado_civil": "Viudo",
                        "conyuge": "Petra Gómez (difunta)",
                        "fecha_defuncion": "1886-06-25",
                        "fecha_sacramento": "1886-06-26",
                        "causa_muerte": "Senectud y consunción",
                        "sacramentos_administrados": "Santos Sacramentos administrados con gran devoción",
                        "sepultura": "Continúa al folio 9 recto con las cláusulas de entierro mayor y capellanía...",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión"
                    }
                }
            ]
        },
        # 9: F009R (Continued end)
        {
            "seq": 9, "folio": 9, "side": "recto", "code": "R", "status": "completed", "stress": "continued",
            "prompt": "1886 ecclesiastical death book folio 9 recto, opening with 'Viene del folio anterior vuelto el entierro de Don Vicente Salazar...', giving details of burial and priest signatures.",
            "entries": [
                {
                    "entry_number": 11, "status": "completed", "has_marginal_notes": False,
                    "is_continued": True, "continued_from_seq": 8,
                    "metadata": {
                        "difunto": "Don Vicente Salazar Caraballo (Conclusión)",
                        "edad": "76 años", "sexo": "M",
                        "fecha_defuncion": "1886-06-25",
                        "fecha_sacramento": "1886-06-26",
                        "causa_muerte": "Senectud",
                        "sepultura": "Se le dio sepultura eclesiástica en el Cementerio General con entierro cantado de cruz alta y vigilia solemne.",
                        "mandas_piadosas": "Fundó 20 misas rezadas por el descanso de su alma y la de sus deudos.",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión"
                    }
                }
            ]
        },
        # 10: F010R (Degraded)
        {
            "seq": 10, "folio": 10, "side": "recto", "code": "R", "status": "pending", "stress": "degraded",
            "prompt": "Extremely faded 1887 death register page folio 10 recto, pale yellow ink on aged paper, difficult reading requiring contrast enhancement.",
            "entries": [{"entry_number": 12, "status": "pending", "metadata": {}}]
        },
        # 11: F011V (Degraded)
        {
            "seq": 11, "folio": 11, "side": "verso", "code": "V", "status": "pending", "stress": "degraded",
            "prompt": "Water and mold damaged archival death ledger page folio 11 verso with substantial brown damp stains over text lines.",
            "entries": [{"entry_number": 13, "status": "pending", "metadata": {}}]
        },
        # 12: F012R (Degraded)
        {
            "seq": 12, "folio": 12, "side": "recto", "code": "R", "status": "pending", "stress": "degraded",
            "prompt": "High acidity ink erosion on 1887 death document folio 12 recto, ink burn eating into the paper fibers.",
            "entries": [{"entry_number": 14, "status": "pending", "metadata": {}}]
        },
        # 13: F013V (Doubtful / Mutilated)
        {
            "seq": 13, "folio": 13, "side": "verso", "code": "V", "status": "pending", "stress": "doubtful",
            "prompt": "Damaged death register page folio 13 verso with torn edge and missing death cause clause, blot of black ink across deceased surname.",
            "entries": [{"entry_number": 15, "status": "pending", "metadata": {}}]
        },
        # 14: F014R (Doubtful / Mutilated)
        {
            "seq": 14, "folio": 14, "side": "recto", "code": "R", "status": "pending", "stress": "doubtful",
            "prompt": "Pest damaged historic burial record page, bookworm holes piercing through age, cemetery name and dates.",
            "entries": [{"entry_number": 16, "status": "pending", "metadata": {}}]
        },
        # 15: F015R (Blank)
        {
            "seq": 15, "folio": 15, "side": "recto", "code": "R", "status": "blank", "stress": "blank",
            "prompt": "Blank page folio 15 recto in 1888 burial register with solitary official auto de visita by Diocesan delegate in center, rest completely unwritten blank page.",
            "entries": []
        },
        # 16: F016R (Marginal Notes)
        {
            "seq": 16, "folio": 16, "side": "recto", "code": "R", "status": "completed", "stress": "marginal_notes",
            "prompt": "1888 death certificate folio 16 recto with marginal note in purple indelible pencil indicating exhumation and transfer of mortal remains to family pantheon.",
            "entries": [
                {
                    "entry_number": 17, "status": "completed", "has_marginal_notes": True,
                    "marginal_notes_text": "Nota marginal: Sus restos fueron exhumados con permiso de la autoridad eclesiástica y trasladados al panteón familiar el 18 de octubre de 1904. Doy fe: Pbro. Sixto Sosa.",
                    "metadata": {
                        "difunto": "Doña Teresa Velásquez de Montes",
                        "edad": "70 años", "sexo": "F",
                        "estado_civil": "Viuda",
                        "conyuge": "Rafael Montes (difunto)",
                        "fecha_defuncion": "1888-04-10",
                        "fecha_sacramento": "1888-04-11",
                        "causa_muerte": "Parálisis cerebral",
                        "sacramentos_administrados": "Santa Unción y Absolución",
                        "sepultura": "Cementerio General de Carúpano",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión",
                        "notas_marginales": "Exhumación y traslado a panteón familiar en 1904."
                    }
                }
            ]
        },
        # 17: F017V (Marginal Notes)
        {
            "seq": 17, "folio": 17, "side": "verso", "code": "V", "status": "completed", "stress": "marginal_notes",
            "prompt": "1888 death registry folio 17 verso featuring marginal judicial investigation note concerning accidental drowning at Carupano port.",
            "entries": [
                {
                    "entry_number": 18, "status": "completed", "has_marginal_notes": True,
                    "marginal_notes_text": "Nota marginal: Consta certificación judicial de sumario por inmersión accidental expedida por el Juzgado de Primera Instancia en lo Criminal.",
                    "metadata": {
                        "difunto": "Blas Caraballo Gómez",
                        "edad": "42 años", "sexo": "M",
                        "estado_civil": "Casado",
                        "conyuge": "Josefa Salazar de Caraballo",
                        "fecha_defuncion": "1888-09-02",
                        "fecha_sacramento": "1888-09-03",
                        "causa_muerte": "Asfixia por inmersión en la rada del puerto",
                        "sacramentos_administrados": "No recibió auxilios por muerte repentina; recibió absolución sub conditione",
                        "sepultura": "Cementerio General",
                        "ministro": "Pbro. Dr. Juan Bautista Carrión",
                        "notas_marginales": "Certificación del sumario judicial N° 28 cursada en archivo."
                    }
                }
            ]
        },
        # 18: F018R (Standard pending)
        {
            "seq": 18, "folio": 18, "side": "recto", "code": "R", "status": "pending", "stress": "standard",
            "prompt": "1889 burial ledger folio 18 recto, neat Spanish cursive script, pending transcription of death entries.",
            "entries": [{"entry_number": 19, "status": "pending", "metadata": {}}]
        },
        # 19: F019V (Standard pending)
        {
            "seq": 19, "folio": 19, "side": "verso", "code": "V", "status": "pending", "stress": "standard",
            "prompt": "1890 Catholic parish death records folio 19 verso, regular parchment paper background, pending status.",
            "entries": [{"entry_number": 20, "status": "pending", "metadata": {}}]
        },
        # 20: F020R (Standard pending)
        {
            "seq": 20, "folio": 20, "side": "recto", "code": "R", "status": "pending", "stress": "standard",
            "prompt": "1892 death register final tome folio 20 recto, historical manuscript page with closing signatures, pending.",
            "entries": [{"entry_number": 21, "status": "pending", "metadata": {}}]
        }
    ]

    for item in def_data:
        folios.append({
            "series": "defuncion",
            "volume_id": "vol-carupano-def-t01",
            "tome_number": 1,
            "sequence_order": item["seq"],
            "folio_number": item["folio"],
            "folio_side": item["side"],
            "canonical_filename": f"CARUPANO_DEF_T01_F{item['folio']:03d}{item['code']}.jpg",
            "remote_image_url": f"https://pub-codexflow.r2.dev/corpus/defunciones/CARUPANO_DEF_T01_F{item['folio']:03d}{item['code']}.jpg",
            "status": item["status"],
            "stress_case": item["stress"],
            "prompt": item["prompt"],
            "entries": item["entries"]
        })

    manifest = {
        "version": "1.0.0",
        "organization": "codexflow-folios",
        "description": "Corpus paleográfico realista de 60 folios con estrés archivístico para CodexFlow y FamilySearch",
        "volumes": volumes,
        "folios": folios
    }

    return manifest

if __name__ == "__main__":
    out_dir = os.path.join(os.path.dirname(__file__), "seeding")
    os.makedirs(out_dir, exist_ok=True)
    manifest_file = os.path.join(out_dir, "corpus_manifest.json")
    manifest = generate_corpus_manifest()
    with open(manifest_file, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"Manifest written successfully to {manifest_file} with {len(manifest['folios'])} folios.")
