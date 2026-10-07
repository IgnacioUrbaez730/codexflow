# Plan de Implementación: Loop 1 (Dashboard y Roles)

## Arquitectura

### Backend (FastAPI)
- **Endpoint:** `GET /api/tenant/metrics`
- **Responsabilidad:** Devolver datos reales de uso basados en el `tenant_id`.
- **Datos a incluir:** Folios subidos, verificados, consumo de cuota, y conteo de procesamiento agrupado por los últimos 7 días.

### Frontend (Next.js)
- **Sidebar (Navegación):**
  - Actualizar `frontend/src/app/[subdomain]/layout.tsx`.
  - Incluir un componente `Sidebar` que reemplace el layout vacío.
  - El Sidebar debe ser adaptativo basado en el rol del usuario actual.
- **Refactorización de Dashboard (`frontend/src/app/[subdomain]/dashboard/page.tsx`):**
  - Eliminar los mock data actuales (`setTimeout`).
  - Mudar la lógica del formulario de "Invitar Digitador" a su propia vista.
- **Gestión de Equipo:**
  - Mover la funcionalidad de invitar usuarios a `/settings/users/page.tsx`.
