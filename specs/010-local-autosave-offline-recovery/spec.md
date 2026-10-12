# Especificación de Requisitos de Software (SRS)
## Módulo: Autoguardado Local y Recuperación Offline (010-local-autosave-offline-recovery)

### 1. Resumen Ejecutivo y Alcance
El módulo de Autoguardado Local y Recuperación Offline provee a CodexFlow de resiliencia frente a pérdidas inesperadas de conectividad a internet, cierres accidentales de ventana o caídas de sesión. Permite persistir de forma continua en `localStorage` los datos transcritos del formulario (`formData`), campos modificados y el estado visual del visor (zoom, desplazamiento pan X/Y y rotación). Asimismo, detecta el estado de la conexión en tiempo real, restaura borradores previos advirtiendo al usuario, provee opciones para descartar borradores y limpia el almacenamiento local tras operaciones de guardado o marcado como dudoso.

---

### 2. Glosario de Términos
- **Borrador Local (Draft):** Snapshot serializado en formato JSON almacenado en `localStorage` con los datos del formulario, campos modificados, viewport del visor y metadatos temporales.
- **Folio:** Documento registral eclesiástico específico que está siendo transcrito/indexado.
- **Tenant ID:** Identificador único de la diócesis o parroquia para garantizar multitenencia estricta.
- **TTL (Time-To-Live):** Tiempo de vida útil de un borrador local antes de ser purgado (7 días).
- **Debounce:** Patrón de espera de 500 ms tras el último cambio de entrada antes de escribir en disco/storage.
- **EARS:** Easy Approach to Requirements Syntax.

---

### 3. Requisitos Funcionales en Sintaxis EARS

#### 3.1 Requisitos Ubicuos (Ubiquitous Requirements)
- **REQ-UBI-001:** El sistema **deberá** aislar los borradores locales en `localStorage` utilizando la clave compuesta con formato exacto `'codexflow_draft_[tenant_id]_[folio_id]'`.
- **REQ-UBI-002:** El sistema **deberá** purgar de forma automática al inicializar cualquier borrador local cuyo timestamp supere el periodo TTL de 7 días naturales.
- **REQ-UBI-003:** El sistema **deberá** mantener la integridad de la multitenencia impidiendo que un usuario acceda a borradores pertenecientes a otro `tenant_id`.

#### 3.2 Requisitos Basados en Eventos (Event-driven Requirements)
- **REQ-EVT-001 (Autoguardado reactivo):** **CUANDO** el usuario modifique cualquier campo del formulario o altere el estado del visor (zoom, pan x/y, rotación), el sistema **deberá** almacenar el snapshot actualizado en `localStorage` tras un periodo de inactividad (debounce) de 500 milisegundos.
- **REQ-EVT-002 (Carga y Restauración):** **CUANDO** se inicialice o monte la vista del folio, **SI** existe un borrador local válido y no expirado para `[tenant_id]_[folio_id]`, el sistema **deberá** restaurar automáticamente dicho estado priorizando los cambios locales sobre los valores provenientes del servidor.
- **REQ-EVT-003 (Feedback de Restauración):** **CUANDO** se complete la restauración de un borrador local, el sistema **deberá** mostrar una notificación flotante (toast) informativa durante exactamente 4 segundos con el mensaje: *"Se restauró un borrador no guardado de tu sesión anterior"*.
- **REQ-EVT-004 (Limpieza tras Guardado Exitoso):** **CUANDO** el usuario ejecute un guardado exitoso en el backend (vía botón o atajo `Ctrl + Enter`), el sistema **deberá** eliminar de inmediato el borrador local correspondiente.
- **REQ-EVT-005 (Limpieza tras Marcar como Dudoso):** **CUANDO** el usuario marque el folio como dudoso exitosamente (vía botón o atajo `Ctrl + Espacio`), el sistema **deberá** eliminar de inmediato el borrador local correspondiente.
- **REQ-EVT-006 (Descarte de Borrador):** **CUANDO** el usuario presione el botón "Descartar borrador" o accione el atajo de teclado `Alt + D`, el sistema **deberá** solicitar confirmación explícita mediante un diálogo modal y, al ser confirmado, eliminar el borrador de `localStorage` y revertir el formulario al estado original del servidor.
- **REQ-EVT-007 (Transición Offline):** **CUANDO** el navegador dispare el evento `offline` o la propiedad `navigator.onLine` sea `false`, el sistema **deberá** desplegar un banner superior fijo de alta visibilidad.
- **REQ-EVT-008 (Transición Online):** **CUANDO** el navegador dispare el evento `online` o la conectividad sea reestablecida, el sistema **deberá** retirar el banner de alerta offline y mostrar un indicador temporal de conectividad reestablecida.

#### 3.3 Requisitos Basados en Estados (State-driven Requirements)
- **REQ-STA-001 (Feedback Visual de Guardado Local):** **MIENTRAS** existan cambios persistidos localmente no sincronizados con el servidor, el sistema **deberá** mostrar en la esquina superior derecha del editor un badge sutil con la leyenda "Guardado local" acompañado de un ícono de check verde animado.
- **REQ-STA-002 (Banner de Estado Offline):** **MIENTRAS** el navegador se encuentre en estado offline (`navigator.onLine === false`), el sistema **deberá** mantener visible el banner superior con el texto: *"Sin conexión: Tu trabajo se sigue guardando localmente; podrás sincronizar cuando vuelva internet"*.
- **REQ-STA-003 (Protección de Salida Accidental):** **MIENTRAS** existan modificaciones locales pendientes de guardar en el servidor, el sistema **deberá** interceptar el evento `beforeunload` del navegador y la navegación interna para advertir al usuario sobre la existencia de cambios no sincronizados.

#### 3.4 Requisitos de Comportamiento No Deseado / Resiliencia (Unwanted Behaviour Requirements)
- **REQ-ERR-001 (Corrupción de Almacenamiento):** **SI** el contenido recuperado de `localStorage` para una clave de borrador contiene un JSON inválido o corrupto, el sistema **deberá** eliminar silenciosamente la entrada corrupta, registrar una advertencia en la consola de depuración y continuar con la carga limpia de los datos del servidor sin interrumpir la experiencia de usuario.
- **REQ-ERR-002 (Cuota de LocalStorage Excedida):** **SI** la operación de escritura en `localStorage` genera una excepción `QuotaExceededError`, el sistema **deberá** forzar la purga inmediata de todos los borradores locales huérfanos o más antiguos y reintentar el almacenamiento.

---

### 4. Criterios de Aceptación
1. Toda modificación de input o movimiento del visor debe reflejarse en `localStorage` 500 ms después de cesar la interacción.
2. Al recargar la página (`F5`), el formulario y visor conservan exactamente el estado previo a la recarga y muestran el toast de 4s.
3. Desconectar la red en DevTools activa de forma inmediata el banner offline superior sin bloquear la edición.
4. Al confirmar `Alt + D`, el borrador es purgado y el formulario vuelve al estado del backend.
5. Guardar exitosamente (`Ctrl + Enter`) remueve la entrada en `localStorage`.
