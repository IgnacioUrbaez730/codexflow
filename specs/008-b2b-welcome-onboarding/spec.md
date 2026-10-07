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

---

## Enmienda Hotfix H1 — Aterrizaje Directo en /welcome (Loop de Corrección)

> **Origen:** Directiva no negociable del fundador (2026-10-07). Esta enmienda **prevalece** sobre cualquier texto anterior de esta Spec que la contradiga (ver H1.6).

### H1.1 Problema observado
Los usuarios invitados que pulsan el enlace del correo de invitación aterrizan en `/` → `/login` con el token visible en la barra (`#access_token=...`) y quedan varados: no se crea sesión, no llegan a `/welcome` y no pueden completar su cuenta.

### H1.2 Causa raíz (diagnosticada)
1. `createBrowserClient` de `@supabase/ssr` configura el cliente de Auth con `flowType: 'pkce'` por defecto.
2. `supabase.auth.admin.invite_user_by_email` (backend) genera enlaces que, tras verificar en Supabase, devuelven los tokens en **formato implícito dentro del hash**: `#access_token=...&refresh_token=...&expires_in=...&token_type=bearer&type=invite`.
3. Con `flowType: 'pkce'`, la detección automática (`detectSessionInUrl`) rechaza esa URL con el error `Not a valid PKCE flow url` y **no crea sesión**. El listener de `/login` nunca recibe `SIGNED_IN`, por eso el usuario queda en `/login` con el token visible.
4. Además, `redirect_to` en `create_tenant` y `resend_tenant_invite` apunta a la raíz (`https://codexflow-frontend.vercel.app`), lo que fuerza el salto `/` → `/login`.
5. Deuda técnica agravante: `frontend/src/app/welcome/page.tsx` está **corrupto** (template literals destruidos por una escritura previa vía PowerShell: `"Authorization": \Bearer \\` en ≈L40 y ≈L85, y `router.push(\/\/dashboard\);` en ≈L100). Es muy probable que el último build de Vercel haya fallado por esto.

### H1.3 Requisitos

#### RF-H1.1: Destino del enlace de invitación (Backend)
- En `backend/main.py`, las funciones `create_tenant` y `resend_tenant_invite` DEBEN invocar `invite_user_by_email` con `redirect_to = "https://codexflow-frontend.vercel.app/welcome"`.
- El enlace del correo NUNCA debe aterrizar en `/login` ni en `/`.

#### RF-H1.2: Cero redirecciones automáticas en `/welcome` (Frontend)
- La página `/welcome` NO DEBE contener ninguna navegación automática: ni `router.push`, `router.replace`, `redirect()`, `window.location.href/assign/replace`, ni equivalentes, hacia `/login`, `/pending` ni ninguna otra ruta, en ningún `useEffect`, listener de Auth o rama de error.
- La página permanece mostrando el formulario (o el mensaje de error) hasta que el usuario actúe.
- La **única** navegación permitida es `router.push('/' + encodeURIComponent(tenant_name) + '/dashboard')`, ejecutada exclusivamente dentro del manejador del botón **"Guardar y Entrar"** o el botón **"Ir a mi Dashboard"**.
- El texto de reserva visual del título ("tu Organización") NUNCA debe usarse para construir la URL de navegación.

#### RF-H1.3: Establecimiento manual de sesión desde el hash
- Al montar, `/welcome` DEBE capturar `window.location.hash` **antes de cualquier otra operación**.
- Si el hash no tiene `type=invite` (y se están procesando tokens del hash), se debe mostrar un error en la misma página y bloquear el formulario.
- Si ambos tokens existen, DEBE limpiar/cerrar cualquier sesión previa (ej. `supabase.auth.signOut()`) y luego llamar `supabase.auth.setSession({ access_token, refresh_token })` para sobrescribir y establecer la nueva sesión para el usuario invitado.
- Inmediatamente después, DEBE limpiar el hash de la barra con `window.history.replaceState(...)`.
- El `access_token` de la sesión se usa como `Authorization: Bearer <token>` en llamadas a `/api/auth/me` y `/api/auth/complete-onboarding`.

#### RF-H1.4: Estados de cuenta y validaciones (Bloqueos)
- Si el hash contiene errores de Supabase (`error_code=otp_expired`), o si no hay token ni sesión:
  - NO se redirige. Mostrar mensaje: **"Este enlace de invitación expiró o ya fue usado. Solicita al administrador que te reenvíe la invitación."** Bloquear formulario.
- Si falla el establecimiento de sesión o los fetch posteriores por un **error de red**, diferenciarlo de los tokens expirados: mostrar **"Error de conexión. Por favor reintenta."** sin deshabilitar permanentemente la posibilidad de recargar.
- Si la llamada a `GET /api/auth/me` devuelve 403, pending, rejected o falta `tenant_name`: 
  - Mostrar el error exacto en pantalla y bloquear el formulario. No redirigir.
- Si el usuario YA completó el registro (`has_completed_onboarding` = true):
  - Mostrar aviso **"Cuenta ya configurada"** y un botón manual **"Ir a mi Dashboard"**.
  - El backend `complete-onboarding` debe devolver HTTP 409 si alguien intenta enviar datos nuevamente estando ya completado.
