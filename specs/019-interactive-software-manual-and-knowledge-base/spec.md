# SPEC-019: Manual Interactivo del Software, Centro de Ayuda y Guía Operativa por Roles

## 1. Contexto y Justificación
CodexFlow cuenta con una arquitectura archivística y tecnológica de alta precisión:
- Multi-tenancy con RLS y segregación diocesana.
- Gestión de tomos y carpetas bajo la norma DCam con jerarquía territorial (`canonical_place`).
- Foliación física archivística tridimensional (`F.14r`, `F.14v`, actas continuadas y multi-partida).
- Visor dual con ergonomía extrema, lupa óptica interactiva `[L]`, filtros fotográficos y atajos globales de teclado.
- Asistencia de IA con Bounding Boxes SVG y bucle de Active Learning.
- Mesa de Evaluación y Arbitraje de Calidad con panel retráctil, tres veredictos (`Ctrl + Enter`, `Alt + R` prioritaria y escalamiento al Archivista) y *Gold Standard*.
- Motor de exportación DIP homologado para FamilySearch (Excel estilizado, CSV UTF-8 BOM, GEDCOM 5.5.1 y `manifest.json`).

Para facilitar el entrenamiento de voluntarios, operadores, archivistas eclesiásticos y evaluadores de curia, y a la vez brindar transparencia técnica a clientes institucionales y prospectos, se requiere un **Manual Interactivo del Software (Centro de Ayuda / Knowledge Base)** accesible tanto de forma pública (`/manual`) como dentro de la aplicación (`/[subdomain]/manual`), con búsqueda instantánea en vivo, tabla de atajos imprimible (*Cheat Sheet*), soporte offline y capacidad de impresión/exportación a PDF profesional.

---

## 2. Requerimientos Funcionales (RF)

### RF-1: Ubicación Dual y Navegación
- **Ruta Pública:** `/manual` accesible sin autenticación desde el menú superior fijo (`StickyHeader`) y el pie de página (`Footer`) de la Landing Page.
- **Ruta Autenticada:** `/[subdomain]/manual` integrada en la barra lateral (`Sidebar.tsx`) con icono `BookOpen`, visible y accesible para todos los roles (`superadmin`, `admin`, `archivist`, `evaluator`, `digitizer`), con botón directo de *"Volver al Trabajo / a mi Consola"*.

### RF-2: Estructura por Roles y Capítulos Temáticos
El manual debe organizarse en 7 capítulos exhaustivos y prácticos:
1. **Introducción y Arquitectura:** Visión general, soberanía de datos, multi-tenancy y flujo de producción.
2. **Guía del Administrador:** Creación de organización, gestión de equipo, invitaciones por correo y seguridad RBAC.
3. **Guía del Archivista (DCam & Ingesta):** Creación del árbol de archivo (Diócesis > Parroquia > Serie > Tomo), carga de facsímiles (JPEG/PDF), gestión de plantillas y resolución de folios en la Bandeja de Dudosos.
4. **Guía del Digitador (Visor Paleográfico):** Transcripción intensiva con teclado, uso de la lupa `[L]`, alternancia automática Recto/Vuelto (`Ctrl+Enter`), gestión multi-partida (`Alt+N`), atajos `<Ilegible>` (`Ctrl+U`), `<En Blanco>` (`Ctrl+B`) y autoguardado offline.
5. **Guía del Evaluador de Calidad (Mesa de Arbitraje):** Consola dual de cotejo, panel superior retráctil, veredictos de calidad (`Ctrl+Enter`, `Alt+R` motivada con notas prioritarias, escalamiento a dudoso) y retroalimentación de Active Learning.
6. **Explorador de Registros & Exportación FamilySearch (DIP):** Filtros en cascada por Tomo, auditoría previa (`pre-export-summary`), descarga del paquete ZIP con matriz Excel, CSV con BOM, árbol GEDCOM 5.5.1 y switch `only_verified`.
7. **Resolución de Problemas y Casos Límite (Troubleshooting):** Partidas sin fecha o fecha parcial, partidas que saltan de folio, textos mutilados, pérdida de internet (modo local reactivo) y recuperación de borradores.

### RF-3: Tarjeta de Referencia Rápida de Atajos de Teclado (Cheat Sheet)
- Sección visual destacada con todas las combinaciones de teclas en etiquetas semánticas `<kbd>`:
  - `Ctrl + Enter`: Guardar partida / Aprobar y certificar en evaluación.
  - `Alt + N`: Nueva partida en el mismo folio.
  - `Alt + R`: Devolver folio al digitador con nota de corrección.
  - `Ctrl + U`: Marcar campo como `<Ilegible>`.
  - `Ctrl + B`: Marcar folio como `<En Blanco>`.
  - `Ctrl + D`: Duplicar valor del registro anterior.
  - `L`: Activar / Desactivar lupa óptica virtual.
  - `Alt + A`: Activar / Desactivar capa vectorial de IA.
  - `Alt + F`: Abrir panel de filtros fotográficos.

### RF-4: Búsqueda Instantánea en Vivo (Quick Search)
- Barra de búsqueda reactiva en la cabecera del manual que filtre títulos, contenidos, atajos y palabras clave en tiempo real (< 1ms) destacando las coincidencias.

### RF-5: Exportación e Impresión Profesional a PDF
- Botón `[🖨️ Imprimir / Guardar como PDF]` que ejecute `window.print()` con estilos CSS `@media print` optimizados:
  - Oculta menús de navegación, barras laterales, botones y fondos oscuros.
  - Aplica tipografía negra de alta legibilidad sobre fondo blanco puro con saltos de página limpios para formato A4 o Carta.

### RF-6: Resiliencia Offline
- Todos los contenidos residirán en un módulo estructurado de TypeScript en cliente (`manualData.ts`), garantizando carga instantánea y operatividad 100% offline sin peticiones externas al servidor.

---

## 3. Criterios de Aceptación
1. La ruta `/manual` y `/[subdomain]/manual` cargan en menos de 100ms.
2. El buscador filtra instantáneamente y permite limpiar la consulta.
3. El botón de impresión genera una vista previa de PDF impecable sin artefactos de interfaz.
4. El enlace en `Sidebar.tsx` redirige a la consola interna de manual sin perder la sesión del usuario.
5. El build de Next.js pasa con código 0 y cero errores de TypeScript.
