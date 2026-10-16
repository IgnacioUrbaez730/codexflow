# Tareas de Implementación: Jerarquía Geográfica, Jurisdicción Territorial y Herencia de Localidad

**Identificador de Especificación:** `SPEC-013`  
**Fase SDD:** Paso 5 - Desglose de Tareas Técnicas (Work Breakdown Structure)  
**Estado:** Pendiente de Ejecución  
**Plan de Referencia:** [plan.md](file:///c:/Users/CARITAS%20CARUPANO/Desktop/CodexFlow/specs/013-geographic-hierarchy-and-locality-inheritance/plan.md)  
**Especificación de Requerimientos:** [spec.md](file:///c:/Users/CARITAS%20CARUPANO/Desktop/CodexFlow/specs/013-geographic-hierarchy-and-locality-inheritance/spec.md)  

---

## Resumen de Ejecución y Dependencias

Las tareas están organizadas en 6 fases secuenciales. La ejecución debe progresar asegurando que el backend y sus contratos estén listos antes de integrar las vistas y modales de frontend, culminando con el enriquecimiento del motor de exportación y la batería de pruebas de control de calidad.

- **Fase 1:** Esquema de Metadatos y Motor de Resolución Contextual Ascendente (Backend).
- **Fase 2:** API de Sugerencias y Enriquecimiento de Endpoints de Folios/Carpetas (FastAPI).
- **Fase 3:** Frontend - Formulario y Modal con Autocompletado Territorial (`CreateFolderModal.tsx`).
- **Fase 4:** Frontend - Tarjeta Contextual y Bloqueo de Campos Redundantes en Visor (`visor/page.tsx`).
- **Fase 5:** Motor de Exportación FamilySearch DIP (Excel, CSV, GEDCOM 5.5.1, `manifest.json`).
- **Fase 6:** Pruebas E2E, Casos Límite y Verificación de Estándares Internacionales.

---

## Fase 1: Esquema de Metadatos y Motor de Resolución Contextual Ascendente (Backend)

- [x] **T01-BE-01**: Extender los esquemas Pydantic `FolderMetadata`, `FolderCreate` y `FolderUpdate` en `backend/main.py` para soportar las claves geográficas y jurisdiccionales: `country`, `state`, `municipality`, `city_or_locality`, `diocese_name`, `parish_name`.
- [x] **T01-BE-02**: Implementar la función de utilidad `build_canonical_place(city, municipality, state, country) -> Optional[str]` en `backend/main.py` para formatear la cadena estándar internacional en orden jerárquico ascendente `f"{localidad}, {municipio}, {estado}, {pais}"`, filtrando elementos nulos o vacíos.
- [x] **T01-BE-03**: Refactorizar y robustecer la función `_resolve_folder_inherited_context(client, folder_id, tenant_id)` en `backend/main.py`:
  - Recorrer la cadena de ancestros de la carpeta (`tome -> series -> parish -> root`) hasta 8 niveles con conjunto `visited` anti-ciclos.
  - Aplicar herencia con **sobreescritura parcial**: priorizar valores explícitos definidos en el tomo o carpetas intermedias y heredar los campos ausentes desde los ancestros.
  - Implementar fallback a la tabla `tenants` para obtener país y estado predeterminados si no se especificaron en ningún nivel del árbol.
  - Retornar el diccionario con todas las dimensiones individuales más la clave consolidada `canonical_place`.

---

## Fase 2: API de Sugerencias y Enriquecimiento de Endpoints Backend

- [x] **T02-BE-01**: Implementar el endpoint `GET /api/v1/folders/geographic-suggestions` en `backend/main.py`:
  - Consultar todas las carpetas del `tenant_id` autenticado.
  - Extraer, deduplicar y ordenar alfabéticamente las listas de `countries`, `states`, `municipalities`, `cities_or_localities`, `dioceses` y `parishes`.
  - Retornar la respuesta estructurada bajo el contrato `GeographicSuggestionsResponse`.
- [x] **T02-BE-02**: Enriquecer el endpoint `GET /api/v1/folios/{folio_id}/entries` en `backend/main.py`:
  - Inyectar en `inherited_context` los campos `country`, `state`, `municipality`, `city_or_locality`, `diocese_name`, `parish_name` y `canonical_place`.
  - Incluir en `inherited_tome_metadata` el campo `locality` con el valor de `canonical_place`.
- [x] **T02-BE-03**: Enriquecer el endpoint `GET /api/v1/folders/{folder_id}/pre-export-summary` en `backend/main.py`:
  - Evaluar si el tomo cuenta con información territorial mínima (`country` y `state`).
  - Si falta alguno de estos campos, emitir advertencia informativa no bloqueante en el arreglo `warnings` del resumen para alertar al archivista.

---

## Fase 3: Frontend - Formulario y Modal con Autocompletado Territorial (`CreateFolderModal.tsx`)

- [x] **T03-FE-01**: Actualizar los tipos TypeScript en `frontend/src/types/folders.ts` y `frontend/src/components/folders/types.ts` para tipar `GeographicMetadata` y los campos territoriales dentro de `DocumentFolder.metadata`.
- [x] **T03-FE-02**: Crear el hook de React `useGeographicSuggestions(tenantId)` para consultar y cachear los valores de `GET /api/v1/folders/geographic-suggestions`.
- [x] **T03-FE-03**: Rediseñar `frontend/src/components/folders/CreateFolderModal.tsx`:
  - Agregar sección colapsable con encabezado `"📍 Jurisdicción Territorial y Localidad Geográfica"` con icono `ChevronDown` / `ChevronUp`.
  - Mantener la sección expandida por defecto para tipos `root` y `parish`, y colapsable para `series` y `tome`.
  - Agregar campos de formulario para `country`, `state`, `municipality`, `city_or_locality`, `diocese_name` y `parish_name`.
  - Vincular los inputs a `<datalist>` HTML dinámicos alimentados por el hook de sugerencias para ofrecer autocompletado en tiempo real sin restringir texto libre.
- [x] **T03-FE-04**: Implementar en `CreateFolderModal.tsx` el prellenado inteligente: al crear una subcarpeta o tomo (`parentFolder` definido), inicializar los campos territoriales con los valores existentes en el padre, permitiendo al usuario sobreescribirlos si es necesario.
- [x] **T03-FE-05**: Asegurar que al someter el formulario en `CreateFolderModal.tsx`, los campos geográficos no vacíos se guarden dentro del objeto `metadata` tanto en creación (`POST`) como en edición (`PATCH`).

---

## Fase 4: Frontend - Tarjeta Contextual y Bloqueo de Campos en Visor (`visor/page.tsx`)

- [x] **T04-FE-01**: Actualizar la interfaz `InheritedContext` en `frontend/src/types/folioEntries.ts` para incluir `country`, `state`, `municipality`, `city_or_locality`, `canonical_place`.
- [x] **T04-FE-02**: Rediseñar la tarjeta superior de contexto en `frontend/src/app/[subdomain]/visor/page.tsx`:
  - Reemplazar la caja gris actual por una tarjeta estilizada con badge `📍 Localidad: {inheritedContext.canonical_place || 'No asignada'}`.
  - Incluir candado de solo lectura e información complementaria: Parroquia, Diócesis, Tomo y Años.
- [x] **T04-FE-03**: Ampliar la función `getInheritedFieldInfo(field)` en `visor/page.tsx` para detectar campos de plantilla asociados a localidad y geografía:
  - `lugar`, `place`, `lugar_suceso`, `lugar_bautismo`, `lugar_evento` $\rightarrow$ asignar `canonical_place`.
  - `pais`, `country`, `nacion` $\rightarrow$ asignar `country`.
  - `estado`, `state`, `provincia`, `departamento` $\rightarrow$ asignar `state`.
  - `municipio`, `municipality`, `canton` $\rightarrow$ asignar `municipality`.
  - `ciudad`, `localidad`, `city`, `pueblo` $\rightarrow$ asignar `city_or_locality`.
  - Deshabilitar (`readOnly` / `disabled`) dichos campos inyectando el valor heredado y mostrando el tooltip `"Campo heredado del tomo/jurisdicción"`.

---

## Fase 5: Motor de Exportación FamilySearch DIP (DIP Package)

- [x] **T05-BE-01**: Enriquecer la función `generate_familysearch_matrix` en `backend/exporters/familysearch.py`:
  - Agregar a las cabeceras de Excel y CSV las columnas: `pais`, `estado`, `municipio`, `ciudad_localidad`, `lugar_evento_estandarizado`.
  - Llenar cada fila con las dimensiones resueltas en `tome_metadata` o las específicas de la partida si existieran.
  - Garantizar autoajuste de ancho de columnas en `openpyxl` y preservar delimitador `;` con BOM en CSV.
- [x] **T05-BE-02**: Enriquecer la función `generate_gedcom_551` en `backend/exporters/familysearch.py`:
  - En los eventos vitales (`BIRT`, `CHR`, `MARR`, `DEAT`), asignar la etiqueta `2 PLAC {canonical_place}` utilizando la cadena estándar en orden ascendente.
  - Implementar caso límite: si no existe localidad en ningún nivel ni en el perfil del tenant, omitir de forma segura la etiqueta `2 PLAC` sin romper la sintaxis del registro `INDI`.
- [x] **T05-BE-03**: Enriquecer la función `generate_manifest_json` en `backend/exporters/familysearch.py`:
  - Incorporar en el objeto `tome_info` el nodo `geographic_coverage` con: `country`, `state`, `municipality`, `city_or_locality`, `standardized_place` e `is_partially_inherited`.
- [x] **T05-BE-04**: Verificar en `backend/main.py` (`export_familysearch_package`) que el diccionario `tome_metadata` enviado a los tres generadores contenga la resolución completa de `_resolve_folder_inherited_context`.

---

## Fase 6: Pruebas de Integración y Validación QA

- [x] **T06-QA-01**: Validar la resolución ascendente en backend con pruebas unitarias:
  - Caso 1: Valores definidos solo en Diócesis raíz se heredan hasta el Tomo.
  - Caso 2: Parroquia redefine Municipio y Tomo redefine Localidad conservando País y Estado de la raíz.
- [x] **T06-QA-02**: Validar en frontend la sugerencia en datalists y el prellenado automático al abrir el modal para crear carpetas hijas en `CreateFolderModal.tsx`.
- [x] **T06-QA-03**: Validar en el Visor de Indexación que los campos de plantilla redundantes queden bloqueados en solo lectura con sus valores heredados correspondientes.
- [x] **T06-QA-04**: Validar el paquete DIP generado (`.ZIP`):
  - Verificar que `matriz_indexacion.xlsx` y `matriz_indexacion.csv` contengan las 5 columnas geográficas completas.
  - Validar sintácticamente `export_gedcom.ged` asegurando la presencia de `2 PLAC` bien formateado y la correcta omisión cuando no hay datos.
  - Validar la presencia de `tome_info.geographic_coverage` en `manifest.json`.
- [x] **T06-QA-05**: Validar el recálculo retroactivo: modificar la localidad de una parroquia padre y verificar inmediatamente que las exportaciones y vistas de folios hijos reflejen los nuevos valores sin tocar folios en base de datos.
