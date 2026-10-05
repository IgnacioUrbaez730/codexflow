# Tareas: Módulo 2 - Ingesta de Imágenes y Visor Dual

- [x] **T1: Migraciones de Base de Datos y RLS**
  - Crear la tabla `templates` con sus columnas (`schema` JSONB, etc.).
  - Crear la tabla `batches` con la columna `uploaded_by`.
  - Crear la tabla `folios` con `status`, `metadata` JSONB y `r2_url`.
  - Configurar las políticas RLS de Supabase para asegurar que solo los usuarios del mismo `tenant_id` puedan acceder, además de la política específica para que el Archivista solo vea los `folios` dudosos de los lotes donde él es el `uploaded_by`.

- [x] **T2: API de Next.js - Gestión de Templates**
  - Implementar los endpoints para crear y listar plantillas (`templates`).
  - Crear la interfaz en el frontend para que el Admin diseñe el formulario (JSON Schema) y proveer plantillas maestras sugeridas.

- [x] **T3: API de Subida y Signed URLs**
  - Implementar endpoint en Next.js (o FastAPI) para generar URLs firmadas (Signed URLs) para Cloudflare R2.
  - Implementar el componente de subida en el frontend que permite cargar PDFs/imágenes directamente a R2 utilizando la Signed URL (validando pesos según plan premium/gratuito y límite de 20 imágenes o 50MB).

- [x] **T4: Backend de FastAPI - Ingesta y Tareas en Segundo Plano**
  - Implementar el endpoint que recibe la confirmación de subida del archivo.
  - Configurar Background Tasks para iniciar el procesamiento asíncrono.
  - Marcar el lote en estado `processing` y crear los `folios` iniciales en estado `pending` en la base de datos (RF-5).

- [x] **T5: Worker - Procesamiento con Poppler y Vips**
  - Implementar el script interno en FastAPI que descarga o accede al archivo original.
  - Usar `poppler` para extraer páginas de PDFs si aplica.
  - Usar `vips` para generar la pirámide de teselas DZI para cada página/imagen.
  - Subir las teselas generadas a Cloudflare R2 y actualizar el `r2_url` y `status` del `folio`.

- [x] **T6: Frontend - Visor Dual Ergonómico**
  - Crear la ruta y layout del visor dual.
  - Integrar la biblioteca **OpenSeadragon** a la izquierda para renderizar las DZI desde las Signed URLs.
  - Renderizar a la derecha el formulario dinámico basado en el `schema` del template del lote.
  - Implementar la validación de tipos estricta en el formulario.

- [x] **T7: Frontend - Atajos de Teclado y Estados**
  - Implementar `Ctrl + Enter` para guardar: Validar formulario, actualizar metadata del `folio`, descontar de cuota, cambiar estado a `completed` y cargar el siguiente.
  - Implementar `Ctrl + Espacio` para dudar: Descontar cuota, cambiar estado a `revision` y cargar el siguiente.
  - Manejar el caso de llegar al último folio (redirección a panel final).

- [ ] **T8: Frontend - Bandeja de Dudosos**
  - Crear la vista de la bandeja de dudosos.
  - Consumir el listado de folios en `revision` (Supabase RLS filtra los del Archivista o todos para Admin).
  - Permitir cargar el Visor Dual desde la bandeja y guardar (`Ctrl + Enter`) sin consumir crédito adicional.
