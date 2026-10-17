# MEMORY.md — Sistema Inteligente de Indexación

Registro de memoria a corto/medio plazo para los agentes de Antigravity. Máximo ~50 líneas. Resume el estado y decisiones clave.

## Estado actual
- **Fase:** Módulo 5 COMPLETADO (Backoffice de Super-Administrador y Onboarding Manual). EL SAAS ESTÁ TERMINADO A NIVEL CÓDIGO.
- **Progreso Módulo 5:** Tareas T1 a T10 implementadas. QA Aprobó tras corregir bugs de esquema.
  - Roles: Rol `superadmin` añadido.
  - Seguridad: Middleware `get_superadmin_context` para blindar `/api/superadmin`. Función SQL `is_superadmin()` con `SECURITY DEFINER` para hacer bypass RLS.
  - Bootstrapping: Trigger en BD que corona al primer usuario registrado automáticamente.
  - Onboarding: Concierge Onboarding implementado (`/superadmin/new`). El sistema crea el Tenant, asigna la cuota y envía un Magic Link de Supabase al dueño de la ONG.

## Decisiones Técnicas (y por qué)
- **Desvío del Roadmap (Sin Pasarela de Pagos):** Por instrucciones del fundador, el SaaS no tendrá Stripe por ahora. Se venderá la licencia directamente a la ONG (uso exclusivo/marca blanca).
- **Control de RAM y Cuellos de Botella:** La arquitectura se refactorizó para correr con un Semáforo de concurrencia y un Streamer de CSV. Así aseguramos que el OCR y la descarga masiva no exploten el servidor gratuito de 512MB de Render.

## Módulo 12 COMPLETADO: Gestión de Tomos/Carpetas (DCam) e Interoperabilidad FamilySearch (DIP)

- **Árbol Jerárquico DCam:** Tabla `document_folders` en Supabase con soporte jerárquico multinivel (Diócesis > Parroquia > Serie > Tomo), RLS multi-tenant y roles RBAC (solo admin y archivist crean/editan; digitizer transcribe).
- **Folios Sueltos y Retrocompatibilidad:** Migración automática que asocia folios existentes a la carpeta virtual "Sin Clasificar (Migración inicial)". Capacidad de mover folios sueltos a tomos existentes en lote heredando su plantilla y asignando secuencia correlativa final (`sequence_order`).
- **Captura Multi-Partida y Atajos FamilySearch:** Pestañas dinámicas en el Visor Dual (`[Partida 1]`, `[Partida 2]`, ...) con botón `+ Agregar Partida` y atajo `Alt + N`. Persistencia atómica por persona en `folio_entries`. Atajos estándar: `Ctrl + U` (Ilegible), `Ctrl + B` (En Blanco) y `Ctrl + D` (Duplicar valor anterior).
- **Herencia Inmutable del Tomo:** El Visor hereda los metadatos del libro (Parroquia, Tomo, Años) mostrándolos en una tarjeta superior con candado y bloqueando campos coincidentes en la plantilla.
- **Motor de Exportación e Interoperabilidad FamilySearch DIP:** Endpoint en streaming `GET /api/v1/folders/{id}/export-familysearch` que emite un archivo `.ZIP` consolidado conteniendo:
  1. `matriz_indexacion.xlsx`: Excel con cabeceras formales y columna mandatoria `image_file_name`.
  2. `matriz_indexacion.csv`: CSV delimitado por `;` con BOM UTF-8.
  3. `export_gedcom.ged`: Archivo genealógico conforme a la norma internacional GEDCOM 5.5.1 (`INDI`, `CHR`, `BIRT`, `MARR`, `DEAT`, `OBJE`).
  4. `manifest.json`: Ficha técnica de control de calidad con pares de nomenclatura canónica `[CodOrg]_[Serie]_[Tomo]_[Folio]`.
  5. Subcarpeta `images/` con las fotos en alta resolución (opcional en paquete integral).
- **Auditoría de Calidad:** Endpoint `GET /api/v1/folders/{id}/pre-export-summary` y diálogo modal `ExportFamilySearchModal.tsx` con semáforo de calidad que alerta sobre partidas pendientes/dudosas antes de descargar.

