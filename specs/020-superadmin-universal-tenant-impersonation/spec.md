# SPEC-020: Superadmin Universal Tenant Auditing & Impersonation Pass

## 1. Contexto y Justificación
Actualmente, los usuarios con rol de plataforma `superadmin` tienen `tenant_id = NULL` en su perfil de `user_profiles`, ya que no pertenecen a una organización diocesana específica, sino que gestionan la infraestructura global de CodexFlow.

Sin embargo, cuando un Superadmin utiliza el enlace de suplantación/auditoría (`/[subdomain]/dashboard?impersonate=[tenant_id]`) o navega directamente a la consola de cualquier tenant (como `codexflow-folios` o `diosis-margarita`), las consultas a `/api/v1/records`, `/api/tenant/metrics`, `/api/v1/folders/tree`, `/api/v1/folios/get_next` y `/api/v1/evaluation/get_next` se ejecutan con `tenant_id = None`. Como consecuencia, la base de datos filtra por `tenant_id IS NULL`, mostrando métricas en 0, tablas vacías e impidiendo que el Superadmin audite o asista a una diócesis.

## 2. Objetivos Principales
1. **Resolución Automática de Tenant en Backend (`get_auth_context`)**: Si el rol del usuario autenticado es `superadmin`, el backend debe resolver el `effective_tenant_id` dinámicamente a partir del header `x-tenant-id`, del header `x-subdomain`, del query parameter `?impersonate=` o del nombre de la organización en la URL (`tenants.name` / `tenants.slug`).
2. **Propagación Consistente en Frontend (`TenantContext.tsx` y fetch interceptor)**: El cliente web debe enviar automáticamente el header `x-tenant-id` o `x-subdomain` en todas las peticiones a la API cuando el usuario sea `superadmin` dentro de una ruta de tenant (`/[subdomain]/...`).
3. **Banner de Auditoría Global (Impersonation Banner)**: Renderizar una barra superior fija en color índigo/azul marino cuando un Superadmin esté operando dentro del espacio de una diócesis, indicando la organización activa y un botón de un clic para *"Volver al Panel Superadmin"*.
4. **Acceso Irrestricto a Vistas de Producción**: El Superadmin debe tener permisos de lectura y operación en todas las vistas (`/dashboard`, `/ingest`, `/visor`, `/evaluacion`, `/records`, `/metrics`, `/manual`), sin ser bloqueado por guardias de rol.
5. **Aislamiento Multi-Tenant Preservado**: Los usuarios normales (`admin`, `archivist`, `evaluator`, `digitizer`) bajo ninguna circunstancia pueden usar estos headers para saltar de organización; sus consultas seguirán restringidas exclusivamente al `tenant_id` asignado en su perfil de Supabase.

## 3. Arquitectura y Componentes Afectados
- `backend/main.py`: Función `get_auth_context`, `auth_me`, y consultas de métricas/carpetas/folios.
- `frontend/src/context/TenantContext.tsx`: Detección y resolución de `tenantId` para rol `superadmin`.
- `frontend/src/app/[subdomain]/layout.tsx`: Integración de `SuperadminImpersonationBanner` y autorización plena en `SubdomainGuard`.
- `frontend/src/components/superadmin/SuperadminImpersonationBanner.tsx`: Componente visual con selector rápido de organización y botón de retorno a `/superadmin`.
- `tools/testing/test_superadmin_impersonation.py`: Suite de validación automatizada para confirmar el acceso del Superadmin a los folios y métricas de cualquier tenant.
