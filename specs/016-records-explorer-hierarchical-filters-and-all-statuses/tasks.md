# Lista de Tareas de Implementación — SPEC-016: Rediseño Jerárquico del Explorador de Registros (`/records`), Filtrado por Tomos/Carpetas y Visibilidad Multi-Estado

## Fase 1: Backend — Unificación Multi-Estado, Filtros Jerárquicos y Contadores (`backend/main.py`)

- [x] **T01-BE-01: Nuevos parámetros y resolución de Series/Tomos en `GET /api/v1/records`**
  - **Archivo:** `backend/main.py`
  - **Descripción:**
    - Añadir los parámetros de consulta `series: Optional[str] = None`, `folder_id: Optional[str] = None` y `status: Optional[str] = "all"` a `get_records`.
    - Consultar `document_folders` del `tenant_id` para construir un mapa de carpetas que identifique el nombre de cada Tomo (`tome_name`) y su serie sacramental (`bautismo`, `matrimonio`, `defuncion`, `unclassified`) ya sea por su carpeta padre (`folder_type == 'series'`), su `metadata.series` o inferencia por nombre.
    - Soportar el filtro `series="unclassified"` y `folder_id="unclassified"` para aislar folios cuyo `folder_id` sea `None` o apunte a la carpeta virtual sin clasificar.

- [x] **T01-BE-02: Unificación de `folio_entries` con `folios` sin entradas o en blanco**
  - **Archivo:** `backend/main.py`
  - **Descripción:**
    - Eliminar la restricción `.in_("status", ["completed", "verified"])` en `GET /api/v1/records`.
    - Consultar los `folios` del tenant (aplicando filtro de `folder_id`/`series`/`batch_id`) y sus `folio_entries` asociados.
    - Para cada folio que tenga filas en `folio_entries`, generar una fila por cada partida incluyendo `total_entries_in_folio`, `entry_number`, `folio_number`, `folio_side`, `act_number`, `is_continued` y `is_blank`.
    - Para cada folio que NO tenga filas en `folio_entries` (ej. recién subidos en estado `pending`, `in_progress`, `revision`, o marcados como folio en blanco `is_blank: true`), generar una fila virtual en la lista unificada para que ningún folio quede oculto.

- [x] **T01-BE-03: Búsqueda Multicriterio, Filtro por Fecha Histórica, Contadores Globales y Ordenamiento Archivístico**
  - **Archivo:** `backend/main.py`
  - **Descripción:**
    - Implementar el filtro `search` multicriterio sobre la lista unificada: coincidencia por `principal_person`, nombres de padres/cónyuges/padrinos en `metadata`, `act_number`, código de folio físico (`F.14r`, `F.14v`) y `canonical_filename`.
    - Implementar el filtro `start_date` y `end_date` evaluando prioritariamente la fecha histórica del evento sacramental (`event_date` en `metadata`) con fallback seguro a `created_at`.
    - Calcular el diccionario global `counts = { "total", "completed", "verified", "pending", "revision", "in_progress" }` antes de aplicar el recorte por `status`.
    - Aplicar el filtro `status` (si `status != "all"`) y ordenar mediante **Ordenamiento Archivístico Natural**: por Tomo (`tome_name`), `folio_number` ascendente, cara (`recto` antes que `vuelto`) y `entry_number` ascendente.
    - Retornar en el JSON de respuesta el objeto `"counts": counts` junto con `"data"`, `"total_records"`, `"page"`, `"page_size"` y `"total_pages"`.

- [x] **T01-BE-04: Endpoint de Arbitraje de Calidad `PATCH /api/v1/records/{record_id}/status` y soporte dual en `PATCH /api/v1/records/{record_id}`**
  - **Archivo:** `backend/main.py`
  - **Descripción:**
    - Crear el endpoint `PATCH /api/v1/records/{record_id}/status` (y extender `PATCH /api/v1/records/{record_id}`) permitiendo a los roles `admin`, `archivist`, `evaluator` y `superadmin` actualizar metadatos y/o cambiar el estado de una partida (`folio_entries`) o de su folio padre (`folios`) a `"verified"`, `"revision"`, `"pending"` o `"completed"`.
    - Cuando el nuevo estado sea `"verified"`, sellar `verified_at = datetime.now(timezone.utc).isoformat()`.
    - Cuando el nuevo estado sea `"pending"` o `"revision"`, limpiar `locked_at = None` en el folio padre.
    - Actualizar `GET /api/v1/records/export` para aceptar también `series`, `folder_id` y `status`.

---

## Fase 2: Frontend — Barra de Contadores, Filtros en Cascada, Tabla Multi-Estado y Arbitraje (`frontend/src/app/[subdomain]/records/page.tsx`)

