# TASKS-020: Tareas de Implementación — Superadmin Universal Tenant Auditing & Impersonation Pass

Este documento detalla de manera secuencial, granular y ejecutable las tareas técnicas necesarias para implementar la especificación [spec.md](file:///c:/Users/CARITAS%20CARUPANO/Desktop/CodexFlow/specs/020-superadmin-universal-tenant-impersonation/spec.md) de acuerdo con el plan arquitectónico [plan.md](file:///c:/Users/CARITAS%20CARUPANO/Desktop/CodexFlow/specs/020-superadmin-universal-tenant-impersonation/plan.md).

---

## Fase 1: Backend FastAPI — Resolución Universal de Tenant y Bypass Seguro

- [x] **T01-BE-01: Implementar resolución jerárquica de tenant dinámico en `get_auth_context`**
  - **Archivo:** `backend/main.py`
  - **Dependencias:** Ninguna
  - **Descripción:**
    1. Actualizar la firma de `get_auth_context` para recibir `request: Request`, `x_tenant_id: Optional[str] = Header(None)` y `x_subdomain: Optional[str] = Header(None)`.
    2. Si el rol del perfil recuperado es `superadmin`:
       - Determinar `effective_tenant_id`:
         a) Si se recibe `x_tenant_id`, validar contra `tenants` (`id = x_tenant_id`).
         b) Si no, pero se recibe `x_subdomain`, buscar en `tenants` (`name = x_subdomain` o `slug = x_subdomain`).
         c) Si no viene ninguno, analizar el header `Referer` de `request` buscando patrones tipo `/{subdomain}/...` y consultar `tenants`.
         d) Si no se especifica ninguno (ej. operando en consola central `/superadmin`), asignar `effective_tenant_id = None`.
       - Si el tenant consultado no existe, levantar `HTTPException(status_code=404, detail="Organización solicitada no encontrada")`.
       - Si el tenant tiene `is_active is False`, levantar `HTTPException(status_code=403, detail="Organización solicitada inactiva")`.
       - Asignar `auth_ctx["tenant_id"] = effective_tenant_id` y `auth_ctx["user_client"] = supabase` (service client con privilegios administrativos para bypass RLS condicionado).
    3. Si el rol NO es `superadmin`: ignorar cualquier header `x_tenant_id` o `x_subdomain`, manteniendo `auth_ctx["tenant_id"] = profile.get("tenant_id")`.
  - **Criterios de Aceptación:**
    - Un superadmin que envíe `x-subdomain: codexflow-folios` obtiene `auth["tenant_id"]` con el UUID de dicha diócesis.
    - Usuarios convencionales no pueden alterar su tenant mediante headers bajo ningún escenario.
    - Organizaciones inexistentes devuelven HTTP 404 e inactivas devuelven HTTP 403.

- [x] **T01-BE-02: Particionar `_AUTH_CACHE` por tupla `(token_hash, effective_tenant_id)`**
  - **Archivo:** `backend/main.py`
  - **Dependencias:** T01-BE-01
  - **Descripción:**
    1. Redefinir la estructura de `_AUTH_CACHE` para utilizar claves tupla `(token_hash, effective_tenant_id)`.
    2. En `get_auth_context`:
       - Para superadmins, computar el `effective_tenant_id` objetivo de la llamada antes de evaluar el hit de caché, de modo que consultar `codexflow-folios` y acto seguido `diosis-margarita` use particiones independientes.
       - Almacenar el contexto con su TTL estándar (`AUTH_CACHE_TTL_SECONDS = 60`).
    3. Actualizar la función `invalidate_auth_cache_for_user(user_id)` para iterar sobre todas las entradas de `_AUTH_CACHE` y eliminar cualquier tupla donde `ctx.get("user_id") == user_id`.
  - **Criterios de Aceptación:**
    - Alternar llamadas consecutivas entre dos inquilinos diferentes usando el mismo token de superadmin devuelve datos independientes sin solapamiento de caché.
    - La invalidación por `user_id` limpia todas las variantes de tenant cacheadas para dicho usuario.

