# Tareas: Hotfix Bootstrapping

- [x] **T1: Limpieza de Base de Datos (SQL)**
  - Revisar los scripts de migración o las funciones activas en la BD (Supabase/PostgreSQL).
  - Eliminar cualquier trigger (`trigger_assign_first_user_admin`, etc.) y función asociada que automatice la asignación de roles inicial basada en conteo (el "primer usuario registrado").
  - Aplicar/Generar migración para reflejar estos cambios.

- [x] **T2: Backend - Endpoint de Auto-Reparación (FastAPI)**
  - Crear el endpoint `POST /api/auth/self-heal` en el enrutador de autenticación correspondiente.
  - Incorporar validación de dependencias de JWT para garantizar autenticación del token.
  - Implementar lógica que verifique si `email` en JWT coincide con `os.getenv("SUPERADMIN_EMAIL")`.
  - Si coincide, realizar `UPDATE user_profiles SET role = 'superadmin', tenant_id = NULL WHERE ...`.
  - Agregar `logger.info("AUDIT: Usuario X auto-reparado y elevado a Super Admin")` a la consola.
  - Manejar excepciones en caso de error y retornar códigos HTTP correspondientes.

- [x] **T3: Frontend - Integración en Middleware / Flujo de Autenticación (Next.js)**
  - Modificar el archivo que maneja la verificación de sesión post-login o el middleware de rutas.
  - Añadir la lógica condicional: Si el usuario está autenticado pero su rol es nulo / inexistente.
  - Ejecutar petición `fetch('/api/auth/self-heal', { method: 'POST' })` usando el Proxy API establecido.
  - Si el backend confirma la elevación, forzar recarga/actualización de los claims de sesión y redirigir a `/superadmin`.
  - Si falla, permitir que el flujo siga su curso normal redirigiendo a `/pending`.
