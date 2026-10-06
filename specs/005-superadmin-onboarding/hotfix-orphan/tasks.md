# Tareas de Implementación: RF-6 Manejo de Usuarios Huérfanos

## 1. Base de Datos
- [x] **T1:** Crear y aplicar la migración SQL para ejecutar `ALTER TYPE user_role ADD VALUE 'rejected'`.

## 2. Backend
- [x] **T2:** Implementar el endpoint `GET /api/superadmin/orphans` para listar usuarios sin `tenant_id` y con rol nulo/sin asignar.
- [x] **T3:** Implementar el endpoint `POST /api/superadmin/orphans/{user_id}/resolve` para procesar la acción de resolución (asignar `tenant_id` y rol, o asignar rol `rejected`).

## 3. Frontend
- [x] **T4:** Modificar `login/page.tsx` para redirigir a los usuarios sin `tenant_id`/rol, y a los que tienen rol `rejected`, hacia la ruta `/pending`.
- [x] **T5:** Crear la ruta y vista `/pending` (`pending/page.tsx`) con la interfaz condicional (Pendiente vs Denegado), botón de Cerrar Sesión y enlace `mailto:` dinámico que inyecte el email en el asunto.
- [x] **T6:** Integrar en el Dashboard de Superadmin la llamada para obtener huérfanos y mostrar un contador o alerta visual proactiva.
- [x] **T7:** Desarrollar la interfaz en el Dashboard de Superadmin para gestionar usuarios pendientes con opciones: desplegable de tenants existentes, crear nuevo tenant y rechazar.
- [x] **T8:** Conectar las acciones de la interfaz de gestión de huérfanos con el endpoint correspondiente en el backend y actualizar la vista de forma acorde.