## Módulo 13 COMPLETADO: Jerarquía Geográfica, Jurisdicción Territorial y Herencia de Localidad (FamilySearch Standard)

- **Captura y Metadatos JSONB:** Extensión de `document_folders.metadata` para registrar `country`, `state`, `municipality`, `city_or_locality`, `diocese_name` y `parish_name`.
- **Motor de Resolución Ascendente Dinámico:** Función `_resolve_folder_inherited_context` en `backend/main.py` con búsqueda recursiva de hasta 8 niveles, protección anti-ciclos (`visited`), sobreescritura parcial hoja->padre->raíz, fallback al perfil del tenant y construcción canónica estándar internacional `build_canonical_place("Localidad, Municipio, Estado, País")`.
- **Autocompletado Territorial:** Endpoint `GET /api/v1/folders/geographic-suggestions` y hook React `useGeographicSuggestions` para sugerir dinámicamente opciones en `<datalist>` HTML libres de discrepancias tipográficas.
- **Formulario y Prellenado:** Sección colapsable `"📍 Jurisdicción Territorial y Localidad Geográfica"` en `CreateFolderModal.tsx`, prellenando automáticamente los datos del padre al crear subcarpetas o tomos.
- **Visor Dual Ergonómico:** Badge `📍 Localidad: ...` con candado en la tarjeta superior. La función `getInheritedFieldInfo` detecta y bloquea en solo lectura campos de plantilla redundantes (`lugar`, `pais`, `estado`, `municipio`, `ciudad`) inyectando el valor heredado.
- **Motor de Exportación DIP FamilySearch Homologado:**
  1. `matriz_indexacion.xlsx` y `matriz_indexacion.csv`: Incluyen las 5 columnas geográficas completas (`pais`, `estado`, `municipio`, `ciudad_localidad`, `lugar_evento_estandarizado`).
  2. `export_gedcom.ged`: Inyección de `2 PLAC {canonical_place}` en eventos vitales (`BIRT`, `CHR`, `MARR`, `DEAT`) con omisión segura si no hay datos sin quebrar el estándar GEDCOM 5.5.1.
  3. `manifest.json`: Ficha técnica de calidad enriquecida con `tome_info.geographic_coverage`.
  4. `pre-export-summary`: Advertencias no bloqueantes si faltan País o Estado.
- **Retroactividad Dinámica:** Toda la resolución opera en memoria en tiempo de consulta/exportación; cualquier cambio en la localidad de una parroquia se refleja inmediatamente en sus tomos y folios sin alterar la base de datos de folios.

## Módulo 14 COMPLETADO: Estándar Archivístico, Foliación Recto/Vuelto, Plantillas Maestras FamilySearch y Filtro Estricto DIP

- **Foliación Archivística Tridimensional:** Desacoplamiento de imagen digital y foliación física en `folio_entries`: `folio_number`, `folio_side` ('recto', 'vuelto', 'unica'), `act_number` e `is_continued`. Selector bimembre en Visor y alternancia automática inteligente al pulsar `Ctrl + Enter` (Recto -> Vuelto -> Folio+1 Recto) con detección visual de saltos.
- **Plantillas Maestras Oficiales Inmutables:** Inyección de las 3 plantillas canónicas completas de FamilySearch (`is_system_template = true`) para Bautismo, Matrimonio (con desglose de ambos contrayentes) y Defunción, blindadas por trigger PostgreSQL contra eliminación o alteración accidental de campos base.
- **Filtro Estricto DIP y Cero Pendientes:** `export_familysearch_package` filtra estrictamente partidas en `completed/verified`. Garantiza **cero filas en estado `pending`** en `matriz_indexacion.xlsx`, CSV y GEDCOM. El empaquetado integral con fotos (`include_images=True`) solo descarga las páginas que contengan partidas completadas, nombradas canónicamente con la cara física: `_F014R.jpg`. Si un tomo tiene 0 completadas, la exportación se rechaza con HTTP 400 y el botón se desactiva.
- **Explorador `/records` Optimizado:** Paginación SQL con `range()` en backend y eliminación del spinner infinito en frontend, listando registros con su foliación `F.14r` en menos de 150ms.
- **Tooling Aislado:** Script independiente en `tools/seeding/seed_demo_data.py` fuera de los paquetes de despliegue de Vercel/Render, con opción `--clean` y enfocado en la cuenta de demostración (`belkisagreda1@gmail.com`).

