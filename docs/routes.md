# MAPA DE RUTAS Y ARQUITECTURA DE NAVEGACIÓN — CODEXFLOW

Este documento recopila la totalidad de las rutas de usuario (Frontend - Next.js) y los puntos de enlace de la API (Backend - FastAPI) implementados en el sistema hasta la fecha.

---

## 1. RUTAS FRONTEND (Next.js App Router)

Las rutas del Frontend se dividen en dos dominios: **Rutas Globales / Públicas** y **Rutas del Tenant (`[subdomain]`)**.

### 1.1 Rutas Globales y de Autenticación
* `/`: Landing Page pública oficial de CodexFlow (presentación del SaaS, captación de ONGs y formulario de solicitud de demostración).
* `/login`: Inicio de sesión institucional para usuarios y administradores.
* `/register`: Registro de nuevos usuarios.
* `/welcome`: Pantalla de bienvenida y activación de cuenta tras acceder por Magic Link de Supabase.
* `/pending`: Pantalla de espera para usuarios huérfanos o sin organización asignada (notifica que un administrador debe autorizarlos).
* `/god-mode`: Acceso restringido para el Superadministrador de la plataforma.

### 1.2 Backoffice de Superadministrador (`/superadmin`)
* `/superadmin`: Panel de control general de la plataforma SaaS (métricas globales, estado de ONGs, solicitudes de demo recibidas).
* `/superadmin/new`: Asistente de onboarding manual para crear y dar de alta una nueva Diócesis u Organización (Concierge Onboarding).
* `/superadmin/tenants/new`: Creación y configuración avanzada de organizaciones tenant y asignación de cuotas.

### 1.3 Rutas del Espacio de Trabajo de la Organización (`/[subdomain]/...`)
Cada Diócesis u Organización opera en su espacio de trabajo aislado mediante su subdominio (ej: `/caritas-carupano/...`):

* `/[subdomain]/dashboard`: Panel principal de la organización con estadísticas de avance, folios procesados y accesos directos por rol.
* `/[subdomain]/ingest`: **Hub Central de Ingesta y Gestión Documental**. Contiene:
  * Pestaña *Tomos y Carpetas*: Árbol jerárquico documental, creación de tomos, asignación de folios sueltos y exportador FamilySearch (DIP).
  * Pestaña *Subir Lote*: Carga masiva de imágenes a Cloudflare R2 y asignación de plantillas.
  * Pestaña *Plantillas*: Diseñador visual de formularios (Template Builder).
  * Pestaña *Dudosos*: Bandeja de folios marcados en revisión por el transcriptor.
* `/[subdomain]/visor`: **Visor Dual de Indexación y Transcripción**.
  * Panel izquierdo: Imagen en alta resolución con controles de zoom, rotación, filtros de contraste, binarización y lupa óptica interactiva.
  * Panel derecho: Formulario de transcripción dinámico con soporte de múltiples partidas (`[Partida 1]`, `[Partida 2]`), contexto territorial heredado del libro y atajos FamilySearch (`Ctrl+U`, `Ctrl+B`, `Ctrl+D`, `Ctrl+Enter`).
* `/[subdomain]/visor/[batch_id]`: Acceso directo al visor filtrando la cola de trabajo por un lote específico.
* `/[subdomain]/records`: **Explorador de Registros Históricos Indexados**. Búsqueda avanzada, filtros por fecha/apellidos, edición de actas y visor de detalles.
* `/[subdomain]/metrics`: Métricas de productividad del equipo de transcriptores (folios/hora, tasa de avance por tomo).
* `/[subdomain]/dudosos`: Vista rápida de partidas que requieren auditoría o verificación del archivero.
* `/[subdomain]/settings/users`: Administración del equipo de trabajo (invitaciones a transcriptores, asignación de roles `admin`, `archivist`, `digitizer`).
* `/[subdomain]/settings/export`: Configuración y descarga de exportaciones masivas en formatos tradicionales.

---

## 2. PUNTOS DE ENLACE BACKEND (FastAPI API REST)

Todas las rutas del backend están bajo `/api` y protegidas mediante aislamiento estricto multi-tenant por `tenant_id` y validación de tokens de Supabase.

### 2.1 Ingesta y Almacenamiento (Cloudflare R2)
* `POST /api/v1/ingest`: Registro e inicio del procesamiento de un nuevo lote de imágenes.
* `GET /api/v1/upload/url`: Generación de URLs firmadas (Presigned URLs) de Cloudflare R2 para subida segura de fotos.
* `GET /api/v1/batches`: Listado de lotes cargados en la organización.

### 2.2 Gestión de Carpetas, Tomos y Jerarquía Geográfica (Specs 012 y 013)
* `GET /api/v1/folders/tree`: Retorna la estructura de árbol jerárquico (Diócesis > Parroquia > Serie > Tomo) con conteos de folios.
* `POST /api/v1/folders`: Creación de una nueva carpeta o tomo físico con sus metadatos y jurisdicción territorial.
* `PATCH /api/v1/folders/{folder_id}`: Edición de metadatos, nombre, tipo de carpeta o reubicación de padre.
* `DELETE /api/v1/folders/{folder_id}`: Eliminación segura de carpeta desvinculando folios hacia la bandeja sin clasificar.
* `GET /api/v1/folders/unclassified-folios`: Obtiene la lista de folios que aún no han sido asignados a ningún libro formal.
* `POST /api/v1/folders/{folder_id}/assign-folios`: Asigna folios sueltos a un tomo, asignándoles orden correlativo y nombre canónico oficial de FamilySearch.
* `GET /api/v1/folders/geographic-suggestions`: Sugerencias dinámicas deduplicadas de países, estados, municipios y parroquias para autocompletar.

