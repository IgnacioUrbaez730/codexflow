# Especificación 005: Backoffice de Super-Administrador (Onboarding Manual)

## 1. Objetivo
Proveer al propietario del sistema (Dueño/Socios) un panel de control global para gestionar las organizaciones (Tenants), asignar cuotas de uso y realizar el proceso de incorporación (onboarding) de nuevos clientes B2B de forma manual (Concierge Onboarding), sin depender de una pasarela de pagos automatizada.

## 2. Requisitos Funcionales (RF)

### RF-1: Gestión de Rol Super-Admin
- **Ampliación de Roles:** Se agregará el rol `superadmin` a la base de datos. Operará globalmente sin estar atado a un tenant (`tenant_id = NULL`).
- **Lógica de Auto-Reparación (Lista Blanca):** Se descarta la validación cronológica. En su lugar, el backend (FastAPI) utilizará una variable de entorno secreta (`SUPERADMIN_EMAIL`). Si el Middleware Global detecta a un usuario sin rol, consultará al backend. El backend verificará criptográficamente el JWT; si el email del token coincide con la variable maestra, le inyectará el rol `superadmin`, imprimirá un log de auditoría en consola (simulando alerta) y le dará Pase Directo a `/superadmin`.

### RF-2: Panel de Control Global (Dashboard Superadmin)
- **Seguridad y Rutas:** El panel vivirá en la ruta `/superadmin` (o subdominio configurado). Solo los usuarios con rol `superadmin` podrán acceder; cualquier otro rol será expulsado.
- **Métricas Globales:** El dashboard mostrará una tabla con todos los `tenants` (ONGs) activos en el sistema, mostrando el nombre de la organización, cuota asignada, cuota consumida y fecha de creación.

### RF-3: Concierge Onboarding (Creación de Clientes)
- **Formulario de Alta de ONG:** El Super Admin tendrá una interfaz para registrar un nuevo cliente. Este formulario pedirá:
  - Nombre de la Organización.
  - Límite de Cuota Semanal/Mensual (Freemium o Contrato).
  - Correo electrónico del responsable (quien será el Administrador del Tenant).
- **Flujo de Asignación:** Al enviar el formulario, el backend generará el nuevo `tenant_id`, configurará su límite en la tabla `tenant_quotas`, y le enviará un *Magic Link* al correo del cliente. Cuando el cliente inicie sesión por primera vez, el sistema le asignará el rol `admin` atado a ese nuevo `tenant_id`.

### RF-4: Administración Continua
- **Edición de Cuotas:** El Super Admin podrá editar el límite de procesamiento (`weekly_limit`) de cualquier organización desde la tabla central con un par de clics (útil si la ONG paga por una expansión de contrato).
- **Invitación de Socios:** El Super Admin podrá invitar a otros correos otorgándoles el nivel `superadmin` para delegar tareas administrativas.

## 3. Requisitos No Funcionales (RNF)
- **Seguridad RLS Extendida:** Las políticas de Row Level Security (RLS) actuales bloquean lecturas cruzadas. El backend utilizará consultas con privilegios elevados (Service Key o bypass auditado) *únicamente* cuando la solicitud provenga de un token JWT validado con el rol `superadmin`.

### RF-5: Flujo de Autenticación Universal y API Proxy (Actualización de Mantenimiento)
- **Login Universal (`/login`):** Se establece una única pantalla de acceso global. Tras validar credenciales, el sistema determinará del lado del servidor (SSR) el rol del usuario (`superadmin`, `admin` u `operador`) y lo redirigirá automáticamente a su espacio de trabajo correspondiente.
- **Redirección Automática de Sesiones Activas:** Si un usuario con una sesión válida intenta acceder a `/login` o `/register`, el servidor SSR interceptará la petición y lo redirigirá instantáneamente a su respectivo Dashboard.
- **API Proxy Seguro (Next.js Rewrites):** La comunicación entre el Frontend y el Backend (FastAPI) se realizará exclusivamente a través de un proxy inverso. El frontend solicitará rutas relativas (ej. `/api/superadmin/tenants`) y Next.js redirigirá la petición al servidor de Render ocultando la topología de red real y evitando errores de CORS.

### RF-6: Manejo de Usuarios Huérfanos (Hotfix)
- **Ruta de Espera (`/pending`):** Si un usuario inicia sesión sin `rol` ni `tenant_id`, será redirigido a `/pending` en lugar de dar 404. La página mostrará un mensaje de espera, un botón de "Cerrar Sesión", y un enlace `mailto:` que inyectará automáticamente el email del usuario en el Asunto del correo. La reevaluación de sus permisos será manual (refrescar con F5).
- **Alerta en Panel Global:** El Dashboard del Superadmin mostrará de forma proactiva un indicador visual o contador avisando que existen "Usuarios en espera de asignación".
- **Gestión desde Panel:** El Superadmin podrá procesar a estos usuarios huérfanos con tres acciones:
  1. *Asignar a ONG Existente:* Usando un desplegable.
  2. *Crear Nueva ONG:* Generar el Tenant y asignarlo en un solo paso.
  3. *Rechazar:* Marcar al usuario como rechazado permanentemente.
- **Estado 'Rechazado' (Arquitectura):** Se agregará el valor `'rejected'` al ENUM `user_role` en la base de datos. Si un usuario tiene este rol, la vista `/pending` cambiará su estado visual a "Acceso Denegado Permanentemente".
