# PLAN-019: Manual Interactivo del Software, Centro de Ayuda y Guía Operativa por Roles

## 1. Resumen Ejecutivo y Objetivos Técnicos

El propósito de la especificación **SPEC-019** es dotar a **CodexFlow** de un **Manual Interactivo del Software, Centro de Ayuda y Base de Conocimiento Operativa** de nivel empresarial. Este manual resuelve la necesidad de capacitar y guiar a voluntarios, transcriptores paleógrafos, archivistas de curia, evaluadores de calidad y administradores diocesanos, así como documentar los flujos técnicos para clientes institucionales e inspectores de preservación histórica.

### Objetivos Clave:
1. **Acceso Dual Isomórfico:**
   - **Ruta Pública (`/manual`):** Para capacitación abierta, auditores externos, prospectos y consulta sin sesión.
   - **Ruta Autenticada (`/[subdomain]/manual`):** Accesible desde la barra lateral (`Sidebar.tsx`) para todos los roles con botón de retorno al flujo de trabajo activo.
2. **Estructura Estática Resiliente 100% Offline:**
   - Almacenamiento íntegro de la documentación en TypeScript (`frontend/src/data/manualContent.ts`), sin dependencias de red ni latencias de base de datos (< 100ms de carga inicial).
3. **Ergonomía de Consulta y Filtrado Reactivo:**
   - Barra de búsqueda instantánea (< 1ms) con filtrado en tiempo real sobre títulos, atajos y contenidos.
   - Selector rápido de rol (Todos, Administrador, Archivista, Digitador, Evaluador).
   - Tabla de referencia rápida (*Cheat Sheet*) con etiquetas semánticas `<kbd>` y agrupamiento ergonómico.
4. **Exportación e Impresión Profesional a PDF:**
   - Reglas CSS `@media print` dedicadas para generar dossieres impresos limpios, en fondo blanco, sin barras de navegación ni ruido visual.

---

## 2. Decisiones de Arquitectura y Diseño

### Decisión 1: Módulo de Contenido Centralizado en TypeScript (`manualContent.ts`)
- **Justificación:** Se descarta el consumo de CMS externo o markdown remoto en runtime para garantizar consistencia absoluta, validación de tipos en tiempo de compilación y tolerancia total a fallos de conectividad (los digitadores en parroquias rurales operan frecuentemente en red local o modo offline).
- **Estructura:** Contrato fuertemente tipado con interfaces para capítulos, secciones, atajos de teclado, cajas de advertencia/llamada archivística y tablas comparativas.

### Decisión 2: Componente Principal Reutilizable (`ManualView.tsx`)
- **Justificación:** Ambas rutas (`/manual` y `/[subdomain]/manual`) comparten la misma lógica de visualización, búsqueda reactiva, tabla de atajos y scroll espía.
- **Parametrización:**
  - `isEmbedded?: boolean`: Indica si se renderiza dentro del layout interno de tenant o en la landing page.
  - `subdomain?: string`: Proporcionado cuando se ejecuta dentro del tenant para estructurar el enlace de *"Volver a mi Consola"*.
  - `userRole?: string`: Permite auto-seleccionar o destacar el rol del usuario conectado.

### Decisión 3: Navegación por Anclas y Scroll Espía (TOC Sticky)
- **Justificación:** La lectura de manuales técnicos requiere orientación constante. Una barra lateral adhesiva (`sticky`) con lista de capítulos y secciones permite saltos instantáneos con scroll suave (`scroll-smooth`) y destacados visuales mediante `IntersectionObserver`.

### Decisión 4: Modificación del Guardián de Rutas (`SubdomainGuard`)
- **Problema Detectado:** En `frontend/src/app/[subdomain]/layout.tsx`, el `SubdomainGuard` restringe a los digitadores a solo `/visor` y `/metrics`. Sin ajuste, un digitador navegando a `/[subdomain]/manual` sería redirigido involuntariamente a `/visor`.
- **Solución:** Extender la lista de rutas permitidas para `role === "digitizer"` añadiendo `pathname.startsWith(`/${subdomain}/manual`)`.

### Decisión 5: Adaptación de la Barra Lateral (`Sidebar.tsx`)
- **Integración:** Se añade el elemento de navegación *"Manual & Ayuda"* con icono `BookOpen` para todos los roles (digitador, evaluador, archivista y administrador), respetando el estado colapsado/expandido de la barra lateral.