## Próximos pasos (Pendientes)
- **SPEC-015: Rol de Evaluador y Mesa de Arbitraje de Calidad (`/evaluacion`).**
- **Generación de Dataset Demo de Alta Fidelidad:** Ejecutar el seed para aprovisionar 10 folios de prueba en la cuenta de Belkis Agreda.
- **Auditoría del Módulo de Invitaciones:** Verificar envío de correos Magic Link para digitizers y evaluadores.

## Registro de Mantenimiento y Bugs Críticos (Spec 005)

Durante la implementación y despliegue del Spec 005, nos encontramos con varios cambios de versión ("Breaking Changes") en las herramientas subyacentes que deben aplicarse a futuras Specs para evitar colapsos:

1. **Next.js 15+ y las Cookies Asíncronas**: La función `cookies()` de `next/headers` ahora devuelve una Promesa. Es OBLIGATORIO usar `await cookies()` antes de intentar acceder a `cookieStore.getAll()`. Si no se hace, el servidor explota con `cookieStore.getAll is not a function`.
2. **Supabase SSR**: El paquete `@supabase/auth-helpers-nextjs` está deprecado y causa errores de importación (`createServerComponentClient`). La arquitectura oficial y estandarizada ahora es `@supabase/ssr` usando `createServerClient(url, key, { cookies: { ... } })`.
3. **Tailwind CSS v4**: El archivo `globals.css` no debe usar las directivas obsoletas (`@tailwind base;` etc). La directiva correcta y única para v4 es `@import "tailwindcss";`. Usar la versión vieja causa que Vercel no compile el CSS.
4. **Vercel Secrets**: Vercel bloquea permanentemente cualquier variable de entorno guardada como "Secret". Variables públicas (con prefijo `NEXT_PUBLIC_`) DEBEN guardarse como "Config" desde el principio; de lo contrario, Vercel impide editarlas y oculta su valor al cliente provocando fallos de "Invalid API Key".
5. **Convención de Tablas Auth**: El sistema RLS y de gatillos depende de una tabla unificada `user_profiles`. Cualquier referencia antigua a `public.users` en Specs anteriores (ej. Spec 002) causa fallos en cadena.

Todo nuevo código y planificación debe apegarse a estas reglas a partir de ahora.

6. **Error 404 y Routing de Middleware (Next.js)**: Al integrar middleware en Next.js para soporte multi-tenant (subdominios), el regex usado para extraer el subdominio no debe capturar IPs locales (`192.168...`) ni el dominio nativo de Vercel (`.vercel.app`). Si lo hace, Vercel reescribirá la URL a una ruta `[subdomain]/page.tsx` inexistente (ej. `codexflow-frontend`), provocando un error 404 persistente. El middleware fue parchado para saltarse la reescritura en IPs y en el dominio principal de Vercel.
7. **SSG (Static Site Generation) en Layouts Protegidos**: En Next.js, las rutas que dependen de leer cookies para autenticación con Supabase (ej. `superadmin/layout.tsx`) no pueden pre-renderizarse estáticamente. Deben forzar la renderización dinámica con `export const dynamic = 'force-dynamic';`, de lo contrario el build fallará porque `cookies()` no está disponible en build-time sin contexto dinámico.
8. **Ejecución de Migraciones SQL Alfabetizadas**: Renombrar las migraciones de forma asimétrica (ej. `001_...`, `20261005_...`, `005_...`) hace que el `master_deploy.sql` generado alfabéticamente ejecute scripts en orden incorrecto, causando que dependencias futuras intenten alterar tablas que aún no se han creado (ej. `user_profiles`). Se implementó un archivo maestro `master_deploy_fixed.sql` unificado y libre de dependencias rotas.