- [x] **T01-BE-03: Adaptar endpoint `/api/auth/me` para responder con el contexto de impersonación**
  - **Archivo:** `backend/main.py`
  - **Dependencias:** T01-BE-01
  - **Descripción:**
    1. Actualizar la firma de `auth_me` para recibir `x_subdomain: Optional[str] = Header(None)` y `x_tenant_id: Optional[str] = Header(None)`.
    2. Cuando `role == "superadmin"`:
       - Si se recibe `x_subdomain` o `x_tenant_id`, validar la existencia de la organización en la tabla `tenants`.
       - Si existe y está activa, retornar:
         ```json
         {
           "role": "superadmin",
           "is_superadmin": true,
           "tenant_id": tenant["id"],
           "tenant_name": tenant["name"],
           "has_completed_onboarding": true,
           "redirect_url": f"/{tenant['name']}/dashboard"
         }
         ```
       - Si no se especifica tenant, retornar el estado global:
         ```json
         {
           "role": "superadmin",
           "is_superadmin": true,
           "tenant_id": null,
           "tenant_name": null,
           "has_completed_onboarding": true,
           "redirect_url": "/superadmin"
         }
         ```
  - **Criterios de Aceptación:**
    - `/api/auth/me` con token de superadmin y `x-subdomain` retorna `is_superadmin: true` y el `tenant_id` resuelto.
    - `/api/auth/me` sin headers de inquilino retorna `tenant_id: null` y `redirect_url: "/superadmin"`.

- [x] **T01-BE-04: Desbloquear acceso universal de superadmin en endpoints operativos**
  - **Archivo:** `backend/main.py`
  - **Dependencias:** T01-BE-01, T01-BE-02
  - **Descripción:**
    1. En `/api/tenant/metrics`: garantizar que opere transparentemente sobre `auth["tenant_id"]` resuelto.
    2. En `/api/v1/records`: asegurar que `superadmin` tenga autorización plena para consultar registros del tenant resuelto, recuperando carpetas, folios y partidas sin excepción de rol.
    3. En `/api/v1/folders/tree` y endpoints de gestión de carpetas: permitir que el superadmin audite el árbol de tomos y carpetas de la diócesis activa.
    4. En `/api/v1/folios/get_next` y `/api/v1/evaluation/get_next`: permitir al superadmin solicitar y revisar folios en cola sin arrojar 403.
  - **Criterios de Aceptación:**
    - Ninguno de los endpoints operativos arroja 403 cuando el superadmin opera con un `tenant_id` resuelto.
    - La consulta de `/api/v1/records` retorna las partidas y contadores reales de la diócesis auditada.

- [x] **T01-BE-05: Permitir exportación DIP agnóstica de organización en `/export-familysearch`**
  - **Archivo:** `backend/main.py`
  - **Dependencias:** T01-BE-01
  - **Descripción:**
    1. En `/api/v1/folders/{folder_id}/export-familysearch`:
       - Si `auth["role"] == "superadmin"`:
         - Consultar `document_folders` por `id = folder_id` sin condicionar inicialmente por `tenant_id`.
         - Si existe, adoptar el `folder["tenant_id"]` nativo de dicho tomo para consultar sus folios y entradas.
       - Si el rol es regular, mantener la validación estricta `.eq("tenant_id", auth["tenant_id"])`.
    2. Generar el paquete ZIP con su matriz Excel, CSV con BOM, GEDCOM 5.5.1 y `manifest.json` referenciando el nombre canónico de la diócesis correspondiente.
  - **Criterios de Aceptación:**
    - El superadmin puede descargar el paquete DIP de un tomo perteneciente a cualquier diócesis sin errores de pertenencia.

---

## Fase 2: Frontend TenantContext y Propagación de Cabeceras