### Decisión 6: Motor CSS `@media print`
- **Estrategia:** Ocultar elementos interactivos (`header`, `footer`, `nav`, `aside`, botones de búsqueda y selección de roles) durante la impresión (`display: none !important`), ajustar contraste a negro/escala de grises, resetear márgenes a estándar de página (A4/Carta) y forzar `page-break-inside: avoid` en secciones y tablas de atajos.

---

## 3. Especificación de Datos y Tipos (`frontend/src/data/manualContent.ts`)

### 3.1. Interfaces TypeScript
```typescript
export type TargetRole = 'all' | 'admin' | 'archivist' | 'digitizer' | 'evaluator';

export interface ShortcutItem {
  id: string;
  keys: string[];
  description: string;
  context: 'global' | 'digitizer' | 'evaluator' | 'archivist';
  note?: string;
}

export interface CalloutBox {
  type: 'tip' | 'warning' | 'note' | 'archival';
  title: string;
  content: string;
}

export interface ContentStep {
  stepNumber: number;
  title: string;
  description: string;
  details?: string[];
}

export interface ContentTable {
  headers: string[];
  rows: string[][];
  caption?: string;
}

export interface ManualSection {
  id: string;
  title: string;
  description: string;
  targetRole: TargetRole;
  steps?: ContentStep[];
  callouts?: CalloutBox[];
  table?: ContentTable;
  shortcuts?: ShortcutItem[];
  subsections?: Array<{
    id: string;
    title: string;
    content: string;
  }>;
}

export interface ManualChapter {
  id: string;
  chapterNumber: number;
  title: string;
  subtitle: string;
  iconName: string; // Nombre representativo de Lucide
  targetRole: TargetRole;
  sections: ManualSection[];
}
```

### 3.2. Contenido de los 7 Capítulos Canónicos
1. **Capítulo 1: Introducción & Arquitectura de CodexFlow**
   - Misión y soberanía archivística.
   - Arquitectura Multi-Tenant con aislamiento estricto vía PostgreSQL RLS y subdominios.
   - Ciclo de vida documental: Ingesta DCam ➔ Foliación ➔ Transcripción Ergonómica ➔ Arbitraje de Calidad ➔ Exportación FamilySearch (DIP).
2. **Capítulo 2: Guía del Administrador Diocesano**
   - Configuración inicial de la Diócesis / Organización.
   - Gestión de usuarios y asignación de roles RBAC (`admin`, `archivist`, `evaluator`, `digitizer`).
   - Envío y monitoreo de invitaciones por correo electrónico.
   - Políticas de seguridad, expiración de tokens y auditoría.
3. **Capítulo 3: Guía del Archivista (DCam & Ingesta)**
   - Estructura jerárquica de archivo: Fondo ➔ Sección ➔ Serie ➔ Libro/Tomo.
   - Estandarización de tomas fotográficas bajo norma DCam (resolución, balance de blancos, escala métrica).
   - Carga masiva de facsímiles (JPEG, TIFF, PDF) e indexación de metadatos del tomo.
   - Resolución de folios conflictivos en la **Bandeja de Dudosos** y foliación física tridimensional (`r` / `v`).
4. **Capítulo 4: Guía del Digitador (Visor Paleográfico Ergonómico)**
   - Operación 100% mediante teclado y eliminación de dependencia del ratón.
   - Navegación y alternancia de folios: Recto a Vuelto con guardado automático (`Ctrl + Enter`).
   - Gestión de múltiples partidas por folio (`Alt + N`).
   - Lupa óptica interactiva (`L`), zoom de alta precisión y rotación.
   - Tratamiento de irregularidades: `<Ilegible>` (`Ctrl + U`), `<En Blanco>` (`Ctrl + B`), duplicación de valores (`Ctrl + D`).
   - Modos offline, cola de sincronización IndexedDB y mitigación de pérdida de red.
