# Lista Secuencial de Tareas de Implementación
## Módulo: Autoguardado Local y Recuperación Offline (010-local-autosave-offline-recovery)

### Fase 1: Estructuras de Datos y Utilidades de Almacenamiento
- [x] 1.1 Definir las interfaces de TypeScript `ViewerState`, `LocalDraft<T>` y `AutosaveStatus` en el módulo de tipos compartidos.
- [x] 1.2 Implementar la utilidad de generación y parseo de claves de aislamiento `buildDraftStorageKey(tenantId, folioId)`.
- [x] 1.3 Implementar la función de purga automática de borradores huérfanos con TTL de 7 días (`purgeExpiredDrafts(ttlDays = 7)`).
- [x] 1.4 Implementar el deserializador seguro de `localStorage` con captura de excepciones ante JSON corrupto y eliminación silenciosa.
- [x] 1.5 Implementar manejador de excepciones para `QuotaExceededError` con desalojo preventivo de borradores obsoletos.

---

### Fase 2: Hook React Centralizado `useLocalAutosave`
- [x] 2.1 Crear el hook `useLocalAutosave.ts` recibiendo `tenantId`, `folioId`, `formData`, `viewerState` y callbacks de sincronización.
- [x] 2.2 Configurar el mecanismo de debounce de 500 ms tras mutaciones en los inputs del formulario o transformaciones del visor.
- [x] 2.3 Implementar la lógica de montaje y restauración inicial que prioriza los datos locales sobre la respuesta del servidor si existe un borrador válido.
- [x] 2.4 Incorporar la detección de conectividad en tiempo real suscribiendo listeners a eventos de red `online` y `offline` (`navigator.onLine`).
- [x] 2.5 Implementar la suscripción al evento `window.addEventListener('beforeunload')` para prevenir salidas accidentales cuando existan datos pendientes de guardar.
- [x] 2.6 Exponer las funciones `clearDraft()`, `discardDraft()`, el estado `hasLocalDraft`, `isOnline` y el timestamp `lastSavedAt`.

---

### Fase 3: Componentes de Interfaz de Usuario y Feedback Visual
- [x] 3.1 Crear el componente `AutosaveBadge.tsx` con ícono de check verde animado y texto "Guardado local".
- [x] 3.2 Crear el componente `OfflineBanner.tsx` fijado en la parte superior del layout con el mensaje: *"Sin conexión: Tu trabajo se sigue guardando localmente; podrás sincronizar cuando vuelva internet"*.
- [x] 3.3 Integrar notificación flotante tipo Toast de 4 segundos que se active al restaurar un borrador: *"Se restauró un borrador no guardado de tu sesión anterior"*.
- [x] 3.4 Diseñar e implementar el modal de confirmación `DiscardDraftModal.tsx` para solicitar confirmación antes de descartar el borrador local.
- [x] 3.5 Añadir el botón visible "Descartar borrador" en la barra de herramientas secundarias del formulario.

---

### Fase 4: Integración con Visor, Atajos de Teclado y Flujo de Servidor
- [x] 4.1 Integrar `useLocalAutosave` con el componente del visor para persistir y restaurar coordenadas `panX`, `panY`, `zoom` y `rotation`.
- [x] 4.2 Configurar el atajo global de teclado `Alt + D` para abrir el diálogo de confirmación de descarte de borrador.
- [x] 4.3 Conectar el borrado automático de borrador local (`clearDraft()`) al ejecutar con éxito la acción de guardar folio (`Ctrl + Enter`).
- [x] 4.4 Conectar el borrado automático de borrador local (`clearDraft()`) al marcar exitosamente el folio como dudoso (`Ctrl + Espacio`).
- [x] 4.5 Verificar que la navegación entre diferentes folios y cambios de diócesis (`tenantId`) respeten el aislamiento total sin contaminación cruzada.

---

### Fase 5: Pruebas y Validación Técnica
- [x] 5.1 Escribir pruebas unitarias para `useLocalAutosave` validando el debounce de 500 ms y la no saturación de escrituras.
- [x] 5.2 Escribir pruebas unitarias simulando desconexión de red (`navigator.onLine = false`, evento `offline`) y verificando el banner superior.
- [x] 5.3 Escribir pruebas de resiliencia ante `localStorage` corrupto (cadenas truncadas o no válidas) asegurando que no se rompe la aplicación.
- [x] 5.4 Escribir pruebas para la purga de TTL verificando que entradas mayores a 7 días son eliminadas al inicio.
- [x] 5.5 Validar pruebas e2e/componente para el atajo `Alt + D` y la limpieza tras guardar con `Ctrl + Enter`.