### 2.3 Visor de Transcripción y Partidas
* `POST /api/v1/folios/get_next`: Entrega el siguiente folio pendiente en la cola de trabajo del transcriptor y bloquea el folio para evitar colisiones.
* `GET /api/v1/folios/{folio_id}`: Obtiene el detalle completo de un folio (imagen firmada R2, plantilla, metadatos).
* `POST /api/v1/folios/{folio_id}/release`: Libera el bloqueo de un folio si el usuario abandona la pantalla sin guardar.
* `GET /api/v1/folios/{folio_id}/entries`: Obtiene todas las partidas de una hoja (`folio_entries`) y el contexto territorial heredado del libro.
* `POST /api/v1/folios/{folio_id}/entries`: Guarda atómicamente las partidas transcritas del folio y actualiza el estado general a `completed` o `revision`.
* `PUT /api/v1/folios/{folio_id}/entries/{entry_id}`: Actualización individual de una partida específica.
* `POST /api/v1/folios/save`: Guardado tradicional de un folio.
* `GET /api/v1/folios/revision`: Listado de folios marcados como dudosos o en revisión.

### 2.4 Motor de Exportación FamilySearch (DIP)
* `GET /api/v1/folders/{folder_id}/pre-export-summary`: Auditoría de calidad antes de exportar (conteo de folios, partidas listas, alertas de dudosas y advertencias geográficas).
* `GET /api/v1/folders/{folder_id}/export-familysearch`: Emisión en streaming del archivo `.ZIP` consolidado conteniendo:
  1. `matriz_indexacion.xlsx` (Excel institucional con columna obligatoria `image_file_name` y 5 columnas territoriales).
  2. `matriz_indexacion.csv` (CSV delimitado por `;` con BOM UTF-8).
  3. `export_gedcom.ged` (Estándar internacional GEDCOM 5.5.1 con `2 PLAC`).
  4. `manifest.json` (Ficha técnica y control de calidad).
  5. Subcarpeta `images/` con las fotos en alta resolución renombradas canónicamente (opcional).

### 2.5 Plantillas de Indexación (Template Builder)
* `GET /api/v1/templates`: Listado de formularios de indexación de la organización.
* `POST /api/v1/templates`: Creación de nueva plantilla personalizada.
* `PUT /api/v1/templates/{template_id}`: Edición de campos y validaciones de la plantilla.
* `DELETE /api/v1/templates/{template_id}`: Eliminación de plantilla.
* `POST /api/v1/templates/{template_id}/duplicate`: Duplicación de plantilla base para nuevos tipos documentales.

### 2.6 Registros Históricos y Búsquedas
* `GET /api/v1/records`: Consulta paginada y filtrado de partidas indexadas.
* `PATCH /api/v1/records/{folio_id}`: Modificación de los metadatos de un registro histórico.
* `DELETE /api/v1/records/{folio_id}`: Eliminación de un folio/registro.
* `GET /api/v1/records/export`: Exportación masiva de registros a formatos planos.

### 2.7 Equipo y Seguridad
* `GET /api/v1/team`: Miembros activos de la organización.
* `POST /api/v1/team/invite`: Invitación por correo a nuevo transcriptor o archivista.
* `PATCH /api/v1/team/{target_user_id}`: Cambio de rol o desactivación de un miembro.
* `POST /api/v1/keys/regenerate`: Rotación de claves API.
* `GET /api/auth/me`: Verificación de identidad y rol del usuario en sesión.
* `POST /api/auth/complete-onboarding`: Finalización de registro de contraseña institucional.

### 2.8 Backoffice Superadministrador
* `GET /api/superadmin/tenants`: Listado de todas las organizaciones en la plataforma.
* `POST /api/superadmin/tenants`: Alta de nueva organización y asignación de administrador inicial.
* `PATCH /api/superadmin/tenants/{tenant_id}/status`: Suspensión o reactivación de organización.
* `PUT /api/superadmin/tenants/{tenant_id}/quota`: Actualización de cuota de almacenamiento/folios.
* `POST /api/superadmin/tenants/{tenant_id}/resend-invite`: Reenvío de correo de activación.
* `GET /api/superadmin/orphans`: Detección de usuarios registrados sin tenant asignado.
* `POST /api/superadmin/orphans/{user_id}/resolve`: Asignación de usuario huérfano a una organización.
* `GET /api/superadmin/demo-requests`: Solicitudes de contacto desde la Landing Page.
* `PATCH /api/superadmin/demo-requests/{request_id}`: Gestión de estado de solicitud de demo.
* `DELETE /api/superadmin/demo-requests/{request_id}`: Archivo de solicitud de demo.

### 2.9 Aprendizaje y Métricas
* `POST /api/v1/ai/feedback` (y `/active-learning/feedback`): Captura silenciosa de correcciones humanas en `training_data`.
* `GET /api/v1/ai/metrics`: Estadísticas de discrepancia y precisión.
* `GET /api/v1/digitizer/metrics`: Rendimiento por indexador.
* `GET /api/tenant/metrics`: Estadísticas de uso y almacenamiento por organización.
