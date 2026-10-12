# Tareas de Implementación: 009 - Indexación Asistida por Inteligencia Artificial (AI-Assisted Indexing)

## Fase 1: Esquema de Datos y Persistencia de Aprendizaje Activo

- [x] **Tarea 1.1**: Crear migración de base de datos para la tabla `ai_predictions` con campos normalizados (`bbox_x`, `bbox_y`, `bbox_width`, `bbox_height`, `confidence`, `field_key`).
- [x] **Tarea 1.2**: Crear migración de base de datos para la tabla `training_data` con tracking de discrepancias y tipos de acción (`accepted_exact`, `corrected_text`, `rejected_blank`, `manual_inserted`).
- [x] **Tarea 1.3**: Configurar índices y políticas RLS (Row Level Security) en Supabase/PostgreSQL para lectura de predicciones y registro asíncrono de feedback de aprendizaje activo.
- [x] **Tarea 1.4**: Crear interfaces y tipos de TypeScript correspondientes en el módulo de indexación (`AIPrediction`, `BoundingBoxNormalized`, `FormFieldAIState`, `TrainingDataPayload`).

---

## Fase 2: Gestión de Estado y Lógica de Prellenado Inteligente

- [x] **Tarea 2.1**: Implementar `aiIndexingStore` (Zustand) para almacenar predicciones activas, estado de la capa (visible/oculta), caja activa y mapa de sugerencias originales.
- [x] **Tarea 2.2**: Desarrollar la función de inicialización de formulario con regla condicional de umbral de confianza (`confidence >= 0.80`) y validador sintáctico (fechas ISO).
- [x] **Tarea 2.3**: Asegurar que campos con `confidence < 0.80` o formatos inválidos permanezcan vacíos sin generar advertencias intrusivas.
- [x] **Tarea 2.4**: Implementar el componente visual `AIAssistedInput` que renderiza la insignia verde `IA: X%`, el borde contextual sutil y maneja la transición a estado "editado por el usuario" al escribir.

---

## Fase 3: Capa Vectorial de Bounding Boxes y Transformaciones Espaciales

- [x] **Tarea 3.1**: Implementar la función de transformación geométrica matricial en `useAIBoundingBoxes.ts` soportando rotaciones de 0°, 90°, 180° y 270°.
- [x] **Tarea 3.2**: Crear el componente `AIOverlayLayer.tsx` (capa SVG sobre el visor) con eventos de puntero desacoplados (`pointer-events: none` en contenedor y `auto` en rectángulos).
- [x] **Tarea 3.3**: Diseñar y estilizar `AIBoundingBoxItem.tsx` con recuadros semitransparentes en azul/verde y estado activo en amarillo resplandeciente (`#F59E0B`).
- [x] **Tarea 3.4**: Implementar el controlador de evento `onClick` en `AIBoundingBoxItem` para transferir de manera inmediata el texto detectado al campo de formulario enfocado.
- [x] **Tarea 3.5**: Integrar la proyección y sincronización de las bounding boxes dentro de la Lupa Óptica (Spec 006) sin desfases de coordenadas.

---

## Fase 4: Auto-Enfoque, Ergonomía Visual y Atajos de Teclado

- [x] **Tarea 4.1**: Implementar el hook `useAICameraNavigation.ts` que escucha los cambios de foco (`onFocus`) en los campos del formulario.
- [x] **Tarea 4.2**: Aplicar la regla de ergonomía visual: si `zoom <= 2.5x`, ejecutar desplazamiento y centrado suave hacia la caja delimitadora; si `zoom > 2.5x`, solo resaltar la caja en amarillo sin mover la cámara.
- [x] **Tarea 4.3**: Implementar el atajo de teclado `Alt + A` para alternar la visibilidad de la capa completa de IA (On/Off) con latencia menor a 50ms.
- [x] **Tarea 4.4**: Implementar el atajo de teclado `Alt + C` para forzar el recentrado de la cámara sobre la caja del campo activo independientemente del nivel de zoom.
- [x] **Tarea 4.5**: Implementar resiliencia y modo degradado: verificar y probar que ante folios sin predicciones o con errores de OCR el visor funcione en modo manual sin errores de consola ni retrasos.

---

## Fase 5: Pipeline de Active Learning y Dashboard de Métricas

- [x] **Tarea 5.1**: Implementar el comparador de discrepancias en el evento de guardado con `Ctrl + Enter` para generar el lote de eventos hacia `training_data`.
- [x] **Tarea 5.2**: Crear el cliente de despacho asíncrono no bloqueante para asegurar que el guardado del folio prosiga sin demoras de red.
- [x] **Tarea 5.3**: Desarrollar el endpoint/servicio de consulta de métricas de precisión agregada, tasa de corrección y calibración de confianza.
- [x] **Tarea 5.4**: Construir la vista de interfaz `AIDashboardMetrics.tsx` accesible para roles Administrador y Archivista con gráficos de tasa de aceptación y desglose por campo.

---

## Fase 6: Pruebas de Integración y Validación de Calidad

- [x] **Tarea 6.1**: Pruebas unitarias para las transformaciones matemáticas de rotación (90°, 180°, 270°) y escalado de bounding boxes.
- [x] **Tarea 6.2**: Pruebas unitarias de la regla de corte de confianza (80%) y validación de fechas vacías ante sintaxis defectuosa.
- [ ] **Tarea 6.3**: Pruebas de integración E2E del flujo completo: navegación con `Tab`, clic para insertar, guardado silencioso en `training_data`.
- [ ] **Tarea 6.4**: Pruebas de estrés y rendimiento en el visor con ráfagas de teclado y zoom simultáneos.