- [x] **T02-FE-01: Extender `TenantContext.tsx` con soporte de auditoría e impersonación**
  - **Archivo:** `frontend/src/context/TenantContext.tsx`
  - **Dependencias:** T01-BE-03
  - **Descripción:**
    1. Ampliar `TenantContextType` agregando la propiedad `isSuperadmin: boolean`.
    2. En `fetchAuth`:
       - Pasar en los headers de `/api/auth/me`: `Authorization: Bearer ...` y si `subdomain` está presente, `x-subdomain: subdomain`.
       - Almacenar en el estado `{ role, tenantId: data.tenant_id, isSuperadmin: data.role === "superadmin" || data.is_superadmin }`.
  - **Criterios de Aceptación:**
    - El contexto provee `isSuperadmin === true` cuando un superadmin está autenticado.
    - El `tenantId` en memoria se actualiza con el ID de la diócesis auditada en lugar de ser nulo.

- [x] **T02-FE-02: Implementar helper `apiClient.ts` y propagar `x-subdomain` en vistas de datos**
  - **Archivos:**
    - `frontend/src/lib/apiClient.ts`
    - `frontend/src/app/[subdomain]/records/page.tsx`
    - `frontend/src/app/[subdomain]/dashboard/page.tsx`
    - `frontend/src/app/[subdomain]/visor/page.tsx`
    - `frontend/src/app/[subdomain]/evaluacion/page.tsx`
    - `frontend/src/app/[subdomain]/ingest/page.tsx`
  - **Dependencias:** T02-FE-01
  - **Descripción:**
    1. Crear `frontend/src/lib/apiClient.ts` exportando `apiFetch(url, options, subdomain)`.
    2. En las páginas clave (`records`, `dashboard`, `visor`, `evaluacion`, `ingest`):
       - Asegurar que las llamadas a `/api/v1/records`, `/api/tenant/metrics`, `/api/v1/folders/tree`, `/api/v1/folios/get_next`, etc., envíen el header `x-subdomain: subdomain`.
  - **Criterios de Aceptación:**
    - Todas las peticiones HTTP originadas desde vistas dentro de un subdominio viajan acompañadas de `x-subdomain`.

- [x] **T02-FE-03: Actualizar `SubdomainGuard` para acceso irrestricto y manejo de errores 404/403**
  - **Archivo:** `frontend/src/app/[subdomain]/layout.tsx`
  - **Dependencias:** T02-FE-01
  - **Descripción:**
    1. En `SubdomainGuard`:
       - Si `role === "superadmin"`, autorizar el acceso incondicional a todas las rutas de la diócesis (`/dashboard`, `/visor`, `/evaluacion`, `/ingest`, `/records`, `/metrics`, `/settings/users`, `/manual`).
    2. Si `/api/auth/me` falla o la organización no existe (respuesta 404/403):
       - Capturar el error, emitir un toast de alerta: *"La organización solicitada no existe o está inactiva"*.
       - Redirigir al superadmin a `/superadmin`.
  - **Criterios de Aceptación:**
    - Un superadmin puede navegar libremente por cualquier subruta del tenant sin sufrir redirecciones involuntarias.
    - Al ingresar un subdominio inexistente en la URL, se produce una redirección limpia a `/superadmin` con toast explicativo.

---

## Fase 3: Componentes de UI de Impersonación y Experiencia de Auditoría

- [x] **T03-UI-01: Crear componente `SuperadminImpersonationBanner.tsx`**
  - **Archivo:** `frontend/src/components/superadmin/SuperadminImpersonationBanner.tsx`
  - **Dependencias:** T02-FE-01
  - **Descripción:**
    1. Diseñar componente adhesivo con Tailwind: `sticky top-0 z-40 bg-indigo-950 border-b border-indigo-800 text-white px-4 py-2.5 shadow-md flex items-center justify-between`.
    2. Mostrar icono `ShieldAlert` / `ShieldCheck` en color ámbar.
    3. Etiqueta informativa destacada: *"Modo Auditoría Global (Superadmin) — Viendo: {tenantName || subdomain}"*.
    4. Botón de un clic `[Volver al Panel Global]` que redirige a `/superadmin` con icono de flecha/retorno.
  - **Criterios de Aceptación:**
    - El banner es visualmente distintivo, elegante y no interfiere con la ergonomía ni los controles de navegación.

