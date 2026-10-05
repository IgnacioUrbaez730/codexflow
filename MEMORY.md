# MEMORY.md — Sistema Inteligente de Indexación

Registro de memoria a corto/medio plazo para los agentes de Antigravity. Máximo ~50 líneas. Resume el estado y decisiones clave.

## Estado actual
- **Fase:** Implementación de la Spec 002 (Módulo 2).
- **Progreso:** Tareas T1 a T6 completadas con éxito.
  - T1: RLS y Base de Datos creados.
  - T2: Gestión de Plantillas creada.
  - T3: URLs Firmadas y Subida a Cloudflare R2 completada.
  - T4: FastAPI Backend estructurado.
  - T5: Worker de procesamiento (Poppler/Vips) programado.
  - T6: Visor Dual (OpenSeadragon) creado en Frontend.

## Decisiones Técnicas (y por qué)
- **Metodología:** SDD gestionado por Antigravity (El Coordinador).
- **Stack Aprobado:** Next.js (Front) + FastAPI Python (Back) + Supabase (BD, Auth) + Cloudflare R2 (Storage).
- **Infraestructura:** Vercel (Front) y Render (Back) conectados vía GitHub. Despliegues automatizados por el agente.
- **Seguridad:** Variables de entorno sensibles (`.env.local`) removidas del control de versiones tras bloqueo preventivo de GitHub.

## Próximos pasos (Pendientes)
- **MÓDULO 2 COMPLETADO.**
- A la espera de instrucciones para iniciar la especificación del Módulo 3 (Fase de IA / Modelo Predictivo).
