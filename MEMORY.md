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

## Próximos pasos (Pendientes)
- **FASE DE CREACIÓN B2B (Spec 007):**
- Tareas: Crear el plan técnico para `specs/007-b2b-tenant-management` (Creación manual de ONGs por el Superadmin, Suspensión, Soporte y Reenvío de Invitaciones).

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