- [x] **T03-UI-02: Integrar selector desplegable de organizaciones con preservación de subruta activa**
  - **Archivo:** `frontend/src/components/superadmin/SuperadminImpersonationBanner.tsx`
  - **Dependencias:** T03-UI-01
  - **Descripción:**
    1. En el banner, añadir un selector desplegable (`<select>` estilizado o dropdown accesible) que cargue las organizaciones registradas (`GET /api/superadmin/tenants`).
    2. Al seleccionar otra diócesis:
       - Extraer la subruta actual a partir de `usePathname()` (ej. `records?status=completed` o `dashboard`).
       - Navegar a `/{nuevoSubdomain}/{subruta}`, permitiendo comparar de inmediato la misma pantalla entre distintas diócesis.
  - **Criterios de Aceptación:**
    - El cambio de organización en el dropdown redirige de forma instantánea conservando la vista activa.

- [x] **T03-UI-03: Integrar banner en `[subdomain]/layout.tsx` y adaptar pie de `Sidebar.tsx`**
  - **Archivos:**
    - `frontend/src/app/[subdomain]/layout.tsx`
    - `frontend/src/components/Sidebar.tsx`
  - **Dependencias:** T03-UI-01
  - **Descripción:**
    1. En `[subdomain]/layout.tsx`: renderizar `<SuperadminImpersonationBanner />` si `role === "superadmin"`.
    2. En `Sidebar.tsx`:
       - Si `role === "superadmin"`, modificar el pie de página para exhibir: `"Rol: Superadmin (Auditando: {subdomain})"` junto a un enlace directo al panel global.
  - **Criterios de Aceptación:**
    - El banner se renderiza exclusivamente cuando el superadmin está dentro del espacio de un inquilino.
    - La barra lateral refleja visualmente el estado de auditoría.

---

## Fase 4: Suite de Pruebas de Integración y Validación

- [x] **T04-QA-01: Implementar suite automatizada `test_superadmin_impersonation.py`**
  - **Archivo:** `tools/testing/test_superadmin_impersonation.py`
  - **Dependencias:** T01-BE-01, T01-BE-02, T01-BE-03, T01-BE-04
  - **Descripción:**
    1. Crear script independiente en Python que ejecute pruebas contra la API de CodexFlow:
       - **Prueba 1:** Login como superadmin y consulta a `/api/auth/me` con `x-subdomain: codexflow-folios`.
       - **Prueba 2:** Llamada a `/api/tenant/metrics` y `/api/v1/records` con `x-subdomain: codexflow-folios`. Validar que devuelva las métricas y registros reales del Tomo 1 (`total > 0`).
       - **Prueba 3:** Llamada consecutiva con `x-subdomain: diosis-margarita`. Validar que devuelva métricas y registros propios (aislados, en 0 registros), confirmando que no se mezclan datos en caché.
       - **Prueba 4:** Simulación de ataque de spoofing: autenticar usuario no-superadmin y enviar `x-subdomain: diosis-margarita`. Validar que el backend rechace la suplantación o mantenga el aislamiento estricto.
       - **Prueba 5:** Consulta con subdominio inexistente y comprobación de código HTTP 404.
  - **Criterios de Aceptación:**
    - La ejecución del script completa todos los casos de prueba y finaliza con código de salida 0.

- [ ] **T04-QA-02: Ejecución de verificación final y reporte de pruebas de integración**
  - **Dependencias:** T04-QA-01
  - **Descripción:**
    1. Ejecutar el script `tools/testing/test_superadmin_impersonation.py`.
    2. Documentar la salida de auditoría garantizando cero regresiones en los flujos de producción.
  - **Criterios de Aceptación:**
    - Todas las aserciones de seguridad y aislamiento multi-tenant resultan satisfactorias.
