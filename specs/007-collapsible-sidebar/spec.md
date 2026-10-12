# Especificación Funcional: Barra Lateral Colapsable y Métricas de Digitador (Spec 007)

**Identificador:** `007-collapsible-sidebar`  
**Estado:** Aprobado  
**Fecha:** 2026-10-12  
**Autor:** Agente Planificador SDD  
**Ciclo SDD:** Pasos 2, 4 y 5  

---

## 1. Propósito y Alcance

### 1.1 Propósito
Optimizar el espacio visual de trabajo y la ergonomía del usuario en la plataforma CodexFlow mediante una barra lateral de navegación colapsable (Collapsible Sidebar) que maximice el área útil para la transcripción e inspección de documentos eclesiásticos. Asimismo, integrar al rol de **Digitador (Indexador)** en el sistema unificado de navegación y dotarlo de una vista dedicada de **Mis Métricas** para auditar en tiempo real su productividad individual (folios completados hoy, en la semana y total histórico) con fines de control de calidad y pago por producción.

### 1.2 Alcance
- **Barra Lateral Colapsable (Desktop & Tablet):**
  - Dos modos de visualización: Expandida (256px / `w-64`) y Plegada (64px / `w-16`).
  - Conmutador visual (Toggle) en la cabecera mediante íconos interactivos `PanelLeftClose` y `PanelLeftOpen`.
  - Atajo de teclado global: `Ctrl + B` para alternar el plegado/desplegado, inmune a la escritura en campos de formulario (`input`, `textarea`, `select`, `contenteditable`).
  - Modo Plegado:
    - Logotipo completo "CodexFlow" contraído al isotipo compacto "CF".
    - Enlaces de navegación con íconos centrados y Tooltips flotantes contextuales anclados a la derecha (fondo oscuro, tipografía clara).
    - Estado activo preservado con indicador `bg-blue-600`.
    - Botón de "Cerrar Sesión" transformado en icono `LogOut` centrado con tooltip de acento sutil rojo.
  - Transición fluida con animación CSS `transition-all duration-300 ease-in-out` sincronizada entre el sidebar y el contenedor principal (`ml-64` a `ml-16`).
  - Persistencia de preferencia de usuario en `localStorage` (`codexflow_sidebar_collapsed`) protegida contra desincronización de hidratación (hydration mismatch / flickering en SSR Next.js).
- **Adaptabilidad Móvil (< 768px):**
  - Ocultamiento fuera del viewport (`-translate-x-full`) y despliegue como Drawer emergente con overlay/backdrop oscuro y botón de cierre táctil.
- **Inclusión y Permisos del Rol Digitador:**
  - Habilitación del Sidebar para el rol `digitizer` en `[subdomain]/layout.tsx` y `Sidebar.tsx`.
  - Rutas autorizadas para el Digitador:
    - "Visor de Indexación" (`/[subdomain]/visor`).
    - "Mis Métricas" (`/[subdomain]/metrics`): Vista de productividad individual.
    - "Cerrar Sesión".
  - Bloqueo y protección de rutas administrativas o de ingesta (`dashboard`, `ingest`, `records`, `settings`).
- **Endpoint Backend de Métricas de Digitador:**
  - `GET /api/v1/digitizer/metrics`: Servicio autenticado con JWT y contexto multi-tenant que extrae folios completados hoy, en los últimos 7 días y total histórico verificado para el `user_id` en sesión.

---

## 2. Actores y Roles

| Actor | Descripción |
|---|---|
| **Digitador / Indexador (`digitizer`)** | Usuario operativo encargado de indexar y transcribir partidas históricas. Requiere máxima superficie de pantalla en el Visor y acceso directo a sus métricas de producción personal. |
| **Administrador de Parroquia (`admin`)** | Gestiona usuarios, supervisa lotes de ingesta y consulta registros. Utiliza la barra colapsable para alternar entre gestión y revisión de documentos. |
| **Archivista (`archivist`)** | Valida calidad en catálogo y revisa expedientes históricos. |
| **Super Administrador (`superadmin`)** | Control global de la plataforma multi-tenant. |
| **Sistema Frontend (Next.js 14)** | Gestiona el estado de colapso, persistencia local y sincronización visual del layout sin parpadeos. |
| **Sistema Backend (FastAPI + Supabase)** | Agrega y despacha las métricas de folios por usuario y tenant de forma segura y aislada. |

