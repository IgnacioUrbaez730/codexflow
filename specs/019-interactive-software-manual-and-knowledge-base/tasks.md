# TASKS-019: Manual Interactivo del Software, Centro de Ayuda y Guía Operativa por Roles

## Matriz de Tareas de Implementación

---

### Fase 1: Módulo de Datos Tipado y Estructurado (Offline-First)

- [x] **T01: Definición del Modelo de Tipos e Interfaces TypeScript**
  - **Archivo:** `frontend/src/data/manualContent.ts`
  - **Dependencias:** Ninguna
  - **Descripción:** Definir los contratos e interfaces TypeScript para la base de conocimiento:
    - Tipos: `TargetRole` ('all' | 'admin' | 'archivist' | 'digitizer' | 'evaluator').
    - Interfaces: `ShortcutItem`, `CalloutBox`, `ContentStep`, `ContentTable`, `ManualSection`, `ManualChapter`.
  - **Criterios de Aceptación:**
    - Cero errores de tipos en compilación.
    - Soporte completo para steps, callouts, tablas, atajos y subsecciones.

- [x] **T02: Redacción Estructurada de los Capítulos 1 al 4**
  - **Archivo:** `frontend/src/data/manualContent.ts`
  - **Dependencias:** T01
  - **Descripción:** Redactar en español formal y archivístico los primeros 4 capítulos completos:
    1. *Capítulo 1: Introducción y Arquitectura de CodexFlow* (Misión, multi-tenancy, RLS diocesano, flujo DCam a FamilySearch).
    2. *Capítulo 2: Guía del Administrador* (Creación de organización, RBAC, invitaciones por correo y seguridad).
    3. *Capítulo 3: Guía del Archivista (DCam & Ingesta)* (Estructura de fondos, carga de imágenes, bandeja de dudosos y foliación física `r`/`v`).
    4. *Capítulo 4: Guía del Digitador (Visor Paleográfico Ergonómico)* (Uso de teclado, atajos, lupa `[L]`, alternancia Recto/Vuelto, `<Ilegible>` `Ctrl+U`, `<En Blanco>` `Ctrl+B`, y resiliencia offline).
  - **Criterios de Aceptación:**
    - Textos completos sin marcadores de posición ("TODO" o "lorem ipsum").
    - Pasos numerados claros y terminología técnica exacta de CodexFlow.

- [x] **T03: Redacción Estructurada de los Capítulos 5 al 7 y Cheat Sheet de Atajos**
  - **Archivo:** `frontend/src/data/manualContent.ts`
  - **Dependencias:** T02
  - **Descripción:** Redactar los capítulos restantes y la colección global de atajos de teclado:
    5. *Capítulo 5: Guía del Evaluador de Calidad (Mesa de Arbitraje)* (Doble cotejo, veredictos `Ctrl+Enter`, rechazo `Alt+R` con notas prioritarias, reentrenamiento IA).
    6. *Capítulo 6: Explorador de Registros & Exportación FamilySearch (DIP)* (Filtros en cascada, auditoría `pre-export-summary`, descarga ZIP con Excel, CSV UTF-8 BOM, GEDCOM 5.5.1 y `manifest.json`).
    7. *Capítulo 7: Resolución de Problemas y Casos Límite (Troubleshooting)* (Fechas aproximadas, partidas continuadas entre folios, roturas de texto, fallas de red y sincronización local).
    - Colección de atajos de referencia rápida para `<kbd>` (Global, Digitador, Evaluador, Archivista).
  - **Criterios de Aceptación:**
    - Los 7 capítulos cuentan con IDs semánticos únicos (`id` para anclas URL `#capitulo-X`).
    - Todos los atajos reflejan exactamente la configuración funcional del sistema.

---

### Fase 2: Componentes de Interfaz de Usuario (`frontend/src/components/manual/`)

