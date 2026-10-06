# MEMORY.md — Sistema Inteligente de Indexación

Registro de memoria a corto/medio plazo para los agentes de Antigravity. Máximo ~50 líneas. Resume el estado y decisiones clave.

## Estado actual
- **Fase:** Módulo 5 COMPLETADO (Backoffice de Super-Administrador y Onboarding Manual). EL SAAS ESTÁ TERMINADO A NIVEL CÓDIGO.
- **Progreso Módulo 5:** Tareas T1 a T10 implementadas. QA Aprobó tras corregir bugs de esquema.
  - Roles: Rol `superadmin` añadido.
  - Seguridad: Middleware `get_superadmin_context` para blindar `/api/superadmin`. Función SQL `is_superadmin()` con `SECURITY DEFINER` para hacer bypass RLS.
  - Bootstrapping: Trigger en BD que corona al primer usuario registrado automáticamente.
  - Onboarding: Concierge Onboarding implementado (`/superadmin/new`). El sistema crea el Tenant, asigna la cuota y envía un Magic Link de Supabase al dueño de la ONG.

## Decisiones Técnicas (y por qué)
- **Desvío del Roadmap (Sin Pasarela de Pagos):** Por instrucciones del fundador, el SaaS no tendrá Stripe por ahora. Se venderá la licencia directamente a la ONG (uso exclusivo/marca blanca).
- **Control de RAM y Cuellos de Botella:** La arquitectura se refactorizó para correr con un Semáforo de concurrencia y un Streamer de CSV. Así aseguramos que el OCR y la descarga masiva no exploten el servidor gratuito de 512MB de Render.

## Próximos pasos (Pendientes)
- **FASE DE DESPLIEGUE A PRODUCCIÓN.**
- Tareas: Configurar cuentas reales de Supabase (Prod), Cloudflare R2 (Storage), y desplegar el Frontend (Vercel) y Backend (Render/Railway).
