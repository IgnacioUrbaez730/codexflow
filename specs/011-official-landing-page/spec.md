# Especificación de Requerimientos: Landing Page Oficial e Institucional de CodexFlow

**Identificador de Especificación:** `SPEC-011`  
**Versión:** 1.0.0  
**Fecha de Creación:** 2026-10-12  
**Estado:** Aprobado / Listo para Implementación  
**Autor:** Agente Planificador SDD (Flujo Spec-Driven Development)  

---

## 1. Resumen Ejecutivo y Propósito

El propósito de esta especificación es definir de forma rigurosa los requisitos funcionales y no funcionales para la **Landing Page Oficial e Institucional de CodexFlow**, accesible públicamente a través de la ruta raíz `/` (o `/landing`). 

CodexFlow es la plataforma SaaS especializada en la preservación digital, indexación estructurada y transcripción asistida por Inteligencia Artificial de fondos documentales históricos (parroquiales, diocesanos, notariales y civiles). La Landing Page debe proyectar una identidad visual moderna, sobria e institucional (paleta Slate-950 con acentos en Azul `#2563EB` y Esmeralda `#10B981`), comunicar con claridad la propuesta de valor frente a los cuellos de botella de la transcripción manual, ilustrar la ergonomía del visor dual interactivo y permitir a las entidades interesadas solicitar accesos/demostraciones mediante un formulario conectado a Supabase.

---

## 2. Partes Interesadas (Stakeholders) y Actores

- **Visitante Institucional (Anónimo):** Representante de diócesis, curia parroquial, archivo general, biblioteca histórica o registro civil que evalúa la plataforma para modernizar sus flujos de digitalización.
- **Usuario Registrado / Operador Autenticado:** Transcriptor, revisor o administrador que ingresa a la raíz del sitio con una sesión activa en Supabase Auth.
- **Administrador de CodexFlow:** Receptor de las solicitudes institucionales de demostración y contacto para seguimiento comercial/académico.

---

## 3. Requerimientos del Sistema (Sintaxis EARS)

Los requerimientos están formulados utilizando la sintaxis formal **EARS** (*Easy Approach to Requirements Syntax*):
- *Ubiquitous:* "El sistema **deberá** [acción]"
- *Event-driven:* "CUANDO [evento], el sistema **deberá** [acción]"
- *State-driven:* "MIENTRAS [estado], el sistema **deberá** [acción]"
- *Optional feature:* "DONDE [característica opcional], el sistema **deberá** [acción]"
- *Unwanted behavior:* "SI [condición de error], ENTONCES el sistema **deberá** [acción]"

### 3.1. Navegación, Header y Detección de Estado de Sesión

- **REQ-NAV-01 (Ubiquitous):** El sistema **deberá** renderizar una barra de navegación superior fija (*Sticky Header*) con efecto de traslúcido/backdrop blur, logo oficial de CodexFlow y enlaces ancla funcionales a `#caracteristicas`, `#seguridad`, `#casos-de-uso` y `#faq`.
- **REQ-NAV-02 (State-driven):** MIENTRAS el visitante sea anónimo (sin sesión activa detectada en Supabase Auth), el sistema **deberá** mostrar en el header el botón de acción principal "Iniciar Sesión" apuntando a `/login` y el botón secundario "Solicitar Demo" que dispara el modal de contacto.
- **REQ-NAV-03 (State-driven):** MIENTRAS el usuario posea una sesión válida autenticada en Supabase Auth, el sistema **deberá** sustituir el botón "Iniciar Sesión" por "Ir a mi Panel", redirigiendo directamente a `/batches` o `/dashboard`.
- **REQ-NAV-04 (Ubiquitous):** En pantallas con resolución móvil (< 768px), el sistema **deberá** proveer un menú hamburguesa desplegable accesible que replique todos los enlaces y CTAs de navegación.

### 3.2. Sección Hero y Mockup Interactivo

