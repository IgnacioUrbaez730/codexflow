# Spec 002 — Ingesta de Imágenes y Visor Dual

Estado: borrador

## Contexto y objetivo
Este módulo representa el núcleo operativo de la plataforma. Permite a los Administradores crear plantillas de captura dinámicas y subir lotes pesados de documentos (imágenes o PDFs). Estos archivos son procesados en segundo plano por un backend en Python (FastAPI) que genera pirámides de teselas (DZI) y las almacena en Cloudflare R2. Finalmente, los digitadores consumen estos folios a través de un "Visor Dual Ergonómico" altamente optimizado para atajos de teclado, permitiéndoles transcribir a máxima velocidad.

## Usuarios / Actores
- **Tenant Admin:** (Puede haber varios). Crea las plantillas de captura y puede subir archivos.
- **Archivista:** Solo tiene permisos para subir imágenes/PDFs y crear lotes. No puede editar plantillas ni configuración.
- **Digitador:** Solo transcribe. Visualiza la imagen, rellena el formulario y avanza al siguiente.
- **Backend (Worker Python):** Actor de sistema que procesa PDFs y genera DZI en segundo plano.

## Historias de usuario
- **HU-1.** Como Admin, quiero crear formularios dinámicos definiendo los campos que necesito para mis documentos (ej. Padrinos, Causa de muerte).
- **HU-2.** Como Archivista o Admin, quiero subir un archivo PDF o varias imágenes y asignarle un formulario ya creado.
- **HU-3.** Como Digitador, quiero ver la imagen a la izquierda con zoom profundo (DZI) y el formulario a la derecha, para transcribir sin ratón.
- **HU-4.** Como Digitador, quiero marcar un documento como "Para Revisión" si la letra es ilegible.

## Requisitos funcionales (en EARS)

### Ingesta y Formularios
- **RF-1:** CUANDO el Admin crea una plantilla, EL SISTEMA guarda la estructura en JSONB permitiendo tipos específicos (Texto, Fecha, Selección). EL SISTEMA debe proveer Plantillas Maestras sugeridas (Bautismo, Defunción, etc.). (El Archivista no tiene acceso a esto).
- **RF-2:** SI un Tenant "Gratuito" sube archivos (Admin o Archivista), EL SISTEMA solo permite un máximo de 20 imágenes sueltas (max 5MB c/u) y bloquea PDFs.
- **RF-3:** SI un Tenant "Premium" sube un archivo `.pdf`, EL SISTEMA permite un tamaño máximo de 50MB (para evitar colapsos de RAM en el MVP). 
- **RF-4:** EL SISTEMA debe subir los archivos pesados **directamente** desde el navegador del usuario hacia Cloudflare R2 usando URLs firmadas, sin pasar por el servidor de Vercel.
- **RF-5:** MIENTRAS FastAPI procesa los archivos, registra cada página como folio `pendiente`. Los folios se almacenan, pero solo se pueden indexar hasta alcanzar el límite del plan.

### Visor Dual Ergonómico y Bandeja de Dudosos
- **RF-6:** CUANDO el Digitador entra al visor, EL SISTEMA renderiza OpenSeadragon (DZI) a la izquierda y el formulario JSONB a la derecha.
- **RF-7:** SI el Digitador guarda (`Ctrl + Enter`), EL SISTEMA valida estrictamente los tipos de datos. SI hay un error (ej. texto en fecha), el guardado se bloquea y pide corrección. SI es válido, se guarda, se descuenta de la cuota diaria, se marca como `completado`, y carga el siguiente.
- **RF-8:** SI el Digitador marca un folio como dudoso (`Ctrl + Espacio`), EL SISTEMA descuenta este intento de la cuota diaria (por el esfuerzo de revisión), lo marca en estado `revision` y avanza al siguiente.
- **RF-9:** EL SISTEMA provee una "Bandeja de Dudosos". El Tenant Admin puede ver y corregir TODOS los folios dudosos de la ONG. El Archivista SOLAMENTE puede ver y corregir los folios dudosos pertenecientes a los lotes que él mismo haya subido. Guardar un folio desde esta bandeja NO consume un nuevo crédito de la cuota (es gratis, porque ya se descontó en el RF-8).

