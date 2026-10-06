# Spec 006: Placeholder Landing Page

## 1. Objetivo
Crear una página de inicio temporal (Hello World) para verificar que el despliegue raíz (`/`) de Vercel funciona correctamente y evitar el error 404, proveyendo enlaces rápidos a las rutas de prueba.

## 2. Requerimientos Funcionales (RF)
- **RF-1 (Vista de Inicio):** La ruta raíz `/` debe mostrar un mensaje de bienvenida ("Hello World / CodexFlow").
- **RF-2 (Navegación):** Debe incluir enlaces directos a `/register` y `/superadmin` para facilitar el testing.

## 3. Requerimientos No Funcionales (RNF)
- **RNF-1:** Debe ser un Server Component simple.
- **RNF-2:** Sin estilos complejos, solo Tailwind básico.
