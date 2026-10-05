# Documento de Especificación de Requerimientos de Software (SRS)

**Proyecto:** Sistema Inteligente de Indexación y Transcripción de Registros Históricos y Parroquiales (Plataforma SaaS)

**Versión:** 1.2

**Fecha:** 2026

**Tipo de Sistema:** Plataforma Web SaaS Multi-Inquilino (*Multi-Tenant*) con Transcripción Asistida y Aprendizaje Activo (*Human-in-the-Loop AI*)

**Estado:** Propuesta de Arquitectura y Requerimientos

## 1. Introducción y Propósito

### 1.1 Objetivo del Proyecto

Diseñar y construir una plataforma web bajo la modalidad **Software as a Service (SaaS)** que permita a entidades externas (empresas de digitalización, ONGs, diócesis, archivos históricos, asociaciones genealógicas) crear espacios de trabajo aislados para digitalizar, indexar y transcribir de forma colaborativa sus colecciones documentales (partidas de bautismo, nacimiento, matrimonio y defunción).

La plataforma combina una estación ergonómica de doble panel (visor de imagen de alta resolución + formulario estructurado) con un motor de **Aprendizaje Activo (*Active Learning*)**. A medida que los operadores de cada organización digitan registros, el sistema captura las relaciones espaciales entre las palabras y las coordenadas del documento original, permitiendo que la IA aprenda progresivamente el diseño caligráfico y la estructura de los libros para ofrecer asistencia automática.

### 1.2 Alcance del Sistema

* **Modelo SaaS Multi-Inquilino (*Multi-Tenant*):** Aislamiento lógico estricto de datos, imágenes y modelos de transcripción por organización.

* **Portal de Autoservicio para Clientes (ONG/Empresas):** Registro de cuenta institucional, contratación/planes de cuota, invitación de personal y configuración de permisos internos.

* **Estación de Captura Dual:** Interfaz ergonómica pensada para trabajo intensivo con navegación rápida 100% orientada al teclado.

* **Telemetría Espacial y Ground Truth:** Registro de cajas delimitadoras (*Bounding Boxes*) vinculadas a cada campo semántico.

* **Pipeline de IA Adaptativo:** Modelos base de reconocimiento óptico y manuscrito (HTR/OCR) enriquecidos con ajustes locales por organización y por tomo.

* **Motor de Búsqueda y Entrega:** Consulta difusa y fonética, trazabilidad directa al recorte original y exportación masiva.

## 2. Actores del Sistema

| Rol | Ámbito | Descripción y Responsabilidades Clave | 
| ----- | ----- | ----- | 
| **Superadministrador de la Plataforma** | Global (SaaS) | Administra la infraestructura, supervisa el aprovisionamiento de inquilinos, monitorea colas de entrenamiento global y define planes de suscripción. | 
| **Administrador de Organización (Tenant Admin)** | Organización | Responsable de la ONG o empresa cliente. Crea libros/proyectos, invita y gestiona a sus digitadores/revisores, supervisa el consumo de almacenamiento y cuotas. | 
| **Indexador / Digitador de Organización** | Organización | Usuario operativo asignado por su organización para transcribir folios, ajustar recortes o confirmar sugerencias de la IA dentro de su espacio de trabajo. | 
| **Revisor / Auditor de Calidad (QA)** | Organización | Especialista paleográfico asignado por la organización para resolver discrepancias en transcripciones ciegas y validar el cierre de lotes. | 
| **Agente de IA (Servicio Asíncrono)** | Sistema / Tenant | Worker en segundo plano que computa alineaciones de coordenadas, genera datasets de entrenamiento aislados por tenant y emite inferencias de prellenado. | 

## 3. Requerimientos Funcionales (RF)

### Módulo 0: Arquitectura SaaS y Gestión Multi-Inquilino (*Multi-Tenancy*)

* **RF-00.1 Registro y Onboarding de Organizaciones:**

  * Auto-registro para empresas u ONGs mediante creación de una cuenta institucional con subdominio o identificador de espacio de trabajo único (`tenant_id`).

  * Asignación de cuotas de uso (capacidad de almacenamiento para imágenes, número máximo de folios procesados por mes y cantidad de usuarios concurrentes).

* **RF-00.2 Aislamiento Estricto de Datos (Tenant Isolation):**

  * Toda consulta a nivel de base de datos y sistema de almacenamiento de archivos debe estar restringida al `tenant_id` autenticado.

  * Ninguna organización podrá visualizar, consultar ni exportar folios o transcripciones pertenecientes a otra entidad.