---

## 3. Requerimientos Funcionales (EARS)

### 3.1 Conmutación y Estados de la Barra Lateral

- **REQ-SD-01 (Ubiquitous):** La barra lateral DEBERÁ soportar dos estados estructurales en dispositivos desktop (≥ 768px):
  - **Expandida:** ancho de 256px (`w-64`).
  - **Plegada:** ancho de 64px (`w-16`).
- **REQ-SD-02 (Event-driven):** CUANDO el usuario haga clic en el botón conmutador de la cabecera del Sidebar:
  - SI la barra está expandida, el sistema DEBERÁ colapsarla a 64px y cambiar el ícono a `PanelLeftOpen`.
  - SI la barra está plegada, el sistema DEBERÁ expandirla a 256px y cambiar el ícono a `PanelLeftClose`.
- **REQ-SD-03 (Event-driven):** CUANDO el usuario presione la combinación de teclas `Ctrl + B` (o `Cmd + B` en macOS) Y el foco del cursor NO se encuentre en un elemento editable (`input`, `textarea`, `select` o `contenteditable`), el sistema DEBERÁ conmutar el estado del Sidebar e interceptar el comportamiento nativo del navegador con `e.preventDefault()`.
- **REQ-SD-04 (Unwanted behavior):** SI el usuario presiona `Ctrl + B` mientras escribe dentro de un campo de entrada de texto (por ejemplo, transcribiendo nombres en el Visor), el sistema NO DEBERÁ conmutar la barra lateral.
- **REQ-SD-05 (State-driven):** MIENTRAS la barra cambie entre los estados expandido y plegado, el sistema DEBERÁ animar simultáneamente el ancho del sidebar y el margen izquierdo del área de contenido principal (`ml-64` / `ml-16`) utilizando la clase CSS `transition-all duration-300 ease-in-out`.

### 3.2 Representación Visual en Modo Plegado

- **REQ-SD-06 (State-driven):** MIENTRAS la barra lateral se encuentre en modo plegado (64px):
  - El título de la marca "CodexFlow" DEBERÁ reemplazarse por el isotipo abreviado "CF" centrado horizontalmente.
  - Cada elemento del menú DEBERÁ mostrar exclusivamente su ícono representativo alineado al centro del botón.
  - Al posicionar el cursor (`hover`) o mantener el foco de teclado sobre cualquier enlace, el sistema DEBERÁ desplegar un Tooltip flotante emergente a la derecha con fondo oscuro (`bg-gray-800`), borde sutil, sombra (`shadow-lg`), texto en blanco (`text-white text-xs py-1 px-2.5 rounded-md`) y flecha indicadora o z-index elevado (`z-50`).
  - El enlace correspondiente a la ruta actual (`pathname`) DEBERÁ mantener visible su fondo destacado en azul (`bg-blue-600 text-white rounded-lg`).
  - El botón de cierre de sesión DEBERÁ mostrarse únicamente como el ícono `LogOut` centrado, con un Tooltip flotante derecho "Cerrar Sesión" resaltado con tono rojizo o acento sutil (`hover:bg-red-900/40 text-red-400`).

### 3.3 Persistencia y Prevención de Hydration Mismatch

- **REQ-SD-07 (Event-driven):** CUANDO el usuario alterne el estado del Sidebar, el sistema DEBERÁ guardar inmediatamente la preferencia en `localStorage` bajo la clave `'codexflow_sidebar_collapsed'` (`'true'` o `'false'`).
- **REQ-SD-08 (Ubiquitous):** El estado del Sidebar DEBERÁ administrarse a través de un proveedor React (`SidebarProvider` y `SidebarContext`) que prevenga discrepancias de hidratación (hydration mismatch) y flashes visuales durante el primer renderizado en Next.js.
- **REQ-SD-09 (Event-driven):** Al montarse la aplicación en el cliente, el `SidebarProvider` DEBERÁ sincronizar el estado reactivo con el valor persistido en `localStorage` antes de pintar transiciones erráticas.