- Backend: En `GET /api/auth/me` unificar el rol cambiando `"digitador"` por `"digitizer"`.

#### RF-H1.7: Migración de Rol en Base de Datos
- Ejecutar un script SQL para actualizar a los usuarios existentes: `UPDATE public.user_profiles SET role = 'digitizer' WHERE role = 'digitador';`

#### RF-H1.5: Llamadas API vía proxy
- Todas las llamadas `fetch` de `/welcome` DEBEN usar rutas relativas (`/api/auth/me`, `/api/auth/complete-onboarding`) para pasar por el proxy `rewrites` de `frontend/next.config.js` y evitar CORS. Prohibido usar la URL absoluta de Render.

#### RF-H1.6: Integridad del archivo `welcome/page.tsx`
- El archivo DEBE reescribirse **íntegro** con codificación UTF-8 limpia (finales de línea consistentes), sin usar `Set-Content`/`Out-File` de PowerShell ni ningún mecanismo que interprete `` ` `` o `$`.
- Los textos con tildes/eñes ("Contraseña", "Organización") deben renderizar correctamente.

#### RNF-H1.1: Alcance acotado
- `frontend/src/app/page.tsx` y `frontend/src/app/login/page.tsx` NO se modifican en este hotfix (inspección del 2026-10-07: sin errores de sintaxis que rompan el build).
- `frontend/src/middleware.ts` no se modifica (no redirige en `*.vercel.app`).

### H1.4 Requisito externo (acción manual del fundador)
- En **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs** DEBE existir `https://codexflow-frontend.vercel.app/**` (o, como mínimo, `https://codexflow-frontend.vercel.app/welcome`). Si no está en la lista blanca, Supabase **ignora** `redirect_to` y usa el *Site URL*, reproduciendo el bug aunque el código sea correcto.

### H1.5 Criterios de Aceptación (verificables)
| ID | Criterio | Cómo se verifica |
|----|----------|------------------|
| CA-H1.1 | `create_tenant` y `resend_tenant_invite` usan `redirect_to` = `https://codexflow-frontend.vercel.app/welcome`. | Búsqueda textual en `backend/main.py`. |
| CA-H1.2 | Un correo de invitación nuevo (crear ONG o reenviar) abre `.../welcome#access_token=...` y nunca pasa por `/login`. | Prueba E2E manual tras despliegue (pestaña de red / historial). |
| CA-H1.3 | Tras abrir el enlace válido, la barra queda en `/welcome` sin hash, el título muestra el nombre real de la ONG y el formulario está habilitado. | Prueba E2E manual. |
| CA-H1.4 | Con el enlace válido abierto, la página permanece en `/welcome` indefinidamente sin interacción (≥ 60 s), sin saltos a `/login`, `/pending` u otra ruta. | Prueba E2E manual. |
| CA-H1.5 | Al pulsar "Guardar y Entrar" con datos válidos y respuesta 2xx, se navega a `/<tenant_name>/dashboard`. Con error del backend, se muestra el error y NO se navega. | Prueba E2E manual. |
| CA-H1.6 | Con un enlace expirado/usado (`#error_code=otp_expired`) o abriendo `/welcome` sin token ni sesión, se muestra el mensaje exacto de RF-H1.4, el formulario está deshabilitado y no hay redirección. | Prueba E2E manual (reusar un enlace ya consumido; abrir `/welcome` en ventana privada). |
| CA-H1.7 | `welcome/page.tsx` contiene exactamente **una** navegación (`router.push`) y está dentro del manejador de envío tras éxito; no contiene `/login`, `/pending`, `router.replace`, `window.location.href/assign/replace` ni `redirect(`. | Búsqueda textual en el archivo. |
| CA-H1.8 | `welcome/page.tsx` no contiene literales corruptos (`\Bearer`, `\/\/`), usa template literals válidos y está en UTF-8 con tildes correctas. | Búsqueda textual + `npm run build` en `frontend/` sin errores de sintaxis. |
| CA-H1.9 | Todas las llamadas fetch de `/welcome` usan rutas relativas `/api/...`. | Búsqueda textual. |
| CA-H1.10 | El build de Vercel del commit del hotfix termina en estado *Ready*. | Panel de Vercel. |
| CA-H1.11 | La URL de redirección está en la lista blanca de Supabase (H1.4). | Confirmación del fundador. |

### H1.6 Textos de esta Spec que quedan superados
- **RF-4 (último punto):** "el frontend redirigirá automáticamente a `/[tenant_name]/dashboard`" → se reinterpreta como: navegación **disparada por la acción manual** del usuario tras respuesta exitosa (RF-H1.2). No existe ninguna otra navegación en `/welcome`.
- **plan.md §3.a:** "usando datos del context/store del tenant" → el `tenant_name` se obtiene de `GET /api/auth/me` con el Bearer de la sesión establecida en RF-H1.3.
- **RF-3 "Bloqueo Estricto"** sigue vigente para **otras** páginas (que pueden redirigir hacia `/welcome`), pero `/welcome` en sí no redirige nunca.
