# Lista de Tareas: Barra Lateral Colapsable y Métricas de Digitador (Spec 007)

**Identificador:** `007-collapsible-sidebar`  
**Fase SDD:** Paso 5 - Tareas de Implementación  
**Fecha:** 2026-10-12  

---

## Tareas de Implementación

### Fase 1: Infraestructura de Estado y Contexto del Sidebar (Frontend)

- [x] **T01-CONTEXT-SETUP:** Crear `frontend/src/context/SidebarContext.tsx` implementando `SidebarProvider` y hook `useSidebar` con estados `isCollapsed`, `isMobileOpen`, y métodos conmutadores.
- [x] **T02-STORAGE-PERSISTENCE:** Implementar lógica de persistencia segura en `localStorage` con la clave `'codexflow_sidebar_collapsed'`, evitando discrepancias de hidratación (*hydration mismatch*) durante la inicialización en Next.js.
- [x] **T03-KEYBOARD-SHORTCUT:** Implementar escucha global del atajo de teclado `Ctrl + B` (y `Cmd + B`), validando que el foco no se encuentre en elementos editables (`input`, `textarea`, `select`, `contenteditable`).

---

### Fase 2: Componentes Visuales del Sidebar Colapsable y Tooltips

- [x] **T04-SIDEBAR-HEADER:** Actualizar la cabecera del Sidebar para soportar transición entre logotipo completo "CodexFlow" e isotipo "CF", integrando el botón conmutador con íconos `PanelLeftClose` y `PanelLeftOpen` de Lucide.
- [x] **T05-SIDEBAR-ITEM-TOOLTIPS:** Crear componente modular `SidebarItem.tsx` con estilos condicionales: texto visible en modo expandido e ícono centrado con Tooltip flotante emergente a la derecha (`bg-gray-950 text-white shadow-xl z-50`) en modo colapsado.
- [x] **T06-LOGOUT-COLLAPSE:** Adaptar `LogoutButton.tsx` para mostrarse como botón con texto completo en modo expandido y como ícono centrado `LogOut` con tooltip contextual rojo en modo colapsado.
- [x] **T07-ROLE-NAV-ITEMS:** Configurar en `Sidebar.tsx` la segmentación de rutas por rol:
  - Digitador (`digitizer`): "Visor de Indexación" (`/visor`) y "Mis Métricas" (`/metrics`).
  - Roles administrativos (`admin`, `archivist`, `superadmin`): "Dashboard", "Ingesta/Dudosos", "Visor de Indexación", "Registros" y "Equipo".

---

### Fase 3: Integración en Layout de Subdominio y Adaptabilidad Móvil

- [x] **T08-LAYOUT-INTEGRATION:** Envolver `frontend/src/app/[subdomain]/layout.tsx` con `SidebarProvider`, habilitar la visualización del Sidebar para el rol `digitizer` y sincronizar el margen dinámico del contenedor principal (`md:ml-64` a `md:ml-16`) con `transition-all duration-300 ease-in-out`.
- [x] **T09-ROUTE-GUARDS-UPDATE:** Actualizar las reglas de navegación en `[subdomain]/layout.tsx` para permitir que el rol `digitizer` acceda tanto a `/[subdomain]/visor` como a `/[subdomain]/metrics`, manteniendo la redirección forzada a `/visor` ante intentos de acceso a rutas no autorizadas.
- [x] **T10-MOBILE-DRAWER:** Implementar el Drawer móvil con clase `-translate-x-full` por defecto, barra superior móvil con botón hamburguesa y backdrop overlay con cierre táctil para resoluciones menores a 768px.

---

### Fase 4: Endpoint Backend de Métricas de Digitador (FastAPI)

- [x] **T11-PYDANTIC-MODELS:** Definir en `backend/main.py` el modelo Pydantic `DigitizerMetricsResponse` con campos `user_id`, `tenant_id`, `full_name`, `folios_today`, `folios_last_7_days`, `folios_total_verified` y `last_activity_at`.
- [x] **T12-METRICS-ENDPOINT:** Crear el endpoint `GET /api/v1/digitizer/metrics` en `backend/main.py` protegido con `get_auth_context`, filtrando folios por `tenant_id` y pertenencia al usuario autenticado.
- [x] **T13-METRICS-AGGREGATION:** Implementar el cálculo temporal de folios completados hoy (inicio del día UTC), folios en los últimos 7 días y total histórico verificado.

---

### Fase 5: Vista de Métricas Personales (`/[subdomain]/metrics`)

- [x] **T14-METRICS-PAGE:** Crear la página `frontend/src/app/[subdomain]/metrics/page.tsx` con diseño responsivo y estilo visual consistente con la plataforma.
- [x] **T15-METRICS-KPIS:** Construir componentes visuales para las tarjetas KPI de productividad: "Folios Hoy", "Últimos 7 Días" y "Total Histórico Verificado".
- [x] **T16-METRICS-HISTORY-TABLE:** Implementar tabla resumen con la lista reciente de partidas transcritas por el digitador, indicando estado de verificación y fecha de entrega.
- [x] **T17-METRICS-LOADING-EMPTY:** Añadir estados de carga con esqueletos visuales (Skeleton loaders) y pantalla de bienvenida amigable para nuevos digitadores sin folios transcritos.

---

### Fase 6: Pruebas, Casos Límite y Verificación Integral

- [x] **T18-SHORTCUT-QA:** Verificar que el atajo `Ctrl + B` funciona en cualquier punto neutro de la interfaz y es ignorado al escribir en cajas de texto y campos de transcripción del Visor.
- [x] **T19-PERSISTENCE-QA:** Probar recarga de página y verificar que el estado colapsado/expandido persiste sin parpadeos ni inconsistencias de hidratación de React.
- [x] **T20-PERMISSIONS-QA:** Comprobar que el digitador únicamente tiene acceso a `/visor` y `/metrics`, y que las llamadas al backend no exponen datos de otros digitadores ni de otros tenants.
