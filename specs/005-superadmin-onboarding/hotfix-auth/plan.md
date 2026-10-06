# Plan de Mantenimiento: Flujo de Autenticación Universal y API Proxy (RF-5)

## Objetivo
Cumplir estrictamente con el requerimiento RF-5 de la Especificación 005 implementando la redirección inteligente basada en sesión y roles para el login/registro, y auditar el proxy de API.

## 1. Modificación de `frontend/src/app/login/page.tsx`
- **Detección de Sesión (SSR):** El componente (o su layout/página asociada) debe revisar de forma automática del lado del servidor si existe una sesión activa y válida (ej. Supabase Auth).
- **Evaluación de Rol:** En caso de existir sesión, consultar la tabla `user_profiles` para determinar el rol del usuario.
- **Redirección Inmediata:**
  - Si el rol es `superadmin`: Redirigir hacia `/superadmin`.
  - Si el rol es `admin` o `operador`: Redirigir hacia `/[subdomain]/dashboard` (o la ruta que asigne el tenant actual).
- **Manejo Post-Login:** Al completarse un login manual exitoso, ejecutar esta misma lógica de enrutamiento basada en el rol recuperado.

## 2. Modificación de `frontend/src/app/register/page.tsx`
- **Intercepción de Sesión:** Aplicar una comprobación SSR idéntica a la página de login para evitar que usuarios logueados vean el formulario de registro.
- **Redirección Segura:** Si el usuario ya posee sesión, redirigir instantáneamente a su espacio correspondiente (`/superadmin` o dashboard de su tenant).

## 3. Auditoría del API Proxy en `next.config.js`
- **Inspección de Configuración:** Revisar las propiedades de `rewrites` dentro de `next.config.js`.
- **Validación del Enrutamiento:** Confirmar que las peticiones del frontend a `/api/*` están siendo mapeadas a la URL base del backend (FastAPI en Render).
- **Verificación CORS y Topología:** Auditar que esta configuración logre ocultar correctamente la topología real de la red, evitando que el frontend intente llamadas directas al backend que generen errores CORS.
