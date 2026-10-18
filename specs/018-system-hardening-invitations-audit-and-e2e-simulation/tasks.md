# TASKS-018: Tareas de Implementación — Blindaje Integral, Auditoría de Invitaciones, Simulación E2E y Fluidez de Vistas

Este documento desglosa de manera exhaustiva y secuencial las tareas técnicas requeridas para materializar [spec.md](file:///c:/Users/CARITAS%20CARUPANO/Desktop/CodexFlow/specs/018-system-hardening-invitations-audit-and-e2e-simulation/spec.md) y [plan.md](file:///c:/Users/CARITAS%20CARUPANO/Desktop/CodexFlow/specs/018-system-hardening-invitations-audit-and-e2e-simulation/plan.md).

---

## Fase 1: Setup Base y Singleton de Supabase

- [x] **T01-F1-01: Crear singleton de cliente Supabase del navegador**
  - **Archivo**: `frontend/src/lib/supabaseClient.ts`
  - **Descripción**: Implementar la función `getSupabaseBrowserClient()` con memoización de instancia (`let browserClient: SupabaseClient | null = null`) configurada con `auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }`. Evitar instanciaciones múltiples en el ciclo de renderizado.
  - **Criterio de Aceptación**: Múltiples llamadas a `getSupabaseBrowserClient()` retornan exactamente la misma instancia de `SupabaseClient`.

- [x] **T01-F1-02: Implementar proveedor de contexto de Tenant (`TenantContext`)**
  - **Archivo**: `frontend/src/context/TenantContext.tsx`
  - **Descripción**: Crear `TenantProvider` y hook `useTenant()` que almacene y exponga `{ session, user, role, tenantId, subdomain, loading, refreshAuth }`. La verificación contra `/api/auth/me` debe ejecutarse una sola vez al montar o ante cambios de sesión, evitando re-consultas en cada navegación de subruta.
  - **Criterio de Aceptación**: Cambiar de subruta dentro de un tenant no reinicia el estado de sesión ni dispara llamadas redundantes a `/api/auth/me`.

---

## Fase 2: Frente 1 — Resiliencia de Sesiones, Invitaciones Canónicas y Blindaje RBAC

- [x] **T02-F1-01: Refactorizar layout de tenant con TenantContext y guardia de roles con Toast**
  - **Archivo**: `frontend/src/app/[subdomain]/layout.tsx`
  - **Descripción**: 
    1. Envolver el contenido con `TenantProvider`.
    2. Reemplazar la instanciación local de `createBrowserClient` por `getSupabaseBrowserClient()`.
    3. Eliminar el re-fetch de sesión en cambios de `pathname`.
    4. Implementar control de accesos síncrono en memoria: si un usuario con rol `digitizer` intenta navegar a `/ingest`, `/evaluacion` o `/settings/users`, redirigir inmediatamente a `/{subdomain}/visor` y mostrar un toast accesible *"Acceso restringido a tu rol"*.
    5. Si el rol es `evaluator` e intenta navegar a `/ingest` o `/settings/users`, redirigir a `/{subdomain}/evaluacion`.
  - **Criterio de Aceptación**: Las transiciones entre pestañas no muestran el cartel de "Verificando accesos..." y los digitadores son redirigidos de inmediato con toast si intentan acceder por URL a rutas no autorizadas.

- [x] **T02-F1-02: Configurar redirección canónica por subdominio en backend para invitaciones**
  - **Archivo**: `backend/main.py`
  - **Descripción**: En los endpoints `/api/v1/team/invite` y `/api/superadmin/tenants/{tenant_id}/resend-invite`:
    1. Resolver el subdominio del tenant a partir del `tenant_id`.
    2. Construir la URL de redirección canónica hacia el subdominio: `{BASE_URL}/{subdomain}/login` (o `{BASE_URL}/welcome?subdomain={subdomain}`).
    3. Reemplazar la URL estática `https://codexflow-frontend.vercel.app/welcome` por la URL canónica calculada.
  - **Criterio de Aceptación**: El enlace de invitación Magic Link de Supabase redirige al subdominio específico del tenant destinatario.

- [x] **T02-F1-03: Blindar página de gestión de equipo contra auto-eliminación y degradación del último admin**
  - **Archivo**: `frontend/src/app/[subdomain]/settings/users/page.tsx`
  - **Descripción**:
    1. Migrar a `getSupabaseBrowserClient()`.
    2. Identificar el usuario logueado (`currentUserId`). Deshabilitar los botones de acción para su propia fila (no auto-degradación ni auto-desactivación) con un mensaje aclaratorio.
    3. Contar la cantidad de administradores activos. Si solo queda 1 administrador activo, deshabilitar la opción de degradar o desactivar a dicho usuario, mostrando una alerta preventiva visible.
  - **Criterio de Aceptación**: La interfaz impide hacer clic en degradar o desactivar al usuario logueado o al último admin activo, complementando la protección ya existente del backend.

- [x] **T02-F1-04: Desarrollar script de prueba de integración para el flujo de invitaciones**
  - **Archivo**: `tools/testing/test_invite_flow.py`
  - **Descripción**: Crear script ejecutable independiente que:
    1. Autentique un usuario administrador.
    2. Emita una invitación vía `POST /api/v1/team/invite` con correo de prueba.
    3. Verifique respuesta HTTP 200 y formato de payload.
    4. Valide en Supabase que el perfil de usuario se inserte o actualice con el `tenant_id` y `role` correspondientes.
    5. Simule un intento de degradar al último administrador y verifique que retorne HTTP 400.
    6. Realice limpieza de los datos de prueba.
  - **Criterio de Aceptación**: El script se ejecuta exitosamente con código de salida 0.

---

### Fase 3: Frente 2 — Fluidez y Rendimiento Extremo de Vistas (Cero Retrasos)

- [x] **T03-F2-01: Implementar caché en memoria TTL (5 min) para `get_auth_context` en FastAPI**
  - **Archivo**: `backend/main.py`
  - **Descripción**:
    1. Implementar estructura de almacenamiento en memoria `_AUTH_CACHE: Dict[str, Tuple[datetime, Dict[str, Any]]]` y TTL de 300 segundos.
    2. En `get_auth_context`, calcular hash SHA-256 del token de autorización como clave.
    3. Si existe entrada válida en caché, devolver inmediatamente `{tenant_id, user_client, user_id, role}` sin hacer queries de red a Supabase.
    4. Si expira o no existe, consultar Supabase Auth y `user_profiles`, guardar en caché y devolver.
    5. Implementar función `invalidate_auth_cache_for_user(user_id: str)`.
  - **Criterio de Aceptación**: Peticiones consecutivas con el mismo token tardan < 5ms en la resolución de autenticación.

- [x] **T03-F2-02: Conectar invalidación reactiva de caché en endpoints de modificación de equipo**
  - **Archivo**: `backend/main.py`
  - **Descripción**: En `PATCH /api/v1/team/{target_user_id}` y endpoints de cambio de estado o rol, invocar `invalidate_auth_cache_for_user(target_user_id)` para que los cambios surtan efecto de inmediato sin esperar la expiración del TTL.
  - **Criterio de Aceptación**: Al degradar o desactivar un usuario, la siguiente petición de dicho usuario es rechazada sin demora.

- [x] **T03-F2-03: Optimizar `ingest/page.tsx` con singleton y concurrencia `Promise.all`**
  - **Archivo**: `frontend/src/app/[subdomain]/ingest/page.tsx`
  - **Descripción**:
    1. Reemplazar `createBrowserClient` por `getSupabaseBrowserClient()`.
    2. Agrupar la carga inicial de plantillas (`/api/v1/templates`), lotes recientes (`/api/v1/batches`), árbol de carpetas (`/api/v1/folders`) y folios de revisión con `Promise.all`.
    3. Reutilizar el rol y tenant proveídos por `TenantContext`.
  - **Criterio de Aceptación**: Todas las consultas iniciales se despachan concurrentemente al montar la vista, reduciendo el tiempo de carga acumulado.

- [x] **T03-F2-04: Optimizar `records/page.tsx` con singleton, `Promise.all` y retención de filtros**
  - **Archivo**: `frontend/src/app/[subdomain]/records/page.tsx`
  - **Descripción**:
    1. Reemplazar `createBrowserClient` por `getSupabaseBrowserClient()`.
    2. Paralelizar la carga de carpetas de tomos y conteos de estado con `Promise.all`.
    3. Retener en estado / `sessionStorage` los filtros aplicados (página actual, búsqueda, serie y carpeta seleccionadas) para que al regresar desde el visor `/visor` la tabla conserve su posición y registros sin recargar en blanco.
  - **Criterio de Aceptación**: Navegar entre `/records` y `/visor` preserva la paginación y filtros activos sin pantallas en blanco ni reinicio de variables.

- [x] **T03-F2-05: Optimizar `visor/page.tsx` y `evaluacion/page.tsx` con singleton y TenantContext**
  - **Archivos**: `frontend/src/app/[subdomain]/visor/page.tsx`, `frontend/src/app/[subdomain]/evaluacion/page.tsx`
  - **Descripción**:
    1. Migrar instanciaciones de Supabase a `getSupabaseBrowserClient()`.
    2. Extraer rol y sesión desde `TenantContext` en vez de re-consultar `/api/auth/me`.
    3. En `evaluacion/page.tsx`, cargar conteos de colas y lista de tomos en paralelo al inicializar.
  - **Criterio de Aceptación**: Cero llamadas duplicadas a Supabase en el ciclo de vida de ambas vistas.

- [x] **T03-F2-06: Purgar directorios y rutas huérfanas en el frontend**
  - **Directorios a eliminar**:
    - `frontend/src/app/[subdomain]/dudosos/`
    - `frontend/src/app/[subdomain]/visor/[batch_id]/`
  - **Descripción**: Eliminar los directorios completos que contienen implementaciones preliminares y mocks de desarrollo. Verificar que no queden referencias ni importaciones rotas en el proyecto.
  - **Criterio de Aceptación**: El árbol de rutas queda limpio y el build de Next.js pasa sin errores de resolución de módulo.

---

## Fase 4: Frente 3 — Simulación E2E del Ciclo Completo y Blindaje ante Desconexión

- [x] **T04-F3-01: Crear componente de estado de red (`NetworkStatusIndicator`) con reintento silencioso**
  - **Archivo**: `frontend/src/components/NetworkStatusIndicator.tsx`
  - **Descripción**:
    1. Escuchar eventos `online` y `offline` de la ventana.
    2. Renderizar un badge visual: punto verde ("Conectado") o punto ámbar/rojo con animación ("Sin conexión - Cambios guardados localmente").
    3. Al detectar reconexión a Internet, disparar un ciclo de reintento automático silencioso (cada 5 segundos con exponential backoff) para sincronizar borradores locales pendientes en `LocalStorage`.
    4. Integrar el componente en la barra superior de `frontend/src/app/[subdomain]/layout.tsx`.
  - **Criterio de Aceptación**: Al simular desconexión de red en el navegador, el indicador alerta inmediatamente y no se pierde la digitación en curso.

- [x] **T04-F3-02: Desarrollar suite automatizada de simulación E2E del ciclo de producción**
  - **Archivo**: `tools/testing/test_e2e_production_cycle.py`
  - **Descripción**: Implementar prueba completa de extremo a extremo que ejecute los 9 pasos definidos en [plan.md](file:///c:/Users/CARITAS CARUPANO/Desktop/CodexFlow/specs/018-system-hardening-invitations-audit-and-e2e-simulation/plan.md):
    1. **Paso 1**: Identificar folio de prueba en estado `pending`.
    2. **Paso 2**: Transcribir folio como Digitador (`POST /api/v1/folios/{id}/entries`, `status = completed`).
    3. **Paso 3**: Iniciar arbitraje como Evaluador (`POST /api/v1/evaluation/get_next`).
    4. **Paso 4**: Devolver al digitador (`POST /api/v1/evaluation/{id}/verdict` con `return_to_digitizer` y `review_notes`).
    5. **Paso 5**: Verificar que el folio aparezca de primero en la cola con `priority_returned == True`.
    6. **Paso 6**: Simular corrección por el digitador y re-envío (`status = completed`).
    7. **Paso 7**: Aprobación final por Evaluador (`verdict = verify_all` -> `status = verified`).
    8. **Paso 8**: Descargar paquete DIP FamilySearch (`/api/v1/folders/{folder_id}/export-familysearch?only_verified=true`), descomprimir el ZIP y validar la presencia y estructura de `matriz_indexacion.xlsx`, `matriz_indexacion.csv`, `export_gedcom.ged` y `manifest.json`.
    9. **Paso 9**: Restauración y limpieza controlada del estado del folio.
  - **Criterio de Aceptación**: La suite se ejecuta en la terminal y todos los 9 pasos pasan satisfactoriamente reportando 100% de éxito.

---

## Fase 5: Certificación Integral y Verificación

- [x] **T05-QA-01: Ejecución y certificación de `test_invite_flow.py`**
  - **Comando**: `python tools/testing/test_invite_flow.py`
  - **Criterio de Aceptación**: Validación completa del flujo de invitaciones y protecciones RBAC sin errores.

- [x] **T05-QA-02: Ejecución y certificación de `test_e2e_production_cycle.py`**
  - **Comando**: `python tools/testing/test_e2e_production_cycle.py`
  - **Criterio de Aceptación**: Simulación integral de los 9 pasos del ciclo de producción aprobada con validación del paquete ZIP.

- [x] **T05-QA-03: Verificación de compilación y ausencia de regresiones en Frontend**
  - **Comando**: `cd frontend && npm run build` (o `npm run lint`)
  - **Criterio de Aceptación**: Cero errores de TypeScript y compilación limpia de Next.js tras purga de rutas huérfanas.