* **RF-00.3 Gestión de Miembros y Control de Acceso por Organización:**

  * El Administrador de Organización puede enviar invitaciones por correo electrónico a sus colaboradores.

  * Capacidad de definir roles internos: *Administrador de Proyecto*, *Indexador*, *Revisor* o *Lector*.

  * Suspensión, reactivación o desvinculación inmediata de operadores por parte de la organización.

* **RF-00.4 Privacidad y Partición de Modelos de IA:**

  * Posibilidad de optar por modelos de aprendizaje privados (los datos de la ONG/empresa solo reentrenan su propio modelo) o contribuir a un modelo base global anonimizado.

### Módulo 1: Ingesta y Gestión de Libros y Folios

* **RF-01 Estructura Jerárquica de Archivo por Organización:**
  

  $$
  \text{Organización (Tenant)} \longrightarrow \text{Fondo / Diócesis} \longrightarrow \text{Parroquia / Archivo} \longrightarrow \text{Libro / Tomo} \longrightarrow \text{Folio (Página)}
  $$

* **RF-02 Ingesta Masiva y Preprocesamiento:** Carga de imágenes (JPEG, PNG, TIFF) con procesamiento automático:

  * Conversión a formato de pirámide de teselas (DZI/Deep Zoom) o WebP optimizado para streaming de alta densidad.

  * Corrección automática de inclinación leve (*deskew*) y balance tonal.

  * Generación de miniaturas cifradas por organización.

* **RF-03 Asignación y Bloqueo Concurrente de Lotes:**

  * Asignación de rangos de folios a operadores específicos dentro de la misma organización.

  * Bloqueo temporal (*pessimistic lock*) del folio en edición para evitar duplicidad de trabajo entre operadores simultáneos.

### Módulo 2: Estación de Indexación (Interfaz Dual Ergonómica)

* **RF-04 Visor de Imagen Interactivo:**

  * Doble panel sincronizado (lado izquierdo: visor de alta resolución; lado derecho: formulario estructurado).

  * Soporte de zoom fluido, paneo, rotación libre o a 90°, inversión de color (modo negativo para tintas desvanecidas) y controles de contraste.

* **RF-05 Formularios Parametrizables por Tipo de Registro:**

  * **Bautismo:** Parroquia, fecha de sacramento, fecha de nacimiento, nombre del bautizado, legitimidad, padres, padrinos, presbítero, libro, tomo, folio, partida.

  * **Matrimonio:** Fecha, nombres de contrayentes, padres de ambos, testigos, celebrante.

  * **Defunción:** Fecha de deceso, nombre del difunto, edad, cónyuge/padres, causa aparente, lugar de sepultura.

  * **Plantillas Personalizables:** Las organizaciones pueden habilitar o inhabilitar campos opcionales según el período histórico del libro.

* **RF-06 Captura Orientada al Teclado:**

  * Navegación completa mediante `Tab` o `Enter` sin obligar al uso del cursor.

  * Atajos configurables para guardar partida (`Ctrl + Enter`), alternar zoom sobre la zona de interés y avanzar al siguiente registro.

### Módulo 3: Motor de Alineación Espacial y Aprendizaje Activo

* **RF-07 Telemetría y Cajas Delimitadoras (*Bounding Boxes*):**

  * Cuando el operador transcribe un campo (ej. *"Manuel"* en `Nombre`), el sistema computa en segundo plano la alineación sobre la imagen para asociar la caja delimitadora:
    

    $$
    \text{BBox} = [x_{\min}, y_{\min}, x_{\max}, y_{\max}]
    $$

  * Opción de recorte manual: si el operador selecciona con el mouse una palabra en la imagen, el campo activo absorbe el texto sugerido y almacena las coordenadas exactas.

* **RF-08 Generación Automática de Dataset (*Ground Truth*):** Cada partida revisada y confirmada consolida una terna estructurada dentro del espacio del inquilino:
  

  $$
  \{\text{Recorte de Imagen}\} \longleftrightarrow \{\text{Etiqueta Semántica}\} \longleftrightarrow \{\text{Texto Validado}\}
  $$

* **RF-09 Maduración Progresiva de la Asistencia (3 Fases):**

  * **Fase 1 (Supervisión Pasiva):** El sistema registra transcripciones y coordenadas sin interferir con el operador.

  * **Fase 2 (Focalización Visual):** Al posicionar el foco en un campo, el visor ejecuta zoom automático hacia la zona probable donde suele ubicarse dicho dato en ese tomo.

  * **Fase 3 (Prellenado Asistido con Umbrales de Confianza):** La IA sugiere los datos reconocidos. Si el nivel de confianza supera el umbral estipulado, el operador únicamente debe verificar visualmente y confirmar.

