# Lista de Tareas de Implementación: Landing Page Oficial de CodexFlow

**Identificador de Tareas:** `TASKS-011`  
**Referencia de Especificación:** `specs/011-official-landing-page/spec.md`  
**Referencia de Plan:** `specs/011-official-landing-page/plan.md`  
**Estado:** Completado Exitosamente  

---

## Fase 1: Infraestructura de Base de Datos y Modelo de Seguridad (Supabase)

- [x] `TASK-011-01`: Crear script de migración SQL para la tabla `public.demo_requests` con campos `id`, `full_name`, `organization`, `email`, `phone`, `message`, `status` y `created_at`.
- [x] `TASK-011-02`: Configurar políticas RLS en `public.demo_requests`:
  - [x] Habilitar RLS en la tabla (`ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY`).
  - [x] Crear política de inserción pública sin restricciones para roles `anon` y `authenticated`.
  - [x] Crear política restrictiva de lectura (`SELECT`) exclusiva para administradores / service role.
- [x] `TASK-011-03`: Probar e integrar el cliente de Supabase para inserciones anónimas verificando que no se expongan datos existentes.

---

## Fase 2: Componentes de Navegación y Cabecera Institucional

- [x] `TASK-011-04`: Crear componente `StickyHeader.tsx` con soporte para fondo traslúcido (`backdrop-blur-md bg-slate-950/80`) y borde divisorio sutil.
- [x] `TASK-011-05`: Implementar enlaces ancla de navegación suave hacia `#caracteristicas`, `#seguridad`, `#casos-de-uso` y `#faq`.
- [x] `TASK-011-06`: Integrar hook detector de sesión en `StickyHeader`:
  - [x] Mostrar botón "Iniciar Sesión" y "Solicitar Demo" cuando no haya sesión activa.
  - [x] Sustituir por botón "Ir a mi Panel" (`/batches` o `/dashboard`) cuando se detecte sesión activa en Supabase Auth.
- [x] `TASK-011-07`: Implementar menú desplegable móvil accesible con botón hamburguesa para pantallas inferiores a 768px.

---

## Fase 3: Sección Hero y Mockup Interactivo del Visor Dual

- [x] `TASK-011-08`: Construir `HeroSection.tsx` con titular institucional: *"CodexFlow — Plataforma Inteligente de Digitalización e Indexación de Archivos Históricos"* y subtítulo sobre preservación patrimonial.
- [x] `TASK-011-09`: Integrar los botones principales de llamada a la acción (CTA) en el Hero ("Iniciar Sesión" / "Ir al Panel" y "Solicitar Acceso / Demo").
- [x] `TASK-011-10`: Desarrollar el componente interactivo `DualViewerMockup.tsx`:
  - [x] Panel Izquierdo: Simulación de facsímil histórico con recuadro delimitador verde esmeralda (bounding box) y visualizador de lupa óptica de 180px.
  - [x] Panel Derecho: Formulario de transcripción con campos indexados prellenados al 80% (Nombres, Apellidos, Fecha de Bautismo, Parroquia, Padrinos).
  - [x] Selector interactivo de documentos para alternar entre dos muestras históricas reales en vivo sin recarga.

---

## Fase 4: Secciones de Contenido (Problema vs. Solución, 4 Pilares y Casos de Uso)

- [x] `TASK-011-11`: Crear componente `ProblemSolutionSection.tsx` con comparativa visual estructurada de cuellos de botella tradicionales vs. aceleración tecnológica de CodexFlow.
- [x] `TASK-011-12`: Desarrollar componente `KeyPillarsSection.tsx` detallando los 4 pilares:
  - [x] Pilar 1: Ergonomía Extrema (Visor dual sincronizado, atajos sin ratón, lupa de 180px, filtros binarizados).
  - [x] Pilar 2: IA & Active Learning (Detección de bounding boxes, prellenado $\ge 80\%$, entrenamiento continuo con validaciones humanas).
  - [x] Pilar 3: Seguridad y Multi-Tenancy (Aislamiento RLS por diócesis/parroquia, Cloudflare R2 sin costo de egress, auditoría inmutable).
  - [x] Pilar 4: Exportación Profesional (Libros Excel `.xlsx` estilizados con plantillas oficiales y CSV delimitado por `;`).
- [x] `TASK-011-13`: Desarrollar componente `UseCasesSection.tsx` con las 3 tarjetas de aplicación:
  - [x] Curias Diocesanas y Parroquias (libros sacramentales).
  - [x] Archivos Generales y Notariales (protocolos y legajos históricos).
  - [x] Registros Civiles y Bibliotecas Patrimoniales (padrones, censos y manuscritos).

---

## Fase 5: Preguntas Frecuentes (FAQ), Footer y Optimización SEO

- [x] `TASK-011-14`: Implementar `FAQSection.tsx` con acordeón accesible conteniendo las 5 preguntas clarificadas:
  - [x] Formatos de archivo y resolución soportados (TIFF, JPEG, PNG, WebP).
  - [x] Confidencialidad, propiedad y aislamiento de datos diocesanos.
  - [x] Tolerancia a desconexiones y modo de trabajo continuo.
  - [x] Precisión con caligrafías antiguas de los siglos XVII al XIX.
  - [x] Opciones y compatibilidad de exportación de índices.
- [x] `TASK-011-15`: Crear `InstitutionalFooter.tsx` / `Footer.tsx` con enlaces a políticas, avisos legales patrimoniales, contacto y copyright con año dinámico.
- [x] `TASK-011-16`: Configurar metatags OpenGraph (`og:title`, `og:description`, `og:image`, `og:url`) y Twitter Cards en el archivo de layout o metadatos de Next.js.

---

## Fase 6: Modal y Flujo de Solicitud de Demostración ("Solicitar Demo")

- [x] `TASK-011-17`: Construir componente `DemoRequestModal.tsx` con control de foco accesible (`Dialog`) y cierre mediante tecla `Escape` y botón de salida.
- [x] `TASK-011-18`: Implementar validación de formulario para `full_name`, `organization`, `email`, `phone` y `message`.
- [x] `TASK-011-19`: Conectar el formulario con la inserción en Supabase `public.demo_requests`:
  - [x] Manejo de estado de carga y deshabilitación de botón durante el envío.
  - [x] Manejo de estado de éxito con mensaje confirmatorio institucional.
  - [x] Manejo de errores no bloqueantes con opción de reintento.

---

## Fase 7: Integración en la Ruta Raíz, Pruebas y Validación E2E

- [x] `TASK-011-20`: Integrar todos los componentes en la página raíz (`app/page.tsx`) garantizando la navegación suave hacia los identificadores `#caracteristicas`, `#seguridad`, `#casos-de-uso` y `#faq` y preservando el redireccionamiento para magic links por hash `#access_token=...`.
- [x] `TASK-011-21`: Realizar auditoría de contraste semántico de colores (paleta Slate-950/900 con contrastes Slate-100/White y acentos azul/esmeralda).
- [x] `TASK-011-22`: Verificar responsividad completa en componentes móviles (menú desplegable, grids adaptativos, lupa óptica oculta en móviles y activa en desktop).
- [x] `TASK-011-23`: Probar compilación estática de producción con `npm run build` en Next.js (código de salida 0).