9. **Autenticación Universal y API Proxy (RF-5)**: Se consolidó `/login` como punto universal con redirección automática basada en roles (vía SSR y `useEffect`). Para conectar Frontend y Backend (FastAPI) evitando CORS y ocultando la URL de Render, se estandarizó el uso de un proxy inverso (`rewrites` en `next.config.js` enviando `/api/:path*` al backend). Es crucial auditar que la URL de destino (`NEXT_PUBLIC_API_URL`) no tenga errores tipográficos para no causar fallos 404/500 silenciosos.

10. **Hotfix Huérfanos (RF-6):** Se implementó `/pending` para usuarios sin rol. El superadmin tiene ahora un panel para asignarlos a una ONG, crear una ONG nueva en un paso, o asignarles el rol `rejected`.
11. **Auto-Reparación Superadmin (RF-1):** Se eliminó el trigger cronológico. Se implementó una "Lista Blanca" mediante Middleware y FastAPI: el correo protegido por `SUPERADMIN_EMAIL` recibe el rol `superadmin` automáticamente al iniciar sesión, evitando bloqueos por usuarios fantasma.

12. **Loop de Mantenimiento de Jerarquías y Roles (Spec 004, Loop 2):** Se resolvió el divorcio de sesiones (CORS local vs cookies) migrando toda la plataforma de forma estricta a `@supabase/ssr`. Se construyó la pantalla de Gestión de Equipo completa con validaciones robustas, filtros y seguridad ("Lazy expulsion", blindaje del último admin). El acceso multi-tenant ahora exige que la seguridad recaiga 100% sobre el `tenant_id` derivado del JWT y no del nombre en la URL (solucionando el bug `undefined`).

13. **Loop de Mantenimiento de Ingesta y Visor (Spec 002, Loop 1):** Se detectaron errores 404 debido a que las rutas originales (`/upload`, `/templates`) fueron creadas globalmente en lugar de dentro de `/[subdomain]`. Se unificó toda la interfaz en un único "Hub de Ingesta" (`/[subdomain]/ingest/page.tsx`) con Pestañas (Subir, Dudosos, Plantillas), ocultando plantillas a los Archivistas. El Visor Dual se rediseñó para usar una **Cola Global Automática** (FIFO) sin depender de un `batch_id` en la URL. Se introdujo una migración SQL con bloqueo concurrente (`FOR UPDATE SKIP LOCKED`) y un timeout de 15 minutos (`locked_at`) para evitar colisiones entre digitadores y recuperar folios abandonados.

14. **Loop de Mantenimiento de Plantillas (Spec 002, Loop 2):** Implementación de un Creador Visual de Plantillas (estilo Google Forms) con Split Screen (Constructor y Preview). Genera un esquema en JSON `fields` (Texto Corto, Texto Largo, Fecha, Dropdown) que se guarda en BD. El Visor dibuja el formulario dinámicamente según el JSON asociado al lote. Se implementó una regla de negocio SQL (Trigger) que prohíbe editar los campos de una plantilla si ya está en uso por lotes activos. Guardado parcial implementado: Si se usa `Ctrl+Espacio` (Duda), el backend ignora los campos requeridos y guarda el progreso.

15. **Loop de Mantenimiento de Ingesta (Spec 002, Loop 3):** Se implementó la subida real de folios hacia Cloudflare R2 reemplazando el simulacro inicial. El frontend solicita Signed URLs (S3v4) al backend FastAPI `/api/v1/upload/url`, hace el PUT directo a Cloudflare R2 sin cargar el servidor, y luego notifica al backend vía `/api/v1/ingest` enviando el `batch_id` generado. Se añadió estado de carga visual en el botón de Subir.

