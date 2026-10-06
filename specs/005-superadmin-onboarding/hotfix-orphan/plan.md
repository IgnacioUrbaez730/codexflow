# Plan Técnico: RF-6 Manejo de Usuarios Huérfanos

## 1. Base de Datos
- **Migración de Enum**: Crear una migración en SQL que ejecute un `ALTER TYPE user_role ADD VALUE 'rejected'`. Esto permite que los usuarios sin asignar que sean descartados por el superadmin queden en un estado permanente de rechazo, evitando que vuelvan a quedar en la lista de espera (huérfanos).

## 2. Backend (Python/FastAPI)
- **Endpoint de Listado de Huérfanos**:
  - Crear o modificar un endpoint exclusivo de superadmin (por ejemplo, `GET /api/superadmin/orphans`) que liste todos los usuarios cuyo `tenant_id` sea nulo y que no tengan rol asignado o no tengan el rol `'rejected'`.
- **Endpoint de Gestión (Asignación / Rechazo)**:
  - Crear un endpoint (por ejemplo, `POST /api/superadmin/orphans/{user_id}/resolve`) que reciba una carga útil (payload) con la decisión tomada.
  - La carga útil deberá permitir:
    - Asignar a un `tenant_id` existente y un rol (`admin` o `operador`).
    - Asignar a un `tenant_id` nuevo (el frontend llamará primero a la creación de tenant y luego usará este endpoint).
    - Marcar con el rol `'rejected'`.

## 3. Frontend (React/Next.js)
- **Redirección de Login (`login/page.tsx`)**:
  - Modificar la lógica de autenticación (SSR/Client) para que, al detectar un inicio de sesión sin `tenant_id` ni `rol`, o con rol `'rejected'`, se redirija inmediatamente a la ruta `/pending`.
- **Página de Pendientes (`pending/page.tsx`)**:
  - Crear la nueva ruta y vista.
  - Renderizado dinámico según estado del usuario:
    - Si no tiene rol (huérfano): Mostrar estado "En revisión".
    - Si es `'rejected'`: Mostrar estado "Acceso Denegado Permanentemente".
  - Implementar botón funcional de "Cerrar Sesión".
  - Proveer un botón/enlace de contacto usando un esquema `mailto:` que inyecte dinámicamente el correo electrónico del usuario (extraído de su contexto) en el asunto del mensaje.
- **Actualización del Dashboard Global de Superadmin**:
  - Mostrar una alerta global o contador visual (badge/banner) avisando si el endpoint de listado detecta usuarios en espera de asignación.
  - Incorporar una vista o modal de gestión:
    - Tabla o lista de usuarios pendientes.
    - Controles interactivos con 3 acciones: Asignar a ONG Existente (desplegable de selección), Crear Nueva ONG (redirige a flujo de creación o modal unificado), Rechazar (actualiza usuario a `'rejected'`).
