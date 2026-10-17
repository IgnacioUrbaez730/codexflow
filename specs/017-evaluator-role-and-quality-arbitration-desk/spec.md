# SPEC-017: Rol de Evaluador (`evaluator`) y Mesa de Arbitraje de Calidad (`/evaluacion`)

## 1. Contexto y Propósito
En el flujo archivístico profesional (estándar FamilySearch / archivos diocesanos), el trabajo de indexación requiere una etapa formal de **Control de Calidad y Verificación**:
1. El **Digitalizador (`digitizer`)** transcribe el manuscrito paleográfico en el Visor Dual y al finalizar guarda el acta en estado **`completed`**, o si tiene dudas paleográficas la marca en **`revision`** (*Dudoso*).
2. El **Evaluador (`evaluator`)** (así como el `admin`, `archivist` o `superadmin`) revisa las actas transcritas en la **Mesa de Arbitraje de Calidad (`/[subdomain]/evaluacion`)** comparando la imagen original de alta resolución con los datos digitados para:
   - **Aprobar / Verificar (`verified`):** Certifica que la transcripción es fiel al documento original, sellando `verified_at` y quién lo verificó.
   - **Corregir y Verificar:** Edita directamente cualquier error tipográfico o paleográfico menor y aprueba el acta en el mismo paso (alimentando además `training_data` como *Gold Standard*).
   - **Devolver a Cola de Digitación (`pending` con prioridad + nota):** Si la transcripción está incompleta o equivocada, la devuelve con una nota de observación (`review_notes`) que el digitador verá en un banner destacado al principio de su cola en `/visor`.
   - **Escalar / Mantener en Dudoso (`revision` + nota):** Para casos de ilegibilidad severa o arbitraje especializado.

---

## 2. Decisiones Consensuadas en Fase de Clarificación (Triple Filtro QA — 15 Respuestas)

### Ronda 1: Permisos RBAC, Colas de Trabajo, Edición y Notas de Revisión
1. **Permisos de Navegación del Rol `evaluator`:** Acceso a **Mesa de Evaluación (`/evaluacion`)**, **Explorador de Registros (`/records`)** y **Visor (`/visor`)**, ocultando Ingesta/Plantillas (`/ingest`) y Gestión de Equipo (`/settings/users`). (Los roles `admin`, `archivist` y `superadmin` también tienen acceso completo a `/evaluacion`).
2. **Colas de Trabajo en `/evaluacion`:** Ambas colas organizadas en pestañas: **`Por Verificar`** (folios/partidas en estado `completed` por el digitador) y **`Dudosos / Ilegibles`** (en estado `revision`).
3. **Modos de Operación en `/evaluacion`:** Ambos modos: una **Cola Continua de Evaluación** (pasa automáticamente al siguiente folio al emitir veredicto) y una **Lista de Selección** filtrable por Serie y Tomo/Libro.
4. **Edición Directa ("Corregir y Verificar"):** El Evaluador puede corregir directamente cualquier campo del formulario en pantalla y pulsar **`✔ Aprobar y Verificar`** en un solo paso, o devolverlo al digitador si requiere rehacerse.
5. **Notas de Revisión / Motivo de Rechazo (`review_notes`):** Al devolver o marcar en revisión un folio/partida, el Evaluador puede escribir una nota explicativa que el digitador verá como alerta destacada arriba del formulario cuando retome ese folio en `/visor`.

### Ronda 2: Veredictos, Atajos de Teclado, Multi-Partida, Exportación DIP y Trazabilidad
6. **Tres Botones de Veredicto Claros:**
   - **`✔ Aprobar y Verificar`** (`verified`)
   - **`↩ Devolver a Cola de Digitación`** (`pending` + nota de observación)
   - **`⚠ Escalar / Mantener en Dudoso`** (`revision` + nota de observación)
7. **Ergonomía, Atajos y Herramientas Visuales:** Soporte de `Ctrl + Enter` para *"Aprobar / Verificar y Avanzar"*, `Alt + R` para *"Devolver con observación"*, más Lupa Interactiva (`[L]`), zoom/pan/rotación y filtros de legibilidad idénticos al Visor Dual.
8. **Evaluación Multi-Partida:** Evaluar partida por partida mediante pestañas (`[Partida 1]`, `[Partida 2]`, ...) con un botón rápido adicional **`✔ Verificar Todas las Partidas del Folio`** cuando todas estén correctas.
9. **Relación con Exportación DIP FamilySearch:** Permitir exportar `"Completadas + Verificadas"` por defecto, añadiendo en `ExportFamilySearchModal.tsx` un switch opcional: **`"Exportar exclusivamente actas Verificadas por Evaluador (100% auditadas)"`** (`only_verified=true`).
10. **Trazabilidad Completa de Operadores:** Mostrar y registrar quién transcribió el acta y qué Evaluador la verificó junto con la fecha/hora (`verified_at`, `verified_by`).

### Ronda 3: Gestión de Equipo, Redirección Login, Bloqueo Concurrente, Active Learning y Prioridad en Cola
11. **Integración en Gestión de Equipo (`/settings/users`):** Incluir el rol **`Evaluador de Calidad (evaluator)`** tanto al invitar nuevos miembros como al cambiar el rol de un miembro existente.
12. **Redirección Automática post-Login:** Cuando un usuario con rol `evaluator` inicia sesión en `/login`, redirigirlo directamente a **`/[subdomain]/evaluacion`**.
13. **Bloqueo Concurrente de 15 Minutos:** Bloquear durante 15 minutos el folio que un Evaluador está revisando actualmente en la Cola Continua para evitar que dos Evaluadores califiquen la misma página simultáneamente.
14. **Aprendizaje Activo (*Gold Standard* en `training_data`):** Cuando el Evaluador modifique/corrija un campo durante la verificación, registrar esa corrección en `training_data` (`action_type = "evaluator_verified_correction"`) para entrenar el modelo de IA/HTR de la organización.
15. **Prioridad y Banner en el Visor (`/visor`):** Los folios devueltos por el Evaluador (`pending` con `review_notes`) se priorizan al principio de la cola de digitación (`get_next_folio`) y muestran en `/visor` un banner amarillo/ámbar destacado con la observación exacta del Evaluador.