- [x] **T02-FE-01: Barra de Contadores Interactivos y Barra de Filtros en Cascada (`Serie ➔ Tomo ➔ Estado`)**
  - **Archivo:** `frontend/src/app/[subdomain]/records/page.tsx`
  - **Descripción:**
    - Renderizar en la parte superior 5 tarjetas/píldoras interactivas (`Todos (Total)`, `Completados`, `Verificados`, `Pendientes`, `Dudosos / Revisión`) alimentadas por `resJson.counts`. Al hacer clic en una tarjeta, cambiar `selectedStatus` y recargar la página 1.
    - Reemplazar el antiguo selector de `"Lote"` por la nueva Barra de Filtros en Cascada de 6 controles:
      1. `Serie / Carpeta` (`Todas las series`, `Bautismos`, `Matrimonios`, `Defunciones`, `Sin Clasificar`).
      2. `Tomo / Libro` (filtrado dinámicamente según la serie seleccionada; al elegir un tomo específico, sincronizar automáticamente `selectedTomeForExport`).
      3. `Estado` (`Todos los estados`, `Completado`, `Verificado`, `Pendiente`, `Dudoso / En Revisión`, `En Progreso`).
      4. `Búsqueda Integral` (`Persona, padres, acta, F.14r, archivo...`).
      5. `DESDE (FECHA ACTA)`.
      6. `HASTA (FECHA ACTA)`.
    - Añadir opción de `100` registros por página en el selector de paginación (`20`, `50`, `100`).

- [x] **T02-FE-02: Rediseño de la Tabla de Registros (Multi-Partida, Insignias y Acciones Contextuales)**
  - **Archivo:** `frontend/src/app/[subdomain]/records/page.tsx`
  - **Descripción:**
    - **Columna Acta / Partida:** Mostrar `Acta {act_number}` + badge `Partida {entry_number} de {total_entries_in_folio}` cuando el folio tenga múltiples partidas + insignia `↪ Continúa de folio anterior` si `is_continued === true`.
    - **Columna Folio Físico:** Mostrar badge monoespaciado `F.{folio_number}{r|v}`.
    - **Columna Persona Principal:**
      - Si `is_blank` o `metadata?.is_blank`: mostrar badge `"📄 Folio en Blanco / Sin Partidas"` + código `canonical_filename` debajo.
      - Si `status === "pending"` (o `"in_progress"`) sin titular aún: mostrar `"⏳ Pendiente de transcripción"` + código `canonical_filename` debajo.
      - Si tiene titular: mostrar Nombre completo destacado + código `canonical_filename` debajo.
    - **Columna Estado:** Renderizar badges cromáticos para los 5 estados (`Verificado`, `Completado`, `Pendiente`, `Dudoso / Revisión`, `En Progreso`).
    - **Columna Acciones Contextuales:**
      - Si `status` es `pending`, `revision` o `in_progress`: mostrar botón primario **`[ Transcribir en Visor ]`** (`/visor?folio_id={folio_id}`) + botón **`[ Detalle ]`**.
      - Si `status` es `completed` o `verified`: mostrar botón **`[ Detalle ]`** + botón **`[ Visor ]`**.

- [x] **T02-FE-03: Modal `"Detalle"` con Carga Bajo Demanda de Imagen y Arbitraje de Calidad**
  - **Archivo:** `frontend/src/app/[subdomain]/records/page.tsx`
  - **Descripción:**
    - Al abrir el modal `"Detalle"` (`handleOpenDetail`), si el registro no trae `view_url`, consultar bajo demanda `GET /api/v1/folios/{folio_id}` para obtener la URL firmada de R2 y los campos de plantilla (`template.fields`) sin sobrecargar la tabla principal.
    - Añadir en el formulario del modal `"Detalle"` la barra de botones de arbitraje de calidad para `admin`, `archivist`, `evaluator` y `superadmin`:
      - **`[ ✔ Verificar Acta ]`** (cambia estado a `verified`).
      - **`[ ⚠ Marcar Dudoso ]`** (cambia estado a `revision`).
      - **`[ ↩ Devolver a Pendiente ]`** (cambia estado a `pending`).
      - **`[ Guardar Cambios ]`** (guarda metadatos editados).

---

## Fase 3: Pruebas y Verificación de Calidad

- [x] **T03-QA-01: Pruebas de Integración Backend y Compilación Frontend**
  - **Archivos:** `backend/tests/test_records_explorer_spec016.py`, `frontend/src/app/[subdomain]/records/page.tsx`
  - **Descripción:**
    - Crear y ejecutar pruebas automatizadas con `pytest` para verificar el listado multi-estado, la inclusión de folios pendientes y en blanco, el cálculo de `counts`, el ordenamiento archivístico natural y el endpoint `PATCH /api/v1/records/{record_id}/status`.
    - Verificar que el frontend compila limpiamente (`npm run build` / `tsc --noEmit`).