### Módulo 4: Calidad, Arbitraje y Validaciones

* **RF-10 Indexación en Doble Ciego por Lote:**

  * Configuración opcional para que un folio sea asignado a dos digitadores independientes de la misma organización.

  * Si la coincidencia supera el umbral parametrizado (ej. $\ge 95\%$), el registro se aprueba automáticamente; de lo contrario, se envía al buzón del Revisor/Auditor.

* **RF-11 Validaciones Lógicas y Diccionarios Históricos:**

  * Reglas cronológicas: $\text{Fecha de Sacramento} \ge \text{Fecha de Nacimiento}$.

  * Límites temporales contra el rango declarado del tomo.

  * Autocompletado contextual basado en diccionarios onomásticos y toponímicos históricos precargados o refinados por la organización.

### Módulo 5: Búsqueda, Trazabilidad y Exportación

* **RF-12 Búsqueda Fonética e Histórica:** Motor de búsqueda difusa (*fuzzy search*) con algoritmos fonéticos adaptados al español histórico (Metaphone / Daitch-Mokotoff) para emparejar variantes ortográficas (*"Valenzuela"* vs. *"Balensuela"*, *"Hilario"* vs. *"Ylario"*).

* **RF-13 Trazabilidad Documental Inmutable:** Toda partida indexada permite abrir directamente el recorte exacto y el folio original donde se ubica el texto en la imagen.

* **RF-14 Exportación de Datos por Organización:** Exportación en CSV, JSON, Excel y generación de certificados en PDF con marca de agua y código QR de verificación institucional.

## 4. Requerimientos No Funcionales (RNF)

| Código | Dimensión | Especificación Técnica | 
| ----- | ----- | ----- | 
| **RNF-01** | **Aislamiento Multi-Tenant** | Separación lógica de datos mediante *Row-Level Security* (RLS) en base de datos y políticas IAM de buckets de almacenamiento independientes por organización. | 
| **RNF-02** | **Rendimiento de Visualización** | Apertura y primera renderización de un folio de alta resolución en menos de **1.2 segundos** mediante carga de teselas por demanda (*DZI/DeepZoom*). | 
| **RNF-03** | **Eficiencia Operativa** | Un digitador entrenado debe poder completar el 95% de una partida sin recurrir al ratón. | 
| **RNF-04** | **Persistencia y Resiliencia** | Autoguardado local de borrador en el navegador cada 15 segundos para proteger el trabajo ante cortes de conexión o fallas de equipo. | 
| **RNF-05** | **Latencia de Inferencia** | La predicción o prellenado de campos no debe degradar la respuesta del formulario web ($< 150\text{ ms}$ por llamada a la API de formulario). | 
| **RNF-06** | **Seguridad y Cifrado** | Cifrado en tránsito (TLS 1.3) y en reposo (AES-256) para imágenes y transcripciones. Registro de auditoría inmutable de accesos por usuario. | 

## 5. Arquitectura del Flujo Multi-Inquilino y Aprendizaje Activo

```
                  ┌──────────────────────────────────────────┐
                  │          ONG / Empresa (Tenant)          │
                  │   - Administrador  - Digitadores  - QA   │
                  └─────────────────────┬────────────────────┘
                                        │ Autenticación + Contexto (tenant_id)
                                        ▼
                  ┌──────────────────────────────────────────┐
                  │       API Gateway / Router Multi-Tenant  │
                  └─────────────────────┬────────────────────┘
                                        │
           ┌────────────────────────────┴────────────────────────────┐
           ▼                                                         ▼
┌─────────────────────────────────────┐   ┌─────────────────────────────────────┐
│    Almacenamiento de Imágenes       │   │    Base de Datos Relacional (Postgres)│
│  /storage/tenants/{tenant_id}/...   │   │  (Row Level Security por tenant_id) │
└──────────────────┬──────────────────┘   └──────────────────┬──────────────────┘
                   │                                         │
                   └────────────────────┬────────────────────┘
                                        ▼
                         ┌─────────────────────────────┐
                         │   Estación de Indexación    │
                         │    (Visor DZI + Formulario) │
                         └──────────────┬──────────────┘
                                        │ Digitador transcribe / valida
                                        ▼
                         ┌─────────────────────────────┐
                         │   Alineador de Coordenadas  │
                         │   (Emparejamiento de BBox)  │
                         └──────────────┬──────────────┘
                                        │ Dataset etiquetado (Ground Truth)
                                        ▼
                         ┌─────────────────────────────┐
                         │  Pipeline de Reentrenamiento │
                         │  - Base global compartida    │
                         │  - Adaptadores por Tenant    │
                         └──────────────┬──────────────┘
                                        │ Checkpoints / Modelos
                                        ▼
                         ┌─────────────────────────────┐
                         │ Motor de Inferencia Activa  │ ───► Sugerencias de
                         └─────────────────────────────┘      prellenado al operador

```

