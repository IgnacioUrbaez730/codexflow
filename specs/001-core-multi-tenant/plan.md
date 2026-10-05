# Plan Técnico — 001 Núcleo Multi-Tenant

## 1. Archivos y Responsabilidades (Arquitectura)

### Base de Datos (Supabase Migrations)
- `supabase/migrations/001_initial_schema.sql`: 
  - Tabla `organizations` (id, name, subdomain, timezone, created_at).
  - Tabla `organization_users` (user_id, organization_id, role, status).
  - Tabla `folio_usage_logs` (id, organization_id, date_recorded, folios_count).
  - **Políticas RLS:** Reglas SQL estrictas garantizando que un usuario solo pueda hacer `SELECT` o `INSERT` donde su `user_id` exista en `organization_users` para ese `organization_id`. (Cubre RF-6 y RF-7).

### Frontend (Next.js)
- `middleware.ts`: El corazón del subdominio. Intercepta la petición (ej. `archivo.app.com`), extrae el subdominio (`archivo`), verifica en Supabase si existe, y reescribe la ruta internamente hacia `app/[subdomain]/page.tsx`. (Cubre RF-1).
- `app/register/page.tsx`: Componente de cliente con formulario para nombre de ONG, subdominio deseado y selector de Zona Horaria. Botones de Login con Google/Meta (Supabase Auth). (Cubre RF-1 y RF-2).
- `app/[subdomain]/dashboard/page.tsx`: Vista principal de la ONG. Verifica cuotas al cargar. Muestra botón de "Invitar Digitador" y "Reenviar Invitación". (Cubre RF-5 y RF-6).
- `app/god-mode/page.tsx`: Panel Superadmin. (Cubre RF-8).

### Backend / Lógica (Next.js Server Actions)
- `actions/auth.actions.ts`: Lógica para validar si un subdominio ya existe en BD antes de registrar.
- `actions/quotas.actions.ts`: Funciones puras para evaluar límites.

## 2. Funciones Puras y Algoritmo de Cuotas (RF-3 y RF-4)
**Algoritmo `checkQuotaLimt(organization_id)`:**
1. Obtener la `timezone` de la `organizations` desde BD.
2. Convertir la fecha UTC actual del servidor a la hora local de esa zona horaria.
3. Extraer el inicio del día local (00:00:00) y el inicio de la semana local (Lunes 00:00:00).
4. Hacer un `SUM(folios_count)` en `folio_usage_logs` filtrando `date_recorded` >= inicio del día.
5. Si `SUM >= 5`, retornar `bloqueo_diario: true`. Idem para semanal (25).

## 3. Decisiones Técnicas Justificadas
- **Alternativa descartada:** Crear subdominios reales en Vercel vía API. 
  **Decisión tomada:** Usar `middleware.ts` para reescritura de rutas. Es gratis, no requiere llamadas a la API de Vercel y es instantáneo. Todo el tráfico va al dominio principal, el middleware lo simula visualmente.
- **Alternativa descartada:** Variable de entorno múltiple para Superadmins.
  **Decisión tomada:** `SUPERADMIN_EMAIL` único en `.env.local` por simplicidad del MVP.

## 4. Estrategia de Tests
- Escribiremos scripts de prueba contra la Base de Datos local de Supabase (`supabase start`) usando un usuario dummy. Intentaremos hacer `SELECT` a la ONG A estando logueados como ONG B para garantizar que el RLS rechaza la petición.