- **REQ-HERO-01 (Ubiquitous):** El sistema **deberá** presentar un titular institucional de alto impacto: *"CodexFlow — Plataforma Inteligente de Digitalización e Indexación de Archivos Históricos"*, complementado con subtítulo enfocado en la preservación de patrimonio, reducción de tiempos operativos y precisión asistida por visión computacional.
- **REQ-HERO-02 (Ubiquitous):** El bloque Hero **deberá** incluir dos botones de llamada a la acción (CTA) destacados:
  1. *Primario:* "Iniciar Sesión" (o "Ir al Panel" si está autenticado).
  2. *Secundario:* "Solicitar Acceso / Demo" (abre el modal interactivo).
- **REQ-HERO-03 (Ubiquitous):** El sistema **deberá** renderizar en el Hero una demostración visual interactiva simulando el **Visor Dual de Transcripción**:
  - Panel izquierdo: Facsímil o manuscrito histórico de muestra con bounding box interactivo destacado.
  - Panel derecho: Formulario de indexación con campos prellenados al 80% (Nombres, Apellidos, Fecha de Bautismo/Acta, Parroquia, Padrinos).
- **REQ-HERO-04 (Event-driven):** CUANDO el visitante interactúe con el selector de herramientas del mockup (alternar modo lupa o cambiar de registro de demostración), el sistema **deberá** actualizar en tiempo real el recorte de imagen y los metadatos sin recargar la página.

### 3.3. Sección Problema vs. Solución

- **REQ-PROB-01 (Ubiquitous):** El sistema **deberá** exponer una comparativa visual estructurada contrastando:
  - *El Cuello de Botella Tradicional:* Deterioro físico de tomos, transcripción manual lenta en hojas de cálculo, transcripciones propensas a errores tipográficos y búsquedas manuales que tardan días.
  - *La Solución CodexFlow:* Digitalización segura en la nube, aceleración por IA con verificación humana estricta, consultas centralizadas en segundos y exportaciones inmediatas.

### 3.4. Los 4 Pilares Clave de CodexFlow

- **REQ-PILAR-01 (Ubiquitous - Ergonomía Extrema):** El sistema **deberá** documentar e ilustrar el pilar de ergonomía: visor dual con zoom sincrónico, atajos de teclado sin necesidad de ratón (Shift+Tab, Ctrl+Enter, F-keys), lupa óptica flotante de 180px para caligrafías complejas y filtros visuales (inversión, contraste, binarización).
- **REQ-PILAR-02 (Ubiquitous - IA & Active Learning):** El sistema **deberá** documentar el asistente de IA: extracción automática de bounding boxes de partidas, prellenado con exactitud $\ge 80\%$, y retroalimentación activa donde cada validación o corrección humana mejora el modelo del fondo documental.
- **REQ-PILAR-03 (Ubiquitous - Seguridad y Multi-Tenancy):** El sistema **deberá** documentar la arquitectura de seguridad: aislamiento estricto de datos por diócesis/entidad mediante Row-Level Security (RLS) en PostgreSQL, auditoría inmutable de cambios y almacenamiento en Cloudflare R2 con cero costes de egress.
- **REQ-PILAR-04 (Ubiquitous - Exportación Profesional):** El sistema **deberá** documentar las capacidades de exportación: generación nativa de libros Excel (`.xlsx`) estilizados formalmente para archivos diocesanos y exportación CSV delimitada por punto y coma (`;`) lista para importar en software genealógico o de registro civil.

### 3.5. Casos de Uso Institucionales

- **REQ-USE-01 (Ubiquitous):** El sistema **deberá** detallar escenarios específicos de implementación para:
  1. *Diócesis, Curias y Parroquias:* Indexación de libros sacramentales de bautismos, matrimonios y defunciones.
  2. *Archivos Generales e Históricos:* Catalogación de fondos notariales, actas de cabildo y legajos coloniales.
  3. *Registros Civiles y Bibliotecas Patrimoniales:* Digitalización de padrones, censos y manuscritos protegidos.

### 3.6. Preguntas Frecuentes (FAQ Accordion)

