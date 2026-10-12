# Lista de Tareas: Mejora de Imagen y Lupa Interactiva (Spec 006)

**Identificador:** `006-image-enhancement-magnifier`  
**Fase SDD:** Paso 5 - Tareas de Implementación  
**Fecha:** 2026-10-12  

---

## Tareas de Implementación

### Fase 1: Estado Base y Lógica de Filtros (Frontend Hook)

- [x] **T01-FILTERS-STATE:** Crear hook modular `useImageViewerFilters.ts` en `frontend/src/hooks/` definiendo los estados de `ImageFilterState` (brillo, contraste, nitidez, inversión, escala de grises, binarizado) y `MagnifierState` (activo, zoom, coordenadas, visibilidad).
- [x] **T02-CSS-GENERATOR:** Implementar la función de utilidad `buildCSSFilterString` para concatenar dinámicamente las directivas CSS `filter` con soporte para aceleración por hardware en GPU.
- [x] **T03-SHORTCUTS-HANDLER:** Implementar escucha de eventos de teclado en `useImageViewerFilters` para los atajos `L` (activar/desactivar lupa) e `I` (invertir colores), protegiendo la ejecución con validación `!isInputActive()`.
- [x] **T04-LIFECYCLE-RESET:** Implementar función `resetFilters()` y lógica de desconexión automática de lupa al cambiar el folio activo, preservando el estado de los filtros entre folios.

---

### Fase 2: Componentes Visuales Modulares

- [x] **T05-MAGNIFIER-COMPONENT:** Crear componente `frontend/src/components/viewer/MagnifierLens.tsx` con diámetro de 180px, retícula central translúcida, sombra perimetral óptica y recorte circular (`rounded-full overflow-hidden`).
- [x] **T06-MAGNIFIER-MATH:** Implementar en `MagnifierLens` el cálculo trigonométrico y matricial de posición del puntero y compensación de rotaciones angulares (0°, 90°, 180°, 270°) sobre la imagen interna clonada.
- [x] **T07-WHEEL-ZOOM:** Configurar captura del evento `wheel` sobre el área de la lupa para ajustar el aumento dinámico entre 1.5x y 5.0x (pasos de 0.25x), bloqueando el scroll de la ventana con `e.preventDefault()`.
- [x] **T08-FILTER-POPOVER:** Crear componente `frontend/src/components/viewer/FilterControlsPopover.tsx` con icono de controles (`Sliders`/`Wand2`), sliders de brillo (50%-200%), contraste (50%-250%), nitidez (0-100) y toggles para Invertir ('I'), Grayscale y Modo Binarizado.

---

### Fase 3: Integración en Visor de Transcripción

- [x] **T09-VISOR-TOOLBAR:** Integrar botón de Lupa y botón de Filtros (`FilterControlsPopover`) en la barra flotante de herramientas de `frontend/src/app/[subdomain]/visor/page.tsx` (o `DocumentViewer.tsx`).
- [x] **T10-VISOR-RENDER-SYNC:** Conectar el `buildCSSFilterString` a la imagen principal del visor y acoplar el componente `MagnifierLens` superpuesto en el lienzo con sincronización de filtros.
- [x] **T11-VISOR-RESET-ACTION:** Vincular la acción del botón global "Restablecer" del visor para reiniciar posición, zoom general, apagar la lupa y restaurar filtros a sus valores predeterminados.

---

### Fase 4: Integración en Modal de Registros

- [x] **T12-RECORDS-MODAL:** Incorporar `useImageViewerFilters`, la barra de control compacta de filtros y la lupa interactiva en el modal de detalle e inspección de registros en `frontend/src/app/[subdomain]/records/page.tsx`.
- [x] **T13-MODAL-CLEANUP:** Asegurar que al cerrar o cambiar de registro en el modal, el estado de la lupa se libere adecuadamente sin fugas de memoria en listeners globales.

---

### Fase 5: Validación, Rendimiento y Casos Límite

- [x] **T14-GPU-PERF-AUDIT:** Verificar que la animación del cursor de la lupa opere a 60 FPS sin repaints excesivos del DOM mediante el uso de `transform: translate3d` y aceleración GPU.
- [x] **T15-EDGE-CASES-QA:** Validar casos límite:
  - Movimiento del cursor sobre los bordes y salida del lienzo (ocultamiento suave).
  - Comportamiento de la lupa con imágenes rotadas a 90° y 270°.
  - Persistencia de filtros al cambiar folios consecutivos.
  - No colisión de los atajos 'L' e 'I' al escribir en campos de texto de transcripción.
