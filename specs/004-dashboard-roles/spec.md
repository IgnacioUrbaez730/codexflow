# Especificación 004: Dashboard, Roles y Exportación

## 1. Objetivo
Proveer a las organizaciones herramientas de gestión de operaciones, control de acceso basado en roles (RBAC), un panel principal (Dashboard) con métricas globales, y vías seguras de exportación de datos (CSV y API REST en tiempo real).

## 2. Requisitos Funcionales (RF)

### RF-1: Gestión de Roles y Accesos (RBAC)
- **Invitación de Empleados:** El Administrador ingresa el correo del nuevo usuario (Archivista/Digitador) y Supabase Auth envía un "Magic Link" para que el empleado establezca su contraseña.
- **Administrador / Verificador Global:** Acceso total al *Tenant*. Tiene **poder de sobrescritura** (Modo Dios) sobre cualquier folio. Para organizar la revisión, su Bandeja de Dudosos incluye una columna de **"Archivista Responsable"**.
- **Archivista:** Sube lotes (Ingesta) y revisa la Bandeja de Dudosos *únicamente* de los lotes que él subió.
- **Digitador:** Acceso ciego. Solo visualiza el "Visor Dual" para transcribir folios.

### RF-2: Dashboard Operativo (Métricas)
- **Bloqueo Visual (Soft Paywall):** Si se agota la cuota Freemium, el Dashboard muestra una alerta persistente ("Procesamiento Congelado") pero el Administrador NO pierde acceso a sus gráficas históricas.
- **Gráfico de Productividad:** Una gráfica de línea de tendencia que muestra el volumen global de folios procesados en el tiempo, sin ránkings individuales por empleado.
- **Embudo y Cuotas:** Indicadores visuales de folios subidos vs. verificados, y consumo de cuota diaria/semanal.

### RF-3: Exportación Estática (CSV)
- **Evolución de Plantillas:** La descarga utilizará estrictamente las columnas que existan **el día de la descarga**. Columnas nuevas agregadas recientemente saldrán en blanco para los folios viejos, manteniendo la integridad del archivo.

### RF-4: Exportación en Tiempo Real (API REST)
- **Llave Maestra Única:** El Tenant tiene 1 sola API Key. Si el Administrador le da a "Regenerar", la llave anterior se destruye y todas las conexiones (Excel) previas se caen por seguridad.
- **Protección de Rendimiento:** El endpoint (`GET /api/v1/export`) devolverá **por defecto los últimos 30 días** para evitar colapsar la base de datos. Para históricos mayores, se podrá solicitar un Lote específico.
- **Bloqueo Financiero:** El endpoint verificará la cuota Freemium. Si está agotada, devolverá un error y el Excel dejará de sincronizar datos hasta que se pague.

## 3. Requisitos No Funcionales (RNF)
- **Seguridad:** Supabase RLS garantizará que la API Key solo devuelva folios del `tenant_id` asociado.


## Enmienda Loop 1 — UI/UX del Dashboard y Métricas Reales
Se requiere mejorar la experiencia de usuario y conectar el Dashboard con datos reales:
1. **Sidebar:** Añadir un Sidebar de navegación en el layout base, adaptativo según el rol del usuario (Administrador, Archivista, Digitador).
2. **Métricas Reales:** Conectar las gráficas y KPIs del Dashboard al endpoint real del backend en lugar de usar datos simulados (mocks).
3. **Gestión de Usuarios:** Mover el formulario de invitación de usuarios (digitadores) fuera del Dashboard hacia una nueva sección dedicada en ajustes de equipo (`/settings/users/page.tsx`).

## Enmienda Loop 2 - Jerarquías de Acceso, Gestión de Personal y Fix de Subdominio
- **Bug Crítico "undefined"**: `/api/auth/me` debe retornar siempre el `tenant_name` correcto tras el login para que las redirecciones (`/{tenant_name}/...`) no fallen. La seguridad y carga de datos (RLS) deben basarse estrictamente en el `tenant_id` del token JWT, nunca en la URL.
- **Jerarquía y Navegación (Sidebar)**: 
  - *Admin*: Acceso a Dashboard, Ingesta/Dudosos, Equipo, y un nuevo enlace permanente a "Visor de Indexación". Aterriza por defecto en el Dashboard.
  - *Archivista*: Acceso a Ingesta/Dudosos y "Visor de Indexación".
  - *Indexador (Digitizer)*: Acceso ÚNICAMENTE al Visor. Sin barra lateral.
  - En el Visor, Admins y Archivistas consumen folios de la misma cola global automática que los Digitizers.
- **Métricas de la Tabla de Equipo**: La vista de "Equipo" deja de ser un formulario aislado y pasa a ser una Tabla Completa con Búsqueda por texto y Filtro de estado (Activos/Inactivos). Columnas: Nombre, Email, Rol, Folios Procesados Hoy, y Estado.
- **Gestión de Empleados**: Los Admins pueden invitar (incluyendo a otros Admins sin límite), desactivar, y cambiar roles del personal.
- **Restricciones de Seguridad en Gestión**: 
  - Un usuario NO puede cambiar su propio rol ni desactivarse a sí mismo.
  - No se puede desactivar o degradar al ÚLTIMO Admin activo de la organización.
  - Si se invita a un correo que ya existe pero está inactivo, se arroja un error ("Usuario ya existe, reactívelo manualmente").
  - Si se desactiva a alguien que está trabajando, la expulsión es "perezosa" (falla al intentar pedir el siguiente folio o guardar el actual).
