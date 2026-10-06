# Plan Técnico: Hotfix Bootstrapping (Auto-Reparación / Lista Blanca)

Este plan documenta la implementación del parche de auto-reparación (RF-1) descrito en `specs/005-superadmin-onboarding/spec.md`.

## 1. Base de Datos (SQL)
- **Eliminación de lógicas previas:** Identificar y remover cualquier trigger o función SQL vieja basada en conteo cronológico para el bootstrapping inicial (ej. el primer usuario registrado se convierte en superadmin). La asignación de roles ahora será delegada enteramente al backend mediante una lista blanca por variable de entorno.

## 2. Backend (Python/FastAPI)
- **Nuevo Endpoint (`POST /api/auth/self-heal`):** 
  - Validar el JWT enviado por el cliente para asegurar que proviene de un usuario autenticado y verificar criptográficamente su firma.
  - Extraer el `email` del payload del token.
  - Comparar este email contra el valor de la variable de entorno `SUPERADMIN_EMAIL`.
  - **Condición de Éxito:** Si coinciden, actualizar el registro correspondiente en la tabla `user_profiles`, asignando `role = 'superadmin'` y asegurando que `tenant_id = NULL` (acceso global sin ataduras a un tenant).
  - Imprimir un log de auditoría en consola o logs del sistema notificando que la cuenta ha sido auto-reparada y elevada a Super Admin (simulando una alerta de seguridad/auditoría).
  - Retornar un estado exitoso al cliente indicando que la elevación de privilegios fue procesada.

## 3. Frontend (React/Next.js)
- **Modificación del Flujo de Login / Middleware Global:**
  - Cuando se detecte una sesión activa pero el perfil del usuario indique que carece de rol (huérfano) en lugar de ser redirigido inmediatamente a `/pending` (como estipula el RF-6 base), interceptar este flujo.
  - Realizar una llamada asíncrona (fetch) al endpoint `POST /api/auth/self-heal`.
  - Si la llamada es exitosa (código 200) y el backend confirma la auto-reparación, actualizar el estado de sesión local para reflejar el rol `superadmin` y redirigir inmediatamente a `/superadmin`.
  - Si la llamada falla o el backend responde que no aplica, continuar el flujo original hacia la página de espera en `/pending`.
