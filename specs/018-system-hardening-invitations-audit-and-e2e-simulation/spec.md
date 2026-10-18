# SPEC-018: Blindaje Integral de Estabilidad, Auditoría de Invitaciones, Simulación E2E y Fluidez de Vistas

## 1. Contexto y Propósito
Tras haber implementado todos los módulos centrales de CodexFlow (incluyendo la Mesa de Evaluación `/evaluacion`, roles RBAC y exportación DIP FamilySearch), esta especificación tiene como objetivo **blindar el sistema de punta a punta**. Se eliminan cuellos de botella de red, se purga código muerto, se asegura la resiliencia de sesión e invitaciones, y se certifica el ciclo completo de producción mediante una suite de pruebas automatizada E2E.

---

## 2. Decisiones Consensuadas en Fase de Clarificación (Triple Filtro QA — 15 Respuestas)

### Ronda 1: Flujo de Invitaciones y Resiliencia de Sesiones (Frente 1)
1. **Estructura de Invitación y Enlace en `/settings/users`:** Enlace Magic Link de Supabase con redirección absoluta hacia el subdominio del tenant (`https://[tenant].codexflow.com` o `/{subdomain}/login`) asegurando que el nuevo usuario no caiga en la raíz.
2. **Expiración de Token JWT tras Horas de Digitación:** Validar la sesión en memoria local (React Context / `useMemo`) y refrescar el token silenciosamente en segundo plano sin interrumpir ni recargar la pantalla.
3. **Control de Accesos No Autorizados por URL:** Si un Digitador intenta entrar a `/ingest`, `/evaluacion` o `/settings/users`, redirigir silenciosamente a `/visor` con un toast informativo *"Acceso restringido a tu rol"*.
4. **Auditoría del Flujo de Invitaciones:** Crear un script de prueba de integración (`tools/testing/test_invite_flow.py`) que ejecute una invitación real vía Supabase Auth y certifique la estructura correcta del enlace y asignación de rol.
5. **Seguridad contra Auto-Eliminación:** Impedir la auto-eliminación o degradación de rol si el usuario es el único `admin` activo de la organización, mostrando una alerta preventiva.

### Ronda 2: Fluidez, Rendimiento de Vistas y Supabase (Frente 2)
6. **Optimización de Transición entre Vistas:** Cargar en paralelo con `Promise.all()` y cachear en el Layout del tenant la sesión, el rol y las carpetas para que cambiar de pestaña (`/dashboard` ➔ `/ingest` ➔ `/visor` ➔ `/records` ➔ `/evaluacion`) no vuelva a pedirlos a Supabase de forma redundante.
7. **Singleton de Supabase en Frontend:** Crear un singleton memoizado (`getSupabaseBrowserClient`) en `frontend/src/lib/supabaseClient.ts` para que todos los hooks y componentes compartan la misma instancia única de Supabase, evitando re-renders del DOM.
8. **Caché en Memoria TTL en Backend:** Implementar una caché en memoria TTL (5 minutos) en FastAPI para que `get_auth_context` reutilice el perfil y rol del usuario sin hacer dos consultas de red a Supabase Cloud por cada clic.
9. **Limpieza de Código Muerto:** Purgar de inmediato carpetas y rutas huérfanas en el frontend (ej. `/[subdomain]/dudosos`, `visor/[batch_id]`) y scripts residuales de prueba antiguos.
10. **Retención de Estado al Volver Atrás:** Retener la última consulta y filtros en estado de React para que al navegar entre `/records` y `/visor` la tabla aparezca al instante sin spinner de recarga innecesario.

### Ronda 3: Simulación E2E del Ciclo Completo de Producción y Blindaje de Errores (Frente 3)
11. **Metodología de Validación del Ciclo E2E:** Crear una suite automatizada de prueba E2E (`tools/testing/test_e2e_production_cycle.py`) que ejecute todo el flujo en el tenant de demostración y certifique cada transición de estado y exportación.
12. **Folio de Prueba Controlado:** Usar un folio de prueba controlado del corpus (uno de los folios en `pending` existentes) para simular la transcripción real sin alterar los ya verificados.
13. **Certificación de la Devolución (`Alt + R`):** Verificar que `review_notes` y `priority_returned = true` se sincronicen de inmediato y que el folio aparezca de primero en `/visor` con el banner ámbar.
14. **Certificación de la Exportación DIP FamilySearch (`only_verified=true`):** Descargar el `.ZIP`, descomprimirlo y validar que `matriz_indexacion.xlsx`, `matriz_indexacion.csv` y `export_gedcom.ged` contengan 100% de actas verificadas y 0 errores de estructura.
15. **Blindaje ante Caídas de Red o Desconexión:** Incorporar un indicador visual de conectividad (punto verde/rojo) en la barra superior con reintento automático silencioso (*exponential backoff*) cada 5 segundos al reconectar, respaldando siempre el borrador en LocalStorage.