- [x] **T04: Componente de Cabecera y Controles Reactivos (`ManualHeader.tsx`)**
  - **Archivo:** `frontend/src/components/manual/ManualHeader.tsx`
  - **Dependencias:** T01
  - **Descripción:** Construir la cabecera interactiva del manual:
    - Buscador reactivo en vivo con input, icono de búsqueda y botón para limpiar (`Clear`).
    - Selector horizontal de roles (*Pills*: Todos, Administrador, Archivista, Digitador, Evaluador) con recuento de coincidencias.
    - Botón de acción: `[🖨️ Imprimir / Guardar PDF]` ejecutando `window.print()`.
    - Botón de navegación contextual: *"Volver a mi Consola"* (si `isEmbedded`) o *"Iniciar Sesión"* (si público).
  - **Criterios de Aceptación:**
    - Filtra en vivo conforme se teclea sin retardos perceptibles (< 1ms).
    - Los botones y controles responden a accesibilidad y estados de foco.

- [x] **T05: Barra Lateral de Navegación con Scroll Espía (`ManualSidebar.tsx`)**
  - **Archivo:** `frontend/src/components/manual/ManualSidebar.tsx`
  - **Dependencias:** T01
  - **Descripción:** Crear el índice adhesivo (*Sticky TOC*) del manual:
    - Lista de los 7 capítulos con sus iconos representativos.
    - Despliegue de secciones y anclas con enlace directo `#id`.
    - Detección de la sección activa en pantalla para resaltado visual.
    - Ocultamiento automático durante la impresión (`print:hidden`).
  - **Criterios de Aceptación:**
    - El scroll hacia un ancla es suave (`scroll-smooth`).
    - Resalta la sección actual en tiempo real durante el desplazamiento de la página.

- [x] **T06: Componentes de Contenido, Cajas de Alerta y Atajos**
  - **Archivos:**
    - `frontend/src/components/manual/ManualCallout.tsx`
    - `frontend/src/components/manual/ManualCheatSheet.tsx`
    - `frontend/src/components/manual/ManualChapterSection.tsx`
  - **Dependencias:** T01, T03
  - **Descripción:** Desarrollar los bloques visuales para la lectura técnica:
    - `ManualCallout`: Cajas de alerta con estilos e iconos diferenciados según el tipo (`note`, `warning`, `tip`, `archival`).
    - `ManualCheatSheet`: Tarjeta destacada con las teclas formateadas en etiquetas `<kbd>` semánticas y estilizadas con Tailwind.
    - `ManualChapterSection`: Renderizado de títulos de capítulos, números de paso destacados, listas de verificación y tablas de datos.
  - **Criterios de Aceptación:**
    - Diseño moderno inspirado en Stripe / GitHub Docs con alto contraste y tipografía nítida.
    - Formato responsivo para dispositivos móviles y pantallas panorámicas.

- [x] **T07: Componente Orquestador Principal (`ManualView.tsx`)**
  - **Archivo:** `frontend/src/components/manual/ManualView.tsx`
  - **Dependencias:** T04, T05, T06
  - **Descripción:** Ensamblar el componente completo:
    - Estado compartido: `searchQuery`, `selectedRole`, `activeSectionId`.
    - Filtrado reactivo de capítulos y secciones según rol y búsqueda textual.
    - Mensaje amigable cuando la búsqueda no arroje resultados, con sugerencia para restablecer filtros.
    - Integración de estilos de impresión dedicados.
  - **Criterios de Aceptación:**
    - Reutilizable tanto en ruta pública como autenticada mediante props.
    - Renderizado instantáneo (< 100ms) sin saltos visuales (*layout shifts*).

---

### Fase 3: Rutas Next.js y Puntos de Entrada

- [x] **T08: Creación de la Ruta Pública (`/manual`)**
  - **Archivo:** `frontend/src/app/manual/page.tsx`
  - **Dependencias:** T07
  - **Descripción:** Crear la página pública del manual:
    - Envolver con `StickyHeader` y `Footer` de la Landing Page.
    - Renderizar `<ManualView isEmbedded={false} />`.
    - Metadatos Next.js (`title: 'Manual de Usuario & Centro de Ayuda — CodexFlow'`).
  - **Criterios de Aceptación:**
    - Accesible sin requerir sesión iniciada.
    - El botón de inicio de sesión redirige a `/login`.