5. **Capítulo 5: Guía del Evaluador (Mesa de Calidad y Arbitraje)**
   - Filosofía de control de calidad eclesiástico: Cero tolerancia a alucinaciones.
   - Interfaz de doble cotejo: Facsímil original vs transcripción paleográfica.
   - Panel retráctil superior y atajos de veredicto:
     - `Ctrl + Enter`: Aprobar y certificar registro (*Gold Standard*).
     - `Alt + R`: Rechazar y devolver al digitador con nota prioritaria obligatoria.
     - Escalar a Archivista (duda paleográfica de fondo o tomo físico comprometido).
   - Monitoreo de concordancia y bucle de reentrenamiento de IA (Active Learning).
6. **Capítulo 6: Explorador de Registros & Motor de Exportación FamilySearch (DIP)**
   - Búsqueda avanzada y filtros en cascada (Diócesis > Parroquia > Serie > Tomo > Rango de Años).
   - Auditoría previa a la exportación (`pre-export-summary`): Detección de partidas incompletas o sin certificar.
   - Generación del paquete DIP (Dissemination Information Package):
     - Matriz consolidada en Microsoft Excel estilizada y tipada.
     - Exportación CSV plano con codificación UTF-8 BOM para compatibilidad universal.
     - Archivo de genealogía GEDCOM 5.5.1 homologado para FamilySearch.
     - Manifiesto de integridad técnica (`manifest.json`) con checksums SHA-256.
7. **Capítulo 7: Resolución de Problemas y Casos Límite (Troubleshooting)**
   - Partidas sacramentales sin fecha o con fechas aproximadas ("hacia 1780").
   - Actas continuadas que inician en un folio y terminan en el siguiente.
   - Textos marginales, enmiendas, testados y notas de legitimación/confirmación.
   - Caídas de conexión a internet: Verificación del indicador de estado y resguardo de datos en caché.
   - Recuperación de borradores locales y resolución de conflictos de concurrencia.

### 3.3. Cheat Sheet de Atajos de Teclado
- Tabla global y categorizada por rol con las teclas representadas en `<kbd> className="px-2 py-1 bg-slate-800 text-slate-200 border border-slate-700 rounded shadow-sm font-mono text-xs"`:
  - `Ctrl + Enter`: Guardar partida / Aprobar y certificar registro.
  - `Alt + N`: Crear nueva partida en el mismo folio.
  - `Alt + R`: Rechazar y solicitar corrección con nota prioritaria.
  - `Ctrl + U`: Marcar campo actual como `<Ilegible>`.
  - `Ctrl + B`: Marcar folio actual como `<En Blanco>`.
  - `Ctrl + D`: Duplicar valor del campo desde el registro anterior.
  - `L`: Activar / desactivar lupa virtual flotante.
  - `Alt + A`: Activar / desactivar capa de cajas delimitadoras (Bounding Boxes de IA).
  - `Alt + F`: Abrir panel de filtros fotográficos (contraste, inversión, binarización).
  - `F11`: Alternar modo de pantalla completa para máxima inmersión.

---

## 4. Arquitectura de Componentes (`frontend/src/components/manual/`)

```
frontend/src/components/manual/
├── ManualView.tsx              # Componente orquestador principal
├── ManualHeader.tsx            # Cabecera con título, buscador reactivo, filtro de rol y botón de impresión
├── ManualSidebar.tsx           # Tabla de contenido lateral con scroll espía y badges de rol
├── ManualCheatSheet.tsx        # Sección destacada de atajos rápidos con <kbd>
├── ManualChapterSection.tsx    # Renderizador de capítulos, pasos numerados y tablas
├── ManualCallout.tsx           # Bloques de advertencia, notas archivísticas y recomendaciones
└── manual.print.css            # Estilos de impresión profesionales (o embebidos en tailwind @media print)
```

### 4.1. `ManualView.tsx`
- **Estado Local:**
  - `searchQuery: string`: Texto de búsqueda en vivo.
  - `selectedRole: TargetRole`: Rol filtrado ('all' por defecto).
  - `activeSectionId: string`: ID de la sección visible detectada por `IntersectionObserver`.
  - `expandedChapters: Record<string, boolean>`: Estado de apertura de acordeones si aplica.
- **Lógica de Filtrado Reactivo:**
  - Filtra capítulos y secciones si coinciden con `selectedRole` (o `selectedRole === 'all'`).
  - Filtra por coincidencia de subcadenas (case-insensitive) en `title`, `description`, `shortcuts` y `content`.
  - Si hay búsqueda activa, expande automáticamente todas las secciones coincidentes y resalta la cantidad de resultados encontrados.
