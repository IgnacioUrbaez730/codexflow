# Tareas de Implementación: Flujo de Autenticación Universal (RF-5)

- [x] **T1:** Modificar `frontend/src/app/login/page.tsx` agregando validación SSR de sesión activa y redirección inteligente por rol (hacia `/superadmin` o `/[subdomain]/dashboard`).
- [x] **T2:** Modificar `frontend/src/app/register/page.tsx` agregando la intercepción SSR para redirigir a los usuarios que ya tienen sesión a su dashboard correspondiente.
- [x] **T3:** Auditar el archivo `next.config.js` para comprobar que las reglas `rewrites` mapean correctamente `/api/*` hacia el backend, previniendo errores CORS y ocultando la topología.