- [x] **T09: Creación de la Ruta Autenticada (`/[subdomain]/manual`)**
  - **Archivo:** `frontend/src/app/[subdomain]/manual/page.tsx`
  - **Dependencias:** T07
  - **Descripción:** Crear la página del manual interna para organizaciones:
    - Leer `subdomain` desde `useParams()` y `role` desde `useTenant()`.
    - Renderizar `<ManualView isEmbedded={true} subdomain={subdomain} userRole={role} />`.
    - El botón *"Volver a mi Consola"* redirige a la consola del usuario según su rol (`/visor`, `/evaluacion`, `/dashboard`).
  - **Criterios de Aceptación:**
    - Se integra armoniosamente dentro del `SubdomainLayout`.
    - Preserva la sesión y el tenant activo.

- [x] **T10: Actualización del Guardián de Rutas (`SubdomainGuard`)**
  - **Archivo:** `frontend/src/app/[subdomain]/layout.tsx`
  - **Dependencias:** T09
  - **Descripción:** Habilitar el acceso al manual para el rol `digitizer`:
    - En la condición `if (role === "digitizer")`, añadir `pathname.startsWith(`/${subdomain}/manual`)` a la lista `isAllowed`.
  - **Criterios de Aceptación:**
    - Los usuarios con rol `digitizer` pueden acceder a `/[subdomain]/manual` sin ser redirigidos a `/visor`.

- [x] **T11: Integración del Enlace en la Barra Lateral (`Sidebar.tsx`)**
  - **Archivo:** `frontend/src/components/Sidebar.tsx`
  - **Dependencias:** T09
  - **Descripción:** Añadir el elemento de navegación *"Manual & Ayuda"* con icono `BookOpen`:
    - Incluir en los enlaces de digitador (`isDigitizer`).
    - Incluir en los enlaces de evaluador (`isEvaluator`).
    - Incluir en los enlaces de administradores y archivistas.
  - **Criterios de Aceptación:**
    - El elemento es visible en todos los roles con su estado activo resaltado al estar en `/manual`.
    - Funciona correctamente tanto en la barra expandida como colapsada.

- [x] **T12: Enlaces en la Landing Page (`StickyHeader.tsx` y `Footer.tsx`)**
  - **Archivos:**
    - `frontend/src/components/landing/StickyHeader.tsx`
    - `frontend/src/components/landing/Footer.tsx`
  - **Dependencias:** T08
  - **Descripción:** Integrar accesos directos al manual público:
    - En `StickyHeader.tsx`, agregar *"Manual"* en el menú de navegación principal y en el drawer móvil.
    - En `Footer.tsx`, agregar *"Manual del Software"* en la columna de recursos/plataforma.
  - **Criterios de Aceptación:**
    - Clics navegan limpiamente hacia `/manual`.

---

### Fase 4: Optimización de Impresión y Verificación

- [x] **T13: Optimización y Pruebas del Motor de Impresión CSS (`@media print`)**
  - **Archivos:** `frontend/src/components/manual/ManualView.tsx` y `frontend/src/app/globals.css`
  - **Dependencias:** T07, T08, T09
  - **Descripción:** Validar y ajustar las reglas de impresión:
    - Ocultar cabeceras, barras laterales, inputs y footers (`print:hidden`).
    - Evitar cortes de página a mitad de tablas y tarjetas (`page-break-inside: avoid`).
    - Asegurar fondo blanco y texto de alto contraste para impresión física o PDF.
  - **Criterios de Aceptación:**
    - Al presionar `[🖨️ Imprimir / Guardar PDF]`, el diálogo nativo de impresión muestra un documento limpio y profesional.

- [x] **T14: Verificación Integral de Compilación y Calidad de Código**
  - **Archivo:** Entorno de compilación `frontend/`
  - **Dependencias:** T01 a T13
  - **Descripción:** Ejecutar validación de tipos y build de producción:
    - Compilación con `npm run build` en el directorio `frontend/`.
    - Validación de cero errores de TypeScript y cero advertencias de Next.js.
  - **Criterios de Aceptación:**
    - Build exitoso con código 0.