16. **Loop de Mantenimiento de Bugs Críticos de Tenant e Ingesta (Spec 002/004, Loop 4):**
    - **Bug de Routing `/undefined/`:** En Next.js 16 los `params` son asíncronos. La lectura síncrona en `layout.tsx` causaba que `subdomain` fuera `undefined`. Se corrigió migrando todo a `useParams()` del cliente.
    - **Bug de Autenticación 401 en todo el Backend:** El backend intentaba validar `is_active` de `user_profiles`, pero la columna no existía en BD (olvido en migraciones). Se corrigió añadiendo la columna vía SQL.
    - **Bucle Infinito (Infinite Recursion) en Supabase RLS:** Al usar funciones `LANGUAGE sql` (`get_user_tenant`, `get_user_role`), Postgres las desarmaba (inlining) y perdían su contexto `SECURITY DEFINER`, causando bucles al evaluarse en políticas superpuestas de `batches` y `user_profiles`. **Solución estructural:** Se purgaron las 5 políticas cruzadas, se reescribieron las funciones en `LANGUAGE plpgsql`, y se establecieron políticas simples (`user_can_read_own_profile` y un `batches_secure_policy` limpio).
    - **CORS Error en Subida a R2:** El frontend intentaba llamar directamente a la URL de Render, saltándose el proxy de Next.js y provocando bloqueos CORS (`OPTIONS 405`). Se eliminó `process.env.NEXT_PUBLIC_API_URL` de las llamadas de `fetch` para usar únicamente rutas relativas (`/api/v1/...`), forzando que pasen transparentemente por el proxy interno (`next.config.js`).
    - **Fallo de Constraints de BD:** El frontend no enviaba `tenant_id` al hacer `INSERT` en `batches`. Se modificó el frontend para extraer directamente el `tenant_id` consultando `user_profiles` con Supabase JS, y se corrigió el ENUM inválido (`uploading` a `pending`).

17. **Cierre de Ciclo de Ingesta y Visor Dual (Spec 002):**
    - **Visualización Real de Imágenes R2:** El endpoint `/api/v1/folios/get_next` ahora genera URLs prefirmadas (`get_object`) de Cloudflare R2 con cadencia de 1h, permitiendo renderizar el documento de forma segura sin exponer credenciales.
    - **Enum de Folio Corregido:** Se añadió `'in_progress'` a `folio_status` en PostgreSQL para permitir el bloqueo concurrente temporal de folios en la cola global.
    - **Worker Resiliente:** El procesamiento en segundo plano (`worker.py` y `main.py`) no degrada folios a `failed` si fallan procesos secundarios de OCR, preservando el documento en `pending` para los digitadores humanos.
    - **Controles Interactivos de Ergonomía:** Se implementó en el visor una barra flotante con zoom in/out (hasta 400%), rotación en 90°, arrastre (pan) con clic sostenido, zoom con rueda del ratón y botón de restablecer.

18. **Exportación Multi-Formato de Registros (Spec 008):**
    - **Soporte Dual Excel (.xlsx) y CSV (.csv):** Integración de `openpyxl` en backend FastAPI para emitir archivos XLSX nativos con estilos corporativos (cabecera `#1E293B`, bordes `#E2E8F0`, autoajuste de ancho) y CSV optimizado con delimitador `;`, BOM UTF-8 y directiva `sep=;\r\n` para apertura perfecta en Excel en español.
    - **Desglose Dinámico de Metadatos:** En vista global sin lote filtrado, los campos indexados se analizan dinámicamente y se proyectan en columnas individuales tituladas (e.g. "Nombre Padre", "Fecha Nacimiento") en lugar de un JSON agrupado en una sola celda.
    - **Interfaz Frontend:** Dropdown interactivo en `/[subdomain]/records` con opciones para descargar en formato Excel o CSV y estados de carga.

19. **Indexación Asistida por IA y Prellenado Inteligente (Spec 009):**
    - **Capa Vectorial SVG:** Bounding boxes semitransparentes verde/azul proyectadas sobre la imagen original con realce amarillo en foco activo, cálculo matricial ante rotaciones (0°, 90°, 180°, 270°) y sincronización dentro de la Lupa Óptica.
    - **Prellenado Condicional:** Umbral de confianza $\ge 80\%$ y validación de sintaxis (fechas ISO). Insignia visual editable `IA: X%`.
    - **Ergonomía:** Centrado suave al tabular si `zoom <= 2.5x` (preserva cámara en zoom alto). Atajos `Alt + A` (toggle capa), `Alt + C` (centrado forzado), clic en caja para insertar texto.
    - **Active Learning:** Registro de discrepancias en `training_data` al guardar con `Ctrl + Enter` y tarjeta de métricas de precisión en el Dashboard.

