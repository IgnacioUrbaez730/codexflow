# Tareas de Implementación: Loop 1 (Dashboard y Roles)

1. **Backend: Endpoint de Métricas**
   - [x] Implementar `GET /api/tenant/metrics` en FastAPI.
   - [x] Retornar folios subidos, verificados, consumo de cuota y conteo agrupado por los últimos 7 días.

2. **Frontend: Mover gestión de usuarios**
   - [x] Crear `frontend/src/app/[subdomain]/settings/users/page.tsx`.
   - [x] Mudar el formulario de "Invitar Digitador" desde el Dashboard hacia esta nueva vista.

3. **Frontend: Implementar Sidebar en Layout**
   - [x] Crear el componente Sidebar.
   - [x] Integrarlo en `frontend/src/app/[subdomain]/layout.tsx` haciendo que sus enlaces sean dinámicos según el rol.

4. **Frontend: Conectar Dashboard con datos reales**
   - [x] Actualizar `frontend/src/app/[subdomain]/dashboard/page.tsx`.
   - [x] Limpiar el código retirando el formulario de invitación movido.
   - [x] Conectar las métricas a `GET /api/tenant/metrics` y remover `setTimeout`.