### 3.4 Comportamiento Móvil (< 768px)

- **REQ-SD-10 (State-driven):** EN pantallas con resolución inferior a 768px (móviles):
  - La barra lateral DEBERÁ ocultarse fuera del lienzo mediante `-translate-x-full`.
  - La barra principal de la aplicación DEBERÁ proporcionar un botón disparador (menú hamburguesa) para desplegar el Sidebar como un Drawer superpuesto (`fixed inset-y-0 left-0 z-50 w-64`).
  - Al abrirse el Drawer, el sistema DEBERÁ renderizar una capa de fondo traslúcida (backdrop overlay `fixed inset-0 bg-black/50 z-40`).
- **REQ-SD-11 (Event-driven):** CUANDO el usuario pulse el overlay exterior o seleccione un enlace de navegación en móvil, el sistema DEBERÁ cerrar automáticamente el Drawer.

### 3.5 Navegación y Permisos del Rol Digitador

- **REQ-NAV-01 (Ubiquitous):** En `frontend/src/app/[subdomain]/layout.tsx`, el usuario con rol `digitizer` DEBERÁ tener acceso al componente `Sidebar` unificado (eliminando el bloqueo que ocultaba la barra a los digitadores).
- **REQ-NAV-02 (State-driven):** MIENTRAS el rol del usuario autenticado sea `digitizer`, el Sidebar DEBERÁ presentar únicamente las siguientes opciones de menú:
  1. **Visor de Indexación:** Enlace a `/[subdomain]/visor` (Ícono: `FileSearch` / `ScanText`).
  2. **Mis Métricas:** Enlace a `/[subdomain]/metrics` (Ícono: `BarChart3` / `TrendingUp`).
  3. **Cerrar Sesión:** Acción de logout en la parte inferior.
- **REQ-NAV-03 (Unwanted behavior):** SI un usuario con rol `digitizer` intenta navegar de forma manual a rutas restringidas (`/[subdomain]/dashboard`, `/[subdomain]/ingest`, `/[subdomain]/records`, `/[subdomain]/settings`), el sistema DEBERÁ redirigirlo de inmediato a `/[subdomain]/visor`.
- **REQ-NAV-04 (State-driven):** MIENTRAS el usuario posea roles administrativos (`admin`, `archivist`, `superadmin`), el Sidebar DEBERÁ mostrar sus opciones correspondientes (Dashboard, Ingesta, Visor, Registros, Equipo), omitiendo la opción individual "Mis Métricas" a menos que se configure como panel global.

### 3.6 Endpoint y Vista de Métricas Personales del Digitador

- **REQ-MET-01 (Ubiquitous):** El backend de FastAPI DEBERÁ exponer el endpoint HTTP:
  - **Método:** `GET`
  - **Ruta:** `/api/v1/digitizer/metrics`
  - **Encabezados:** `Authorization: Bearer <token>`
- **REQ-MET-02 (Ubiquitous):** El endpoint `/api/v1/digitizer/metrics` DEBERÁ verificar el contexto de autenticación (`user_id`, `tenant_id`, `role`) y filtrar estrictamente los folios que pertenezcan a dicho usuario en dicho tenant.
- **REQ-MET-03 (Ubiquitous):** La respuesta JSON del endpoint DEBERÁ tener la siguiente estructura:
  ```json
  {
    "user_id": "uuid-del-digitador",
    "tenant_id": "uuid-del-tenant",
    "full_name": "Nombre del Digitador",
    "folios_today": 24,
    "folios_last_7_days": 142,
    "folios_total_verified": 980,
    "last_activity_at": "2026-10-12T14:30:00Z"
  }
  ```