- **REQ-FAQ-01 (Ubiquitous):** El sistema **deberá** incluir un acordeón colapsable con soporte de teclado y accesibilidad (ARIA) con al menos 5 preguntas clave:
  1. ¿Qué formatos de imagen y resolución soporta CodexFlow? (TIFF, JPEG, PNG, WebP en alta resolución).
  2. ¿Cómo se garantiza la confidencialidad y propiedad de los datos históricos? (Aislamiento RLS, propiedad 100% de la entidad).
  3. ¿Requiere conexión continua a Internet o cuenta con tolerancia a desconexiones? (Sincronización tolerante y persistencia local de borrador).
  4. ¿Qué tan efectiva es la IA con caligrafías manuscritas del siglo XVII al XIX? (Active Learning optimizado por fondo documental y validación humana 100%).
  5. ¿En qué formatos se exportan los índices generados? (Excel .xlsx con plantillas eclesiásticas oficiales y CSV estructurado).
- **REQ-FAQ-02 (Event-driven):** CUANDO el visitante hace clic en una pregunta del acordeón, el sistema **deberá** expandir la respuesta correspondiente cerrando o manteniendo el estado de acordeón según el estándar accesible.

### 3.7. Footer Institucional y Metadatos OpenGraph

- **REQ-FOOTER-01 (Ubiquitous):** El sistema **deberá** renderizar un footer institucional con enlaces a Políticas de Privacidad, Términos de Servicio, enlace a GitHub o documentación técnica, información de contacto y copyright dinámico con el año en curso.
- **REQ-SEO-01 (Ubiquitous):** La página **deberá** incluir etiquetas semánticas HTML5, OpenGraph (`og:title`, `og:description`, `og:image`, `og:url`) y Twitter Cards para generar vistas previas enriquecidas al compartir el enlace en WhatsApp, Telegram y LinkedIn.

### 3.8. Formulario Modal y Persistencia de Demo ("Solicitar Acceso / Demo")

- **REQ-DEMO-01 (Event-driven):** CUANDO el usuario pulse cualquier botón "Solicitar Acceso / Demo", el sistema **deberá** abrir un modal accesible (`Dialog`) con foco atrapado y cierre mediante tecla `Escape` o clic externo.
- **REQ-DEMO-02 (Ubiquitous):** El formulario **deberá** requerir y validar los siguientes campos:
  - `nombre_completo`: Texto no vacío (mínimo 3 caracteres).
  - `organizacion`: Nombre de la diócesis, parroquia o institución (mínimo 3 caracteres).
  - `email`: Formato de correo electrónico válido.
  - `telefono`: Cadena con formato telefónico internacional o nacional (opcional o validado).
  - `mensaje`: Texto describiendo el fondo documental o número estimado de tomos (mínimo 10 caracteres).
- **REQ-DEMO-03 (Event-driven):** CUANDO el usuario envíe el formulario con datos válidos, el sistema **deberá** registrar la solicitud en la tabla `public.demo_requests` de Supabase a través de una API segura o cliente anónimo permitido por RLS (INSERT-only).
- **REQ-DEMO-04 (Event-driven):** CUANDO la inserción sea exitosa, el sistema **deberá** mostrar un estado de agradecimiento/confirmación ("¡Solicitud Recibida! Nos pondremos en contacto a la brevedad con su institución") y limpiar los campos del formulario.
- **REQ-DEMO-05 (Unwanted behavior):** SI la inserción falla por problemas de red o validación, ENTONCES el sistema **deberá** mostrar una alerta no bloqueante con el mensaje de error y mantener los datos ingresados para que el usuario pueda reintentar.

---

## 4. Requerimientos No Funcionales

1. **Rendimiento:** Primer despliegue con contenido (LCP $\le 1.8$s) y carga ligera de bundle sin librerías de UI innecesarias.
2. **Accesibilidad (A11y):** Cumplimiento de WCAG 2.1 Nivel AA en contrastes de texto sobre fondos oscuros (Slate-950) y claros. Soporte de navegación total por teclado.
3. **Diseño Responsivo:** Visualización fluida en anchos de pantalla desde 360px hasta 2560px.
4. **Seguridad:** Los clientes no autenticados solo pueden hacer `INSERT` en `demo_requests`, con políticas RLS que prohíben `SELECT`, `UPDATE` o `DELETE` a roles anónimos.
