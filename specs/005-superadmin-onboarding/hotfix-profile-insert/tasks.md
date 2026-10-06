# Tareas Secuenciales de Implementación

Siguiendo el flujo SDD estricto.

- [x] **T1: SQL Migrations (enum, trigger, retroactivo)**
  - Añadir `'pending'` al ENUM de roles de usuario.
  - Crear la función del trigger para insertar en `user_profiles` en base a nuevos registros en `auth.users` (rol `'pending'`, `tenant_id` a `null`).
  - Crear y ejecutar el script SQL retroactivo para los usuarios viejos sin perfil.

- [x] **T2: Backend Python (/api/auth/me)**
  - Reemplazar `/api/auth/self-heal` por `/api/auth/me`.
  - Programar la evaluación: si rol es `'pending'`, comprobar si email es del superadmin.
  - Escalar silenciosamente a `'superadmin'` si corresponde y devolver `{ "role": "superadmin", "redirect_url": "/superadmin" }`.
  - Si no, devolver `{ "role": "pending", "redirect_url": "/pending" }` (y lo análogo para otros roles ya fijados).

- [x] **T3: Frontend (login y register)**
  - Modificar `login/page.tsx` para depender de la respuesta `/api/auth/me` en el flujo post-login y hacer la redirección.
  - Modificar `register/page.tsx` para seguir el mismo patrón post-registro.
  - Limpiar el código redundante de enrutamiento local.
