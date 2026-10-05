# MEMORY.md — Sistema Inteligente de Indexación

Registro de memoria a corto/medio plazo para los agentes de Antigravity. Máximo ~50 líneas. Resume el estado y decisiones clave.

## Estado actual
- **Fase:** Implementación (Paso 6) de la Spec 002.
- **Spec 001 (Core Multi-Tenant):** Completada, QA Aprobado. Plataforma base funcional.

## Decisiones Técnicas (y por qué)
- **Metodología:** SDD gestionado por Antigravity (El Coordinador).
- **Stack Aprobado:** Next.js (Front) + FastAPI Python (Back) + Supabase (BD, Auth) + Cloudflare R2 (Storage).
- **Almacenamiento de Imágenes:** Cloudflare R2 por su Egress gratuito. Seguridad vía Signed URLs desde FastAPI.

## Próximos pasos (Pendientes)
1. Ejecutar Tareas (T1 a T8) del Módulo 2 mediante el Implementador.
2. Configurar infraestructura (Render, Vercel, Cloudflare R2).