### Seguridad y Restricciones
- **RF-10:** EL SISTEMA debe bloquear (RLS) cualquier intento de un usuario de leer o escribir folios que no pertenezcan a su `tenant_id`.
- **RF-11:** EL SISTEMA debe obtener las imágenes DZI desde Cloudflare R2 utilizando URLs firmadas (Signed URLs) de corta duración para evitar el acceso público no autorizado.
- **RF-12:** EL SISTEMA debe registrar el `user_id` de quien sube un lote (`uploaded_by`) para asegurar por RLS que el Archivista quede aislado dentro de sus propios lotes en la Bandeja de Dudosos.

## Casos límite
- Subida de un PDF corrupto o protegido con contraseña (FastAPI debe capturar el error y marcar el lote como fallido).
- El digitador llega al último folio del lote (el visor debe redirigirlo a un panel de "Lote completado").

## Fuera de alcance
- Auto-llenado o sugerencias de Inteligencia Artificial (Esto se abordará en la Spec 003).
- OCR masivo de documentos impresos.

## Criterios de finalización
- El Admin puede definir un formulario y subir un archivo asignándole dicho formulario.
- El Worker genera las teselas DZI en R2.
- El Visor carga en < 1.2s y permite flujo de captura 100% con teclado.

## Enmienda Loop 1 - Hub de Ingesta y Cola Global Segura
- **Hub de Ingesta**: Mudar las rutas huérfanas `/upload` y `/templates` hacia `/[subdomain]/ingest/page.tsx`. Esta será una sola vista con 3 pestañas: "Subir Lote", "Dudosos", y "Plantillas".
- **Permisos de Ingesta**: Ocultar la pestaña "Plantillas" si el rol es 'archivist'.
- **Subida de Lotes**: Obligatorio seleccionar una plantilla antes de subir. Mostrar tabla de "Lotes Recientes" y evitar congelar la pantalla.
- **Bandeja de Dudosos**: Será una tabla simple dentro del Hub, con un botón "Corregir" que envía a `/[subdomain]/visor?folio_id=XXX`.
- **Cola Global del Visor**: La ruta `/[subdomain]/visor` sin parámetros servirá el modo automático (Cola Global). Backend entregará folios en orden FIFO (más antiguos primero).
- **Concurrencia (Bloqueo)**: Backend debe cambiar estado del folio a `in_progress` al entregarlo, con un timeout de 15 minutos (si no se guarda, revierte a `pending`).
- **Visor Vacío**: Si la cola se vacía, mostrar mensaje "¡Trabajo al día!" con botón al Dashboard.
- **Ergonomía**: Atajos `Ctrl + Enter` (Guardar) y `Ctrl + Espacio` (Duda) son globales. Se permite guardar con campos vacíos.
- **Seguridad Dudosos**: Si se accede por `?folio_id=XXX`, el backend y RLS deben validar estrictamente la propiedad del lote si es Archivista.

## Enmienda Loop 2 - Creador Visual de Plantillas y Formularios Dinámicos
- **Tipos de Campo:** Texto Corto, Texto Largo, Fecha y Dropdown (opciones separadas por comas). Límite de 40 campos. Atributo `is_required` por campo.
- **Estructura JSON:** El builder genera un array interno: `[{ id: "nombre_completo", label: "Nombre Completo", type: "text", required: true }]`. El ID se genera automático en snake_case.
- **UI del Constructor:** Pantalla dividida (Split Screen). Izquierda: Tarjetas de configuración con flechas para ordenar (Up/Down) y Papelera para borrar. Derecha: Live Preview de cómo se verá en el visor.
- **Plantillas Maestras:** Botones rápidos para precargar estructuras base (Bautismo, Defunción).
- **Protección de Datos:** Las plantillas en uso (relacionadas a lotes) no se pueden editar, solo duplicar.
- **Renderizado en Visor:** El visor lee la plantilla del lote y renderiza dinámicamente. `Ctrl+Enter` es el único atajo de guardado.
- **Progreso Parcial:** Marcar dudoso (`Ctrl+Espacio`) guarda el JSON parcial en la BD.
