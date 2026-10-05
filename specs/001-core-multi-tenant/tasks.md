# Tareas — 001 Núcleo Multi-Tenant

- [x] **T1. Setup Inicial y Base de Datos.** RF-6, RF-7.
  - Instalar dependencias locales e inicializar Supabase (`supabase init`).
  - Crear la migración inicial SQL (`001_initial_schema.sql`) con las tablas `organizations`, `organization_users`, y `folio_usage_logs`.
  - Configurar las políticas de Row-Level Security (RLS).
  - *Hecho cuando:* Los tests locales SQL a la BD rebotan un `SELECT` si el usuario no tiene permisos en `organization_users`.

- [x] **T2. Autenticación y Registro (UI & Lógica).** RF-1.
  - Crear proyecto Next.js (`npx create-next-app`).
  - Configurar Supabase Auth en Next.js (Server actions / SSR).
  - Crear pantalla `/register` con campos para Subdominio y selector de Timezone, además de botones de Google/Meta.
  - *Hecho cuando:* El registro guarde al usuario en Auth, cree la ONG en la tabla y asocie ambas.

- [x] **T3. Middleware de Subdominios.** RF-1, RF-2.
  - Crear `middleware.ts` en Next.js.
  - Programar la lógica para interceptar subdominios y reescribir la ruta internamente hacia `app/[subdomain]`.
  - Impedir registros con subdominios duplicados.
  - *Hecho cuando:* Navegar a `test.localhost:3000` muestre el contenido del tenant "test" (aislado).

- [x] **T4. Lógica de Cuotas y Límites.** RF-3, RF-4, RF-5.
  - Crear archivo de funciones puras `quotas.actions.ts`.
  - Implementar la función que suma el consumo diario y semanal usando la Timezone guardada en la tabla `organizations`.
  - Mostrar error visual en la UI y bloquear guardado simulado.
  - *Hecho cuando:* La función devuelva `bloqueado = true` al inyectarle una fecha que supere las 00:00:00 locales y `sum >= 5`.

- [x] **T5. Panel de Superadmin (God-Mode).** RF-8.
  - Crear ruta `/god-mode` protegida. Solo accesible si el email coincide con `SUPERADMIN_EMAIL` en `.env`.
  - *Hecho cuando:* Un usuario no admin recibe un 403, pero el admin ve la tabla de consumo.