- **REQ-MET-04 (Ubiquitous):** La vista frontend `frontend/src/app/[subdomain]/metrics/page.tsx` DEBERÁ:
  - Consumir el endpoint `/api/v1/digitizer/metrics`.
  - Mostrar tarjetas KPI interactivas:
    1. **Producción de Hoy:** Folios transcritos hoy.
    2. **Últimos 7 Días:** Folios procesados en la semana actual.
    3. **Total Histórico Verificado:** Folios completados y validados.
  - Ofrecer una tabla o listado de folios procesados recientemente por el digitador con estado de verificación y marca temporal.
  - Incluir estados visuales de carga (Skeleton) y manejo de estados vacíos.

---

## 4. Requerimientos No Funcionales

- **RND-PERF-01 (Sin Layout Jitter):** Las transiciones de colapso deben ser aceleradas por GPU sin provocar saltos bruscos de contenido ni redibujado lento de visores interactivos de documentos.
- **RND-ACC-01 (Accesibilidad WAI-ARIA):** Todos los botones colapsables deben contener `aria-expanded="true|false"` y `aria-label="Colapsar barra lateral"` / `"Expandir barra lateral"`. Los tooltips deben ser amigables para lectores de pantalla.
- **RND-SEC-01 (Aislamiento Multi-Tenant Estricto):** El cálculo de métricas del digitador debe validar `tenant_id` y `user_id` desde el token verificado por Supabase, impidiendo que un usuario observe métricas de terceros.

---

## 5. Casos Límite y Manejo de Errores

| Caso Límite | Comportamiento Esperado |
|---|---|
| Digitador navegando a URL de métricas con sesión caducada | Se redirige automáticamente al flujo `/login` mediante el middleware/layout auth check. |
| Digitador sin registros procesados aún | El endpoint retorna ceros (`folios_today: 0`, `folios_last_7_days: 0`, `folios_total_verified: 0`) y la vista renderiza un estado amigable de "Comienza tu jornada indexando folios". |
| Uso de `Ctrl + B` dentro de un modal o input de transcripción | El evento es ignorado por completo, permitiendo atajos de texto habituales sin alterar la interfaz. |
| `localStorage` bloqueado o en modo incógnito estricto | El componente captura la excepción `try/catch` y mantiene el estado en memoria durante la sesión activa. |
| Redimensionamiento dinámico de pantalla de Desktop a Móvil | El layout adapta la barra de fija a Drawer sin inconsistencias de estado. |

---

## 6. Criterios de Aceptación (Gherkin)

### Escenario 1: Alternar Sidebar con Botón y Atajo `Ctrl + B`
```gherkin
Given que el usuario se encuentra autenticado en cualquier vista del tenant
When hace clic en el botón conmutador de la cabecera del Sidebar o pulsa "Ctrl + B"
Then la barra lateral transiciona suavemente de 256px (w-64) a 64px (w-16) en 300ms
And el margen izquierdo del área principal se ajusta de ml-64 a ml-16
And el isotipo cambia de "CodexFlow" a "CF"
And el estado queda guardado en localStorage como "codexflow_sidebar_collapsed=true"
```

### Escenario 2: Tooltips flotantes en modo colapsado
```gherkin
Given que la barra lateral está en estado plegado (64px)
When el usuario pasa el puntero sobre el ícono de "Visor de Indexación"
Then aparece un Tooltip flotante oscuro a la derecha indicando "Visor de Indexación"
And el ícono de la ruta activa permanece resaltado con fondo azul "bg-blue-600"
```

### Escenario 3: Digitador accede a sus métricas individuales
```gherkin
Given que un usuario con rol "digitizer" inicia sesión en el tenant
When visualiza la barra lateral
Then observa las opciones "Visor de Indexación", "Mis Métricas" y "Cerrar Sesión"
When hace clic en "Mis Métricas"
Then el sistema carga "/[subdomain]/metrics" y muestra folios de hoy, 7 días y total histórico
And las métricas corresponden exclusivamente a su ID de usuario y tenant
```

### Escenario 4: Protección de rutas para el Digitador
```gherkin
Given que un usuario con rol "digitizer" intenta ingresar a "/[subdomain]/dashboard"
When la ruta es interceptada por el layout
Then el sistema lo redirige inmediatamente a "/[subdomain]/visor"
```