20. **Autoguardado Local y Recuperación Offline (Spec 010 - Principio 4 de la Constitución):**
    - **Persistencia en Tiempo Real:** Debounce de 500ms que respalda el formulario y el estado del visor (zoom, pan x/y, rotación) bajo la clave aislada `'codexflow_draft_[tenant]_[folio]'` con purga automática (TTL 7 días).
    - **Feedback y Modo Offline:** Badge visual animado "Guardado local" con tooltip de hora, y banner persistente superior ante pérdida de red (`navigator.onLine === false`) informando que el trabajo sigue a salvo.
    - **Restauración y Descarte:** Recuperación automática al reabrir el folio con toast flotante de 4 segundos. Botón y atajo `Alt + D` para descartar borrador con confirmación. Limpieza inmediata al guardar con éxito (`Ctrl + Enter`) o al dudar (`Ctrl + Espacio`).

21. **Landing Page Oficial y Captura de Demos B2B (Spec 011):**
    - **Portada Institucional:** Estilo SaaS moderno Slate-950 con titular H1, subtítulo y Sticky Navbar con detección reactiva de sesión (muestra "Ir a mi Panel" si está autenticado).
    - **Simulador Interactivo Dual:** Mockup del Visor Dual con selector entre muestras paleográficas reales (Partida 1782 vs Protocolo 1824), lupa de 180px y formulario con badges de confianza `IA: 96%`.
    - **Secciones de Conversión:** Comparativa Problema vs Solución, 4 Pilares Clave (Ergonomía, IA/Active Learning, Multi-Tenancy RLS, Exportación Excel), Casos de Uso (Diócesis, Notarías, Registros Civiles) y FAQ de 5 preguntas.
    - **Captura Segura de Prospectos:** Modal "Solicitar Demo" con persistencia dual en Supabase `demo_requests` y respaldo en Cloudflare R2 (`_system/demo_requests/requests.json`), notificación de correo automática vía FormSubmit/SMTP hacia `SUPERADMIN_EMAIL` y bandeja de gestión en `/superadmin` con creación de ONG prellenada en 1 clic.
    - **SEO y Redes Sociales:** Metatags OpenGraph y Twitter Cards para previews automáticas al compartir en WhatsApp y LinkedIn.

22. **Loop de Mantenimiento del Motor de IA en Backend (Spec 009, Loop 1):**
    - **Reparación de `worker.py` y `ai_engine.py`:** Se corrigió el import relativo (`from ai_engine`), el bloqueo por ausencia de `libvips` en Render y la consulta rota `folios -> batches -> templates(fields)`. Se implementó detección visual de renglones de escritura con `PIL` (`_detect_visual_lines_with_pil`), mapeo real hacia los `fields` de la plantilla y alimentación con el historial de `training_data` del `tenant_id`.
    - **Auto-análisis bajo demanda:** Se incorporó `ensure_folio_ai_predictions` y el endpoint `POST /api/v1/folios/{folio_id}/analyze-ai` para que incluso los folios antiguos sin `ai_predictions` generen sus recuadros `[xmin, ymin, xmax, ymax]` al cargarse o al activar `IA [Alt+A]` en el Visor.

23. **Loop de Mantenimiento de Registros y Borrado (Spec 008, Loop 1):**
    - **Eliminación Segura de Registros:** Se implementó `DELETE /api/v1/records/{folio_id}` con verificación estricta de `tenant_id` y roles (prohibido para digitadores, archivistas solo sus lotes, admin/superadmin total).
    - **Interfaz de Usuario:** Botón de papelera roja (`Trash2`) en la tabla de Registros y en el modal de detalle, modal de confirmación de seguridad con indicador de carga y refresco automático de la lista de registros.

24. **Eliminación Total de Datos Simulados y Active Learning Real (Spec 009, Loop 2):**
    - **Cero Mock Data:** Se purgaron todos los valores simulados en `AIDashboardMetrics.tsx` (126, 14, 2, 88.5%) y en `GET /api/v1/ai/metrics`. Los contadores reflejan 0 hasta que existan calibraciones reales.
    - **Persistencia Dual en R2:** Guardado garantizado de feedback y discrepancias humanas en Cloudflare R2 (`_system/training_data/{tenant_id}.json`) además de Supabase en cada guardado de folio (`/api/v1/folios/save`), alimentando métricas y aprendizaje 100% reales.
