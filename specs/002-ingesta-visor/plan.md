# Plan Técnico: Módulo 2 - Ingesta de Imágenes y Visor Dual

## 1. Esquema de Base de Datos (PostgreSQL / Supabase)
Se crearán o extenderán las siguientes tablas, garantizando el aislamiento Multi-Tenant (RLS por `tenant_id`):

- **`templates`**
  - `id` (UUID, PK)
  - `tenant_id` (UUID, FK a tenants)
  - `name` (String)
  - `schema` (JSONB): Define la estructura dinámica del formulario (campos, tipos, opciones).
  - `created_at` (Timestamp)

- **`batches`** (Lotes)
  - `id` (UUID, PK)
  - `tenant_id` (UUID, FK a tenants)
  - `template_id` (UUID, FK a templates)
  - `uploaded_by` (UUID, FK a users): Registra quién subió el lote, esencial para el RF-12 (Archivistas solo ven dudosos de sus lotes).
  - `status` (Enum: pending, processing, ready, failed)
  - `created_at` (Timestamp)

- **`folios`**
  - `id` (UUID, PK)
  - `tenant_id` (UUID, FK a tenants)
  - `batch_id` (UUID, FK a batches)
  - `status` (Enum: pending, processing, revision, completed, failed)
  - `metadata` (JSONB): Almacenará los datos ingresados por el digitador según el esquema del template.
  - `r2_url` (String): URL base en R2 para acceder a los assets del folio (DZI y teselas).
  - `created_at`, `updated_at` (Timestamp)

## 2. Arquitectura Backend (FastAPI / Worker)
El backend procesará los archivos pesados de manera asíncrona:
- **Background Tasks:** Se utilizarán tareas en segundo plano en FastAPI (BackgroundTasks) para el procesamiento sin bloquear al usuario.
- **Procesamiento de PDF e Imágenes:** 
  - `poppler`: Para extraer imágenes de los archivos PDF.
  - `vips`: Para procesar las imágenes rápida y eficientemente en formato de Pirámide de Teselas Deep Zoom Image (DZI).
- **Almacenamiento:** Subida de las teselas DZI generadas a Cloudflare R2 y actualización de `r2_url` en la tabla `folios`. Proveer de URLs firmadas para la visualización.

## 3. Arquitectura Frontend (Next.js)
El frontend gestionará la interacción de los usuarios de manera eficiente:
- **Subida Directa a R2:** El cliente solicitará URLs firmadas (Signed URLs) a la API y realizará la subida de los archivos pesados (PDFs/Imágenes) directamente desde el navegador a Cloudflare R2 (RF-4).
- **Visor Dual Ergonómico:** 
  - Integración de **OpenSeadragon** para consumir las teselas DZI generadas, garantizando una carga < 1.2s y zoom profundo.
  - Formulario dinámico renderizado a partir del campo `schema` (JSONB) del `template`.
  - Gestión integral por atajos de teclado (`Ctrl + Enter` para guardar, `Ctrl + Espacio` para marcar como dudoso).
- **Bandeja de Dudosos:** Panel para listar y corregir folios con estado `revision`, aplicando reglas de visibilidad por RLS (`uploaded_by`).