- **Acciones:**
  - `handlePrint()`: Dispara `window.print()`.
  - `handleRoleSelect(role)`: Cambia el filtro de rol activo.
  - `handleClearSearch()`: Restablece el buscador.

---

## 5. Integración de Rutas y Menús

### 5.1. Ruta Pública: `frontend/src/app/manual/page.tsx`
- Envuelta con `StickyHeader` y `Footer` de la Landing Page.
- Renderiza `<ManualView isEmbedded={false} />`.
- Botón superior derecho: *"Iniciar Sesión / Ir a la Plataforma"* (`/login`).
- Metadatos Next.js para SEO e indexación institucional.

### 5.2. Ruta Autenticada: `frontend/src/app/[subdomain]/manual/page.tsx`
- Envuelta por `SubdomainLayout` (`frontend/src/app/[subdomain]/layout.tsx`).
- Lee el contexto de `useTenant()` (rol actual y subdominio).
- Renderiza `<ManualView isEmbedded={true} subdomain={subdomain} userRole={role} />`.
- Botón de retorno inteligente: *"Volver a mi Consola"* que redirige a la ruta principal del rol (`/visor` para digitador, `/evaluacion` para evaluador, `/dashboard` para archivista/admin).

### 5.3. Actualizaciones de Enlaces:
- **`Sidebar.tsx`**:
  - Para `isDigitizer`: Agregar `{ href: '/[subdomain]/manual', label: 'Manual & Ayuda', icon: BookOpen }`.
  - Para `isEvaluator`: Agregar `{ href: '/[subdomain]/manual', label: 'Manual & Ayuda', icon: BookOpen }`.
  - Para `admin/archivist`: Agregar `{ href: '/[subdomain]/manual', label: 'Manual & Ayuda', icon: BookOpen }`.
- **`StickyHeader.tsx`**:
  - Agregar enlace visible `'Manual & Ayuda'` apuntando a `/manual` en la navegación de escritorio y móvil.
- **`Footer.tsx`**:
  - En la sección "Plataforma" o "Recursos", agregar el enlace `'Manual del Usuario'` hacia `/manual`.
- **`frontend/src/app/[subdomain]/layout.tsx` (`SubdomainGuard`)**:
  - Permitir `pathname.startsWith('/${subdomain}/manual')` para `role === "digitizer"`.

---

## 6. Estilos de Impresión y Generación de PDF (`@media print`)

Reglas CSS específicas aplicadas mediante clases de Tailwind `print:` y bloque `<style jsx>`:
1. `print:hidden`: Ocultar `header`, `footer`, `aside`, `nav`, la barra de búsqueda, botones de retorno y filtros de roles.
2. Contenedor principal: `print:max-w-none print:w-full print:p-0 print:m-0 print:bg-white print:text-black`.
3. Títulos y encabezados: `print:text-slate-900 print:border-b print:border-slate-300 print:break-after-avoid`.
4. Tarjetas y tablas: `print:shadow-none print:border print:border-slate-300 print:break-inside-avoid`.
5. Atajos de teclado: `print:bg-slate-100 print:text-slate-900 print:border-slate-400`.
6. Saltos de página: Cada capítulo principal contiene `print:break-before-page` para iniciar en página nueva al imprimir.

---

## 7. Plan de Validación y Verificación

1. **Validación de Tipos TypeScript:**
   - Ejecución de chequeo de tipos sobre `manualContent.ts` y componentes sin errores.
2. **Prueba de Filtrado y Búsqueda:**
   - Búsqueda de términos clave como "lupa", "DIP", "GEDCOM", "Active Learning", "dudosos" verificando filtrado inmediato.
   - Cambio de roles (Digitador, Evaluador, etc.) verificando adaptación visual de los capítulos.
3. **Prueba de Rutas:**
   - Carga de `/manual` como usuario anónimo con cabecera y pie de página de landing page.
   - Carga de `/[subdomain]/manual` como digitador, evaluador y admin sin redirecciones de `SubdomainGuard`.
4. **Prueba de Impresión:**
   - Simulación de impresión para validar la ausencia de controles interactivos y la correcta foliación visual.
5. **Compilación de Producción:**
   - Verificación de compilación de Next.js (`npm run build`) con código de salida 0.
