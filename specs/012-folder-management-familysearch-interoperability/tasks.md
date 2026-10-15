# Tareas de Implementación: Gestión de Carpetas/Tomos e Interoperabilidad FamilySearch

**Identificador de Especificación:** `SPEC-012`  
**Fase SDD:** Paso 5 - Desglose de Tareas Técnicas (Work Breakdown Structure)  
**Estado:** Pendiente de Ejecución  
**Plan de Referencia:** [plan.md](file:///c:/Users/CARITAS%20CARUPANO/Desktop/CodexFlow/specs/012-folder-management-familysearch-interoperability/plan.md)  

---

## Resumen de Ejecución y Dependencias

Las tareas están organizadas en 5 fases secuenciales. Ninguna fase debe iniciarse antes de validar los criterios de aceptación de la fase anterior.

- **Fase 1:** Base de Datos, Migraciones y Políticas de Seguridad (Supabase/PostgreSQL).
- **Fase 2:** Backend - Servicios y Endpoints de Carpetas/Tomos (FastAPI).
- **Fase 3:** Frontend - Árbol de Navegación DCam y Reasignación de Folios.
- **Fase 4:** Frontend & Backend - Ergonomía de Captura Multi-Partida (FamilySearch Indexing).
- **Fase 5:** Motor de Exportación FamilySearch (DIP, Excel, CSV, GEDCOM, Streaming ZIP).

---

## Fase 1: Base de Datos y Políticas de Seguridad RLS

- [x] **T01-DB-01**: Crear migración SQL en Supabase para el tipo enumerado `folder_type_enum` ('root', 'parish', 'series', 'tome') y la tabla `document_folders` con soporte de `parent_id`, `metadata` JSONB y auditoría (`created_by`, `created_at`).
- [x] **T01-DB-02**: Crear migración SQL para agregar columnas `folder_id`, `sequence_order`, `original_filename` y `canonical_filename` en la tabla `folios`, con índices referenciales.
- [x] **T01-DB-03**: Crear migración SQL para la tabla `folio_entries` (`id`, `tenant_id`, `folio_id`, `entry_number`, `status`, `metadata`, `bounding_box`), con restricción de unicidad `UNIQUE (folio_id, entry_number)`.
- [x] **T01-DB-04**: Implementar políticas de seguridad RLS en `document_folders` y `folio_entries` restringiendo lectura a miembros del mismo `tenant_id` y escritura a roles permitidos (`admin`, `archivist`, `digitizer`).
- [x] **T01-DB-05**: Crear script/función SQL de migración hacia atrás que cree la carpeta virtual *"Sin Clasificar (Migración inicial)"* en cada organización y asigne a ella todos los folios existentes con `folder_id IS NULL`.

---

## Fase 2: Backend - API de Gestión de Carpetas y Tomos

- [x] **T02-BE-01**: Crear esquemas Pydantic para `FolderCreate`, `FolderUpdate`, `FolderResponse` y `FolderTreeResponse`.
- [x] **T02-BE-02**: Implementar servicio `FolderService` en FastAPI para operaciones CRUD del árbol documental, validando que no se eliminen carpetas que contengan hijos o folios sin reasignación previa.
- [x] **T02-BE-03**: Implementar endpoint `GET /api/v1/folders/tree` que arme recursivamente la jerarquía documental Diócesis $\rightarrow$ Parroquia $\rightarrow$ Serie $\rightarrow$ Tomo con contadores de folios y partidas.
- [x] **T02-BE-04**: Implementar endpoint `POST /api/v1/folders/{id}/assign-folios` que permita reasignar folios sueltos a un tomo, asignando la plantilla del tomo destino y calculando la secuencia correlativa final.
- [x] **T02-BE-05**: Agregar pruebas unitarias y de integración para el servicio de carpetas validando permisos RBAC (`digitizer` bloqueado para crear/mover carpetas).

---

## Fase 3: Frontend - Explorador de Carpetas (DCam Tree) y Reasignación

- [x] **T03-FE-01**: Crear componente de interfaz de árbol jerárquico `DocumentFolderTree` en Next.js con soporte de expansión/colapso, insignias de tipo de carpeta e indicadores de progreso.
- [x] **T03-FE-02**: Diseñar modal/formulario para crear y editar tomos con campos requeridos: Años Extremos (inicio/fin), Número de Tomo, Ubicación física (Caja/Estante) y selector de Plantilla de Indexación.
- [x] **T03-FE-03**: Implementar vista y filtros de *"Folios Sin Clasificar"* con acción en lote para *"Mover a Tomo existente"*.
- [x] **T03-FE-04**: Integrar protección de interfaz RBAC ocultando botones de creación y arrastre a usuarios con rol `digitizer`.

---

## Fase 4: Frontend y Backend - Captura Multi-Partida (FamilySearch Indexing)

- [x] **T04-BE-01**: Crear esquemas Pydantic y endpoints en FastAPI para `GET /api/v1/folios/{id}/entries` y `PUT /api/v1/folios/{id}/entries/{entry_id}`.
- [x] **T04-BE-02**: Implementar lógica de herencia de metadatos en el backend: responder datos inmutables del libro (Diócesis, Parroquia, Tomo, Rango de años) junto a cada partida.
- [x] **T04-FE-01**: Rediseñar panel lateral del Visor para soportar pestañas/tarjetas de partidas (*Partida 1*, *Partida 2*, etc.) con botón dinámico `+ Agregar Partida` y atajo global `Alt + N`.
- [x] **T04-FE-02**: Implementar renderizado de campos de cabecera heredados del tomo en estado bloqueado (solo lectura / disabled) con tooltip informativo "Campo heredado del tomo".
- [x] **T04-FE-03**: Implementar listeners de atajos de teclado estándar FamilySearch en los inputs de transcripción:
  - `Ctrl + U`: Asigna valor `<Ilegible>` al input enfocado.
  - `Ctrl + B`: Asigna valor `<En Blanco>` al input enfocado.
  - `Ctrl + D`: Copia el valor del mismo campo desde la partida precedente (`entry_number - 1`).
- [x] **T04-FE-04**: Implementar flujo de guardado y avance con `Ctrl + Enter`: guardar partida activa y cambiar el foco a la siguiente partida; si es la última, solicitar y cargar el siguiente folio de la cola.
- [x] **T04-FE-05**: Adaptar el visor de imágenes con OpenSeadragon/Canvas para renderizar y resaltar bounding boxes segmentados por partida según la pestaña seleccionada.

---

## Fase 5: Motor de Exportación e Interoperabilidad FamilySearch (DIP)

- [ ] **T05-BE-01**: Implementar generador de matrices tabulares `FamilySearchMatrixExporter`:
  - Archivo `.xlsx` estilizado con cabeceras formales y columna mandatoria `image_file_name`.
  - Archivo `.csv` con delimitador `;` y codificación UTF-8 con BOM.
- [ ] **T05-BE-02**: Implementar generador de archivo genealógico `GEDCOMExporter` conforme a la especificación GEDCOM 5.5.1 (cabecera `HEAD`, registros `INDI`, eventos `BIRT`/`CHR`/`MARR`/`DEAT`, y vínculos a objetos multimedia `OBJE`).
- [ ] **T05-BE-03**: Implementar generador del archivo `manifest.json` que detalle metadatos del tomo, fechas, resúmenes estadísticos de transcripción y pares `original_filename` $\leftrightarrow$ `canonical_filename`.
- [ ] **T05-BE-04**: Desarrollar endpoint de auditoría previa `GET /api/v1/folders/{id}/pre-export-summary` con conteos de partidas completadas vs. en revisión / dudosas.
- [ ] **T05-BE-05**: Implementar endpoint `GET /api/v1/folders/{id}/export-familysearch` en FastAPI con `StreamingResponse`, descargando en chunks las imágenes desde Cloudflare R2 y construyendo el `.ZIP` en memoria acotada (streaming chunked).
- [ ] **T05-FE-01**: Crear diálogo modal en frontend `ExportFamilySearchModal` que muestre el resumen de control de calidad (alertas de partidas dudosas) y el botón de descarga del paquete DIP.
- [ ] **T05-QA-01**: Ejecutar pruebas integrales E2E de exportación: validar integridad del ZIP, correspondencia de nombres en Excel vs. archivos de imagen, y conformidad sintáctica del GEDCOM.
