# Especificación 007: Gestión B2B de Organizaciones (Superadmin)

## 1. Objetivo
Completar el panel de control del Superadmin habilitando la creación directa de Organizaciones (Modelo B2B Cerrado/Concierge), la recolección de datos de facturación/contacto, la gestión del ciclo de vida (activación/suspensión) y el soporte técnico mediante personificación (Impersonation).

## 2. Requisitos Funcionales (RF)

### RF-1: Creación de Nueva ONG y Administrador
- **Vista del Formulario (`/superadmin/tenants/new`):** El Superadmin dispondrá de un formulario con los siguientes campos:
  - Básicos: `Nombre de la ONG`, `Límite Semanal de Folios`, `Correo del Administrador`.
  - Facturación/Contacto: `País`, `Nombre completo del contacto`, `RIF/NIT`, `Teléfono`.
- **Lógica de Invitación:** Al procesar, el backend utilizará Supabase Auth (`invite_user_by_email`) enviando un "Magic Link". El nuevo Administrador ingresará directamente haciendo clic en el correo, sin ser forzado a establecer contraseña de inmediato.
- **Prevención de Duplicados:** Si el correo ingresado ya pertenece a un usuario activo en el sistema, la transacción se aborta y se arroja un error bloqueante: *"Este usuario ya pertenece a una organización activa"*.

### RF-2: Gestión de Estado y Reenvío de Invitaciones
- **Columna de Estado:** La tabla de organizaciones en `/superadmin` incluirá el estado del Administrador principal.
- **Reenvío Seguro:** Si la base de datos indica que el Administrador nunca ha iniciado sesión (`last_sign_in_at` es nulo), se mostrará un botón de **"Reenviar Invitación"**. Esto soluciona los fallos de red o límites de tasa (Rate Limits) del proveedor de correos sin requerir un *rollback* de la BD.

### RF-3: Soporte Técnico (Modo Dios / Impersonation)
- **Acceso Directo:** Cada organización en la tabla tendrá un botón **"Ver Dashboard"**.
- Al hacer clic, el Superadmin será redirigido al dashboard de ese cliente en específico (ej. `/treefamily/dashboard`). El middleware y el backend permitirán el acceso de solo lectura o soporte sin degradar el rol del Superadmin ni requerir credenciales adicionales.

### RF-4: Ciclo de Vida (Soft Delete)
- **Suspensión de Servicio:** Se añade un botón de **"Desactivar"** (y su contraparte "Activar") en la tabla.
- Al desactivar una ONG, su estado (`is_active`) cambia a falso. Inmediatamente se congela su acceso al sistema y se bloquean las inserciones/consultas de todos los usuarios (Admin, Archivistas, Digitadores) pertenecientes a dicho Tenant.

## 3. Requisitos No Funcionales (RNF)
- **Extensibilidad:** Los datos de contacto deben residir en la tabla `tenants`, separando limpiamente la capa de facturación de la capa de identidad (`user_profiles`).
- **Independencia del Scope:** Esta especificación se limita a las herramientas del Superadmin. La invitación interna de Archivistas/Digitadores por parte del Administrador pertenece a la Spec 004.
