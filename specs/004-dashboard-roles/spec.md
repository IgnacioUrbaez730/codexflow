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
