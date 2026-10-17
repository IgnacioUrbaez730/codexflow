# TASKS-014: Tareas Técnicas - Estándar Archivístico, Foliación Recto/Vuelto, Plantillas Maestras FamilySearch y Filtro Estricto DIP

## Fase 1: Modelo de Datos y Migraciones SQL
- [x] **T01-DB-01: Migración de foliación archivística en `folio_entries`**
  - Agregar columnas `folio_number` (INT), `folio_side` (VARCHAR(10) CHECK ('recto', 'vuelto', 'unica')), `act_number` (VARCHAR(50)), `is_continued` (BOOLEAN DEFAULT FALSE) y `continued_from_entry_id` (UUID FK a `folio_entries`).
  - Crear índice de búsqueda rápida `idx_folio_entries_status_tenant` sobre `(tenant_id, status)`.
- [x] **T01-DB-02: Migración de inmutabilidad en `templates`**
  - Agregar columna `is_system_template` (BOOLEAN DEFAULT FALSE) en la tabla `templates`.
  - Crear regla de integridad o trigger en PostgreSQL para impedir la eliminación o modificación de campos base en registros con `is_system_template = true`.
- [x] **T01-DB-03: Seed de las 3 Plantillas Maestras Oficiales FamilySearch**
  - Insertar/actualizar plantilla oficial de **Bautismo / Nacimiento** (`is_system_template = true`) con todos los campos canónicos (infante, padres, abuelos paternos/maternos, padrinos, ministro, notas marginales).
  - Insertar/actualizar plantilla oficial de **Matrimonio** (`is_system_template = true`) con campos completos para ambos contrayentes, orígenes, padres, testigos y ministro.
  - Insertar/actualizar plantilla oficial de **Defunción / Entierro** (`is_system_template = true`) con causa de muerte, cónyuge, padres, cementerio y ministro.

---

## Fase 2: Backend - API y Motor de Exportación DIP FamilySearch
- [x] **T02-BE-01: Extender esquemas Pydantic y endpoints de partidas**
  - Actualizar `FolioEntryCreate` y `FolioEntryUpdate` en `backend/main.py` para admitir `folio_number`, `folio_side`, `act_number`, `is_continued` y `continued_from_entry_id`.
  - Retornar estos campos en las consultas de folios y partidas.
- [x] **T02-BE-02: Filtro Estricto en el Exportador DIP (`familysearch.py`)**
  - Modificar `export_familysearch_package` en `backend/main.py` y `backend/exporters/familysearch.py` para filtrar partidas exclusivamente donde `status IN ('completed', 'verified')`.
  - Asegurar que `matriz_indexacion.xlsx`, `matriz_indexacion.csv` y `export_gedcom.ged` posean **cero filas en estado `pending`**.
  - Si el total de partidas completadas es 0, devolver error HTTP 400 con mensaje explicativo claro.
- [x] **T02-BE-03: Empaquetamiento selectivo de imágenes y nomenclatura canónica con cara**
  - En la generación del archivo ZIP con `include_images=True`, filtrar la descarga desde R2 incluyendo únicamente las fotos de folios que contengan al menos una partida completada.
  - Implementar nomenclatura canónica con foliación física y cara: `[PREFIJO_TOMO]_F{folio_number:03d}{R|V}.jpg` (ej. `CARUPANO_BAU_T01_F014R.jpg`).
- [x] **T02-BE-04: Consolidación de partidas continuadas interfolio**
  - Identificar partidas marcadas con `is_continued=True` asociadas a una partida de folio anterior y unificar sus campos de texto y observaciones en la fila matriz de la partida original, referenciando la imagen inicial.
- [x] **T02-BE-05: Manifiesto de Calidad con Trazabilidad Completa**
  - Actualizar `generate_manifest_json` para reportar explícitamente `total_tome_folios`, `exported_entries_count`, `excluded_pending_folios` y porcentaje de calidad.
- [x] **T02-BE-06: Reparación y Optimización del Endpoint `/api/v1/records`**
  - Refactorizar la consulta de `/api/v1/records` en `backend/main.py` para paginar directamente a nivel de base de datos con `range()`, resolviendo el bloqueo por consulta infinita.
  - Devolver foliación física (`folio_number`, `folio_side`), número de acta y datos de personas para renderizado inmediato en frontend.

---

## Fase 3: Frontend - UI/UX y Visor de Indexación
- [x] **T03-FE-01: Barra de Foliación Archivística en Visor (`TranscriptionPanel.tsx`)**
  - Añadir campo numérico `Folio Físico`.
  - Añadir selector interactivo bimembre de dos botones: `[ Recto (Frente) ]` y `[ Vuelto (Espalda) ]`.
  - Añadir input `Acta N°` con casilla `[ ] S/N`.
  - Añadir toggle `[ ] Continuación de folio anterior`.
- [x] **T03-FE-02: Atajo `Ctrl + Enter` con Alternancia Ergonómica de Caras**
  - Implementar lógica al pulsar `Ctrl + Enter`:
    - Guardar partida actual como `completed`.
    - Si la cara actual es `recto`, sugerir automáticamente la misma numeración con cara `vuelto`.
    - Si la cara actual es `vuelto`, avanzar automáticamente al siguiente folio físico (`folio_number + 1`) con cara `recto`.
- [x] **T03-FE-03: Alerta visual no bloqueante por saltos de foliación**
  - Mostrar badge de advertencia cuando se detecte discontinuidad en la numeración de folios (ej. salto de 12v a 14r por hoja arrancada o faltante).
- [x] **T03-FE-04: Protección de Plantillas del Sistema en Interfaz de Configuración**
  - En la vista de gestión de plantillas (`/templates`), deshabilitar botones de eliminación y edición de campos base para plantillas con `is_system_template: true`, mostrando un badge de *"Plantilla Oficial FamilySearch"*.
  - Permitir acción de *"Duplicar"* para crear versiones personalizadas.
- [x] **T03-FE-05: Actualización del Modal de Exportación DIP (`ExportFamilySearchModal.tsx`)**
  - Mostrar contador de actas completadas a exportar y páginas pendientes que serán excluidas.
  - Deshabilitar el botón de exportación con mensaje informativo si el tomo tiene 0 actas completadas.
- [x] **T03-FE-06: Reparación y Rediseño del Explorador de Registros (`/records/page.tsx`)**
  - Conectar a la nueva respuesta paginada y optimizada del backend.
  - Mostrar columnas de Folio Físico con Cara (ej. *F.14r*), Número de Acta, Persona Principal, Fecha y Estado.
  - Garantizar carga fluida sub-segundo y buscador reactivo sin freeze.

---

## Fase 4: Tooling Aislado de Demo Data y Testing
- [x] **T04-QA-01: Script Aislado de Generación de Datos de Prueba (`seed_demo_data.py`)**
  - Crear script en `tools/seeding/seed_demo_data.py` aislado del build de producción.
  - Insertar tomo de prueba con 10 folios físicos correlativos (caras Recto y Vuelto) y 25 actas (mezcla de `completed`, `verified` y `pending`).
- [x] **T04-QA-02: Verificación de Exportación DIP y Matrices**
  - Ejecutar prueba unitaria/de integración verificando que el paquete exportado no contenga ninguna fila con estado `pending`.
  - Verificar que las imágenes incluidas correspondan exclusivamente a folios con partidas completadas.
- [x] **T04-QA-03: Prueba de rendimiento y auditoría de integridad**
  - Validar que el explorador de registros `/records` responda en menos de 1 segundo.
  - Validar integridad de manifest.json con las métricas de exclusión.
