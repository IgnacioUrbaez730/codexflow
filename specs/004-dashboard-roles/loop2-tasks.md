# Tareas - Loop 2: Jerarquías, Personal y Fix de Subdominio

## Backend
- [ ] Modificar `/api/auth/me` para incluir `tenant_name` haciendo un join a la tabla de tenants.
- [ ] Revisar políticas RLS y endpoints para asegurar que todo el filtrado por tenant se hace con `tenant_id` del JWT, no de parámetros de URL.
- [ ] Crear/actualizar endpoint `GET /api/v1/team` para retornar la lista de usuarios con sus métricas (Folios Procesados Hoy) y estado (Activo/Inactivo).
- [ ] Implementar endpoint `POST /api/v1/team/invite` con validación de existencia e inactividad ("Usuario ya existe, reactívelo manualmente").
- [ ] Implementar endpoint `PATCH /api/v1/team/{user_id}` para editar rol y estado, con reglas de seguridad:
  - [ ] Bloquear autodesactivación/cambio de rol propio.
  - [ ] Prevenir la degradación/desactivación del último Admin activo.
- [ ] Añadir chequeo de usuario activo (Lazy Expulsion) en los endpoints operativos del Visor (`/next-folio`, `/save-folio`), retornando error 403 si el usuario está inactivo.

## Frontend
- [ ] Ajustar la lógica de Auth y redirección para usar el `tenant_name` del nuevo response de `/api/auth/me` en las redirecciones (eliminar el bug de `undefined`).
- [ ] Refactorizar el componente `Sidebar` (o el Layout) para mostrar opciones según el rol del usuario logueado.
- [ ] Configurar las rutas por defecto (Home) de acuerdo al rol (Admin -> Dashboard, Archivista/Digitizer -> Visor/Ingesta).
- [ ] Eliminar el Sidebar para el rol Digitizer (layout de visor pantalla completa).
- [ ] Conectar el Visor para que Admins y Archivistas puedan pedir folios de la misma cola global sin configuraciones especiales de rol.
- [x] Construir la vista de "Equipo" (`Tabla Completa`):
  - [x] Implementar tabla con las columnas: Nombre, Email, Rol, Folios Procesados Hoy, Estado.
  - [x] Agregar input de Búsqueda por texto.
  - [x] Agregar Select para filtro de Estado (Activos/Inactivos).
- [x] Implementar las acciones de la tabla de Equipo:
  - [x] Modal de Invitación de empleados conectada al nuevo POST del backend y manejo de errores.
  - [x] Modal/Menú para cambiar Rol del personal.
  - [x] Acción para desactivar/reactivar usuarios, con manejo adecuado de las advertencias del servidor.
- [ ] Asegurar que los errores de Lazy Expulsion (ej. al guardar un folio si te desactivaron) expulsen al usuario a la pantalla de login con un mensaje claro.
