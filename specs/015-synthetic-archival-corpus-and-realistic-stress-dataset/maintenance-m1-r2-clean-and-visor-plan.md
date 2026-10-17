# Plan de Mantenimiento M1: Purga Multi-Tenant en Cloudflare R2, Sincronización JPG y Limpieza del Visor (SPEC-015)

## 1. Diagnóstico de Causa Raíz

Durante la auditoría del despliegue del corpus paleográfico (SPEC-015), se identificaron tres desviaciones críticas respecto a la arquitectura Multi-Tenant y el estándar archivístico de CodexFlow:

1. **Violación de aislamiento Multi-Tenant en Storage**:
   Las 60 imágenes del corpus fueron subidas a una carpeta huérfana `corpus/` en la raíz del bucket `codexflow-folios` en lugar de alojarse bajo el prefijo oficial de la organización (`4bf4e846-b22d-4105-aacf-3751cc0de60c/`). Adicionalmente, en dicho prefijo de la ONG permanecían 9 archivos residuales de pruebas antiguas (imágenes de WhatsApp, escudos institucionales y archivos `.jfif`) que contaminaban el inventario físico del tenant.

2. **Formato no fotográfico**:
   Las láminas se generaron y subieron como gráficos vectoriales (`.svg` con `Content-Type: image/svg+xml`) en lugar de imágenes fotográficas rasterizadas `.jpg` (`image/jpeg`) de alta resolución (`1500x2000 px`), incumpliendo el estándar de preservación archivística y los requisitos de ingesta de FamilySearch.

3. **Contaminación del código en Backend (`backend/main.py`) y Frontend (`frontend/src/app/[subdomain]/visor/page.tsx`)**:
   Se introdujeron parches de simulación (`data:image/`), una ruta intermedia innecesaria en Next.js (`frontend/src/app/api/v1/folios/[folioId]/image/route.ts`) y un manejador `onError` en el visor que inyectaba un SVG oscuro (`#1f2937`) silenciosamente, ocultando los fallos de carga reales y dejando el lienzo del visor en negro.

---

## 2. Arquitectura de Reparación

Para restaurar la integridad del almacenamiento, la base de datos y el código fuente sin afectar las transcripciones existentes (`folio_entries`), se establece el siguiente plan de remediación:

1. **Saneamiento y Purga en Cloudflare R2**:
   - Eliminar los 9 objetos residuales de prueba alojados en `4bf4e846-b22d-4105-aacf-3751cc0de60c/`.
   - Eliminar por completo los 60 objetos alojados en la carpeta huérfana `corpus/` dentro del bucket `codexflow-folios`.

2. **Generación y Subida Canónica de Imágenes `.jpg`**:
   - Generar/convertir las 60 imágenes paleográficas a formato rasterizado `.jpg` real (`Content-Type: image/jpeg`, resolución `1500x2000 px`).
   - Subir las 60 imágenes directamente bajo el prefijo Multi-Tenant de la ONG: `4bf4e846-b22d-4105-aacf-3751cc0de60c/{canonical_filename}`.

3. **Sincronización Atómica en Supabase (`folios.r2_url`)**:
   - Actualizar de forma atómica el campo `r2_url` de los 60 folios en la tabla `folios` de Supabase para que apunten exactamente a `4bf4e846-b22d-4105-aacf-3751cc0de60c/{canonical_filename}`, preservando intactos sus `id` y todos los registros de `folio_entries` vinculados.

4. **Limpieza de Código en Backend y Frontend**:
   - Limpiar `backend/main.py` eliminando cualquier lógica de bypass o parches para `data:image/`, manteniendo únicamente el flujo nativo de generación de Presigned URLs de Cloudflare R2 (`s3_client.generate_presigned_url`).
   - Eliminar la ruta intermedia `frontend/src/app/api/v1/folios/[folioId]/image/route.ts`.
   - Limpiar `frontend/src/app/[subdomain]/visor/page.tsx` eliminando el placeholder oscuro en `onError` y cualquier parche de simulación, dejando el flujo limpio de consumo de Presigned URLs desde el backend.