### Reglas de Decisión según Nivel de Confianza ($C$):

$$
\text{Comportamiento en Formulario} =  \begin{cases}  \text{Prellenar campo y marcar en verde (Validación rápida)}, & \text{si } C \ge 0.85 \\ \text{Enfocar región en visor sin prellenar (Guía visual)}, & \text{si } 0.50 \le C < 0.85 \\ \text{Campo en blanco (Captura manual tradicional)}, & \text{si } C < 0.50  \end{cases}
$$

## 6. Modelo de Datos Relacional Multi-Tenant

```
┌───────────────────────────┐           ┌───────────────────────────┐
│       ORGANIZACION        │1         N│          USUARIO          │
├───────────────────────────┤───────────├───────────────────────────┤
│ id_organizacion (PK)      │           │ id_usuario (PK)           │
│ nombre_organizacion       │           │ id_organizacion (FK)      │
│ slug_subdominio           │           │ nombre_completo           │
│ plan_suscripcion          │           │ correo_electronico        │
│ max_almacenamiento_gb     │           │ password_hash             │
│ fecha_registro            │           │ rol (ADMIN/DIGITADOR/QA)  │
└─────────────┬─────────────┘           └───────────────────────────┘
              │ 1
              │
              │ N
┌─────────────┴─────────────┐           ┌───────────────────────────┐
│           LIBRO           │1         N│           FOLIO           │
├───────────────────────────┤───────────├───────────────────────────┤
│ id_libro (PK)             │           │ id_folio (PK)             │
│ id_organizacion (FK)      │           │ id_libro (FK)             │
│ fondo_jurisdiccion        │           │ numero_folio              │
│ parroquia_archivo         │           │ ruta_imagen_orig          │
│ tipo_registro             │           │ ruta_imagen_dzi           │
│ anio_inicio / anio_fin    │           │ estado (PENDIENTE/PROCESO)│
└───────────────────────────┘           └─────────────┬─────────────┘
                                                      │ 1
                                                      │
                                                      │ N
┌───────────────────────────┐           ┌─────────────┴─────────────┐
│       CAMPO_PARTIDA       │N         1│          PARTIDA          │
├───────────────────────────┤───────────├───────────────────────────┤
│ id_campo (PK)             │           │ id_partida (PK)           │
│ id_partida (FK)           │           │ id_folio (FK)             │
│ id_organizacion (FK)      │           │ numero_acta               │
│ nombre_campo              │           │ id_digitador (FK)         │
│ valor_transcrito          │           │ id_revisor (FK)           │
│ bbox_coordenadas (JSON)   │           │ estado_revision           │
│ confianza_ia              │           │ fecha_creacion            │
└───────────────────────────┘           └───────────────────────────┘

```

## 7. Plan de Implementación por Fases

1. **Fase I: Infraestructura Multi-Tenant y Sistema Base (MVP)**

   * Arquitectura SaaS con aislamiento por `tenant_id` y gestión de membresías de usuarios.

   * Carga de libros y folios por organización con procesamiento a formato piramidal (DZI).

   * Estación dual ergonómica con formulario navegable por teclado.

   * Base de datos protegida con *Row Level Security* (RLS) y exportación estándar (CSV/Excel).

2. **Fase II: Telemetría Espacial, Control de Calidad y Cuotas**

   * Registro automático y manual de cajas delimitadoras (*Bounding Boxes*).

   * Módulo de revisión por doble ciego y resolución de conflictos entre digitadores.

   * Monitoreo de consumo de almacenamiento y cuotas por organización.

3. **Fase III: Aprendizaje Activo Multi-Tenant y Asistencia Inteligente**

   * Despliegue de modelos de reconocimiento manuscrito (HTR) con adaptadores de ajuste fino (*Fine-Tuning*) por organización/tomo.

   * Enfoque visual guiado y prellenado automático según umbrales de confianza configurables.

   * Tablero de métricas de productividad y precisión analítica para administradores de la organización.