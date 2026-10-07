# Especificación 008: Flujo de Bienvenida y Contraseña (B2B)

## 1. Objetivo
Obligar a todos los usuarios invitados (Administradores, Archivistas, Digitadores) a establecer una contraseña de seguridad y completar su perfil personal (Nombre, Apellido, Cargo) la primera vez que ingresan a la plataforma mediante un Enlace Mágico.

## 2. Requisitos Funcionales (RF)

### RF-1: Base de Datos y Perfiles
- Añadir las siguientes columnas a la tabla `user_profiles`:
  - `first_name` (TEXT)
  - `last_name` (TEXT)
  - `job_title` (TEXT, Opcional)
  - `has_completed_onboarding` (BOOLEAN DEFAULT FALSE)
- **Compatibilidad hacia atrás:** No se correrán scripts retroactivos. Todo usuario viejo que inicie sesión y tenga `has_completed_onboarding` en FALSE o NULO, será redirigido a completar su perfil obligatoriamente.

### RF-2: Enrutamiento Defensivo (Backend)
- Modificar el endpoint `GET /api/auth/me`:
  - Si el rol es `superadmin`, ignorar la validación y enviarlo a `/superadmin`.
  - Si el rol es otro (admin, digitador, etc.) y `has_completed_onboarding` es Falso/Nulo, interceptar la ruta normal y devolver `redirect_url: "/welcome"`.
  - Enviar también el nombre de la ONG (`tenant_name`) en el payload para que el frontend lo use en el título.

### RF-3: Pantalla de Bienvenida (`/welcome`)
- **Diseño Visual:**
  - Título dinámico: *"Bienvenido a [Nombre de la ONG]. Completa tu cuenta"*.
  - Campos a recolectar: `Nombre` (Obligatorio), `Apellido` (Obligatorio), `Cargo o Puesto` (Opcional), `Nueva Contraseña` (Mínimo 6 caracteres), `Confirmar Contraseña`.
  - Botón de Acción: *"Guardar y Entrar"*.
- **Bloqueo Estricto:** Si el usuario intenta navegar hacia atrás o a otra URL a mano, el middleware/redirección de React (basado en `/api/auth/me`) lo atrapará y lo devolverá a `/welcome`.

### RF-4: Transacción de Actualización (API)
- Crear el endpoint `POST /api/auth/complete-onboarding`.
- Recibirá: `first_name`, `last_name`, `job_title`, `password`.
- **Atomicidad simulada:** El backend actualizará primero el registro en la tabla `user_profiles` (cambiando `has_completed_onboarding` a TRUE). Luego, utilizará la API Admin de Supabase para actualizar la contraseña del usuario. Si la contraseña falla por algún motivo de red, se debe deshacer el cambio en la tabla para evitar dejar al usuario en un estado de limbo.
- Al tener éxito, el frontend redirigirá automáticamente a `/[tenant_name]/dashboard`.

## 3. Requisitos No Funcionales (RNF)
- **Desempeño:** La validación de estado seguirá ocurriendo en un solo viaje (el de `auth_me`) para no aumentar los tiempos de carga en el frontend.
