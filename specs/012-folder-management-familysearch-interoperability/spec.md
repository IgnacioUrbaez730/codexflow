# Especificación de Requerimientos: Gestión de Carpetas/Tomos e Interoperabilidad FamilySearch

**Identificador de Especificación:** `SPEC-012`  
**Versión:** 1.1.0  
**Fecha de Creación:** 2026-10-13  
**Última Actualización:** 2026-10-14  
**Estado:** Aprobado tras Triple Filtro de Clarificación SDD (15/15 Acuerdos)  
**Autor:** Agente Coordinador Antigravity (Flujo Spec-Driven Development)  

---

## 1. Resumen Ejecutivo y Propósito

El propósito de esta especificación es expandir el modelo de catalogación, captura y entrega de CodexFlow para responder a los estándares operativos y de homologación de proyectos internacionales de digitalización patrimonial (tales como los requeridos por **FamilySearch**, diócesis, archivos notariales y curias generales).

La especificación unifica los dos mundos de la preservación:
1. **La Estructura y Captura Organizativa (Inspirada en DCam):**
   - Árbol jerárquico de carpetas anidadas (*Diócesis / Fondo $\rightarrow$ Parroquia / Notaría $\rightarrow$ Serie Documental $\rightarrow$ Tomo / Libro*).
   - Asignación flexible de folios e imágenes sueltas a tomos existentes heredando su plantilla y anexándose al final de la secuencia.
   - Herencia de metadatos comunes del tomo en modo solo lectura inmutable (Parroquia, Tomo, Años base) para máxima coherencia de archivo.
   - Compatibilidad total hacia atrás: los lotes existentes se agrupan en una carpeta virtual *"Folios Sin Clasificar"* sin interrumpir las operaciones en curso.
   - Control de acceso RBAC: Solo Administradores y Archivistas pueden crear carpetas y mover folios; Digitadores solo indexan.
2. **Ergonomía de Captura de Múltiples Partidas por Folio (Estilo FamilySearch Indexing):**
   - Pestañas/tarjetas desplegables (*Partida 1*, *Partida 2*, etc.) con botón `+ Agregar Partida` y atajo `Alt + N`.
   - Persistencia normalizada: cada partida genera un registro independiente en base de datos (`entries`) apuntando al mismo `image_file_name`.
   - Detección espacial de IA dividiendo los bounding boxes por cada partida en la página.
   - Atajos estándar de FamilySearch para casos especiales: `Ctrl + U` (Ilegible), `Ctrl + B` (En Blanco) y `Ctrl + D` (Duplicar valor del registro anterior).
   - Flujo de guardado: `Ctrl + Enter` guarda la partida actual y pasa a la siguiente; al culminar la última partida del folio, avanza al siguiente folio.
3. **Paquete de Exportación e Interoperabilidad FamilySearch (DIP - Dissemination Information Package):**
   - Descarga directa de archivo `.ZIP` estructurado conteniendo:
     1. Matriz consolidada en Excel (`.xlsx`) con estilos corporativos.
     2. Matriz delimitada en CSV (BOM UTF-8, `sep=;\r\n`).
     3. Manifiesto del Tomo (`manifest.json` y Dublin Core).
     4. Archivo genealógico estándar GEDCOM 5.5.1 (`export_gedcom.ged`) para eventos vitales (`BIRT`, `CHR`, `MARR`, `DEAT`).
   - Nomenclatura canónica homologada de archivos de imagen: `[CódigoOrg]_[Serie]_[Tomo]_[Folio]` (ej. `DIOC_MAR_BAU_T01_F0042.jpg`), preservando el nombre original como metadato de auditoría.
   - Validación previa: permite exportar el tomo alertando explícitamente cuántas partidas permanecen en estado "Dudoso / Revisión".
   - Streaming y transferencia segura: compresión en streaming por lotes para no saturar memoria RAM en el servidor.

---

## 2. Partes Interesadas (Stakeholders) y Actores

- **Archivista / Coordinador de Digitalización:** Crea carpetas y tomos, asigna imágenes, organiza el árbol documental y audita las partidas.
- **Indexador / Digitador:** Captura datos página a página mediante atajos (`Alt + N`, `Ctrl + Enter`, `Ctrl + U`, `Ctrl + B`, `Ctrl + D`).
- **Auditor Externo / FamilySearch / Curia:** Recibe el paquete `.ZIP` con matriz normalizada, GEDCOM y fotos homologadas.
- **Administrador / SuperAdmin:** Gestiona la organización y supervisa cuotas globales.

---

## 3. Requerimientos del Sistema (Sintaxis EARS)

### 3.1. Árbol Jerárquico de Carpetas y Gestión de Tomos (DCam)

- **[REQ-TOMO-01] Árbol Jerárquico de Carpetas:**
  - *El sistema deberá* permitir crear y visualizar carpetas con estructura jerárquica anidada (`parent_id`) representando:
    - Nivel 1: Fondo Documental / Diócesis.
    - Nivel 2: Entidad productora / Parroquia / Notaría.
    - Nivel 3: Serie Documental (Bautismos, Matrimonios, Defunciones, Protocolos).
    - Nivel 4: Tomo / Libro físico (con Años extremos, N° de Tomo, Caja/Estante y Plantilla asignada).
- **[REQ-TOMO-02] Restricción de Roles RBAC:**
  - *El sistema deberá* permitir la creación de carpetas, edición de metadatos de tomo y reasignación de folios ÚNICAMENTE a usuarios con rol `admin` o `archivist`. Los usuarios con rol `digitizer` tendrán acceso de solo lectura al árbol y solo podrán transcribir.
- **[REQ-TOMO-03] Reasignación de Folios Sueltos:**
  - *Cuando* un usuario mueva folios sueltos a un Tomo existente, *el sistema deberá* actualizar su pertenencia, aplicar la plantilla del tomo destino y anexar los folios al final de la secuencia del libro.
- **[REQ-TOMO-04] Herencia de Metadatos Inmutable:**
  - *Mientras* el transcriptor trabaje en el Visor dentro de un Tomo, *el sistema deberá* bloquear como solo lectura inmutable los campos heredados del libro (Nombre de Parroquia, Diócesis, N° de Tomo, Rango de Años base).
- **[REQ-TOMO-05] Carpeta Virtual para Folios Existentes:**
  - *El sistema deberá* mantener los lotes y folios existentes agrupados bajo una carpeta virtual del sistema *"Sin Clasificar (Migración inicial)"*, garantizando cero interrupciones en los folios que se encuentran en proceso de prueba.

### 3.2. Múltiples Partidas por Folio y Atajos FamilySearch

- **[REQ-MULTI-01] Pestañas de Partidas en Visor:**
  - *El sistema deberá* renderizar en el panel derecho del Visor un selector de pestañas/tarjetas (*Partida 1*, *Partida 2*, etc.) con botón `+ Agregar Partida` y atajo `Alt + N`.
- **[REQ-MULTI-02] Persistencia Normalizada por Partida:**
  - *Cada* partida individual creada dentro de un folio *deberá* guardarse como un registro atómico independiente en la base de datos (con su propio `id`, `folio_id`, `entry_number`, `metadata`), vinculado obligatoriamente al `image_file_name` del folio físico.
- **[REQ-MULTI-03] Bounding Boxes de IA Segmentados por Partida:**
  - *El sistema deberá* segmentar las líneas de texto detectadas por la IA asignando los recuadros superiores a la Partida 1 y los inferiores a las partidas subsiguientes.
- **[REQ-MULTI-04] Atajos de Teclado Estándar FamilySearch:**
  - *El sistema deberá* responder a los siguientes atajos en cualquier campo activo del formulario:
    - `Ctrl + U`: Asigna el valor marcado `<Ilegible>` al campo activo.
    - `Ctrl + B`: Asigna el valor marcado `<En Blanco>` al campo activo.
    - `Ctrl + D`: Copia en el campo activo el valor del mismo campo de la partida anterior.
- **[REQ-MULTI-05] Flujo de Guardado y Avance:**
  - *Al pulsar* `Ctrl + Enter` (Guardar), *el sistema deberá* guardar la partida activa y avanzar a la siguiente partida del mismo folio. Si se guarda la última partida de la página, avanzará al siguiente folio de la cola.

### 3.3. Paquete de Entrega e Interoperabilidad FamilySearch (DIP)

- **[REQ-EXP-01] Paquete ZIP Consolidado:**
  - *El sistema deberá* permitir generar la exportación de un Tomo completo en formato `.ZIP` comprimido en streaming que contenga:
    1. `matriz_indexacion.xlsx`: Hoja de cálculo estilizada con columnas normalizadas y columna mandatoria `image_file_name`.
    2. `matriz_indexacion.csv`: Archivo delimitado por punto y coma (BOM UTF-8, `sep=;\r\n`).
    3. `manifest.json`: Ficha técnica con metadatos del tomo, total de folios, total de partidas, fecha de expedición y tenant emisor.
    4. `export_gedcom.ged`: Archivo genealógico conforme al estándar internacional GEDCOM 5.5.1 con registros `INDI` y eventos `CHR` / `BIRT` / `MARR` / `DEAT`.
- **[REQ-EXP-02] Nomenclatura Canónica de Imágenes:**
  - *El sistema deberá* generar los nombres normalizados de archivo bajo el patrón canónico `[CodOrg]_[Serie]_[Tomo]_[Folio].[ext]`, preservando el nombre de captura original en los metadatos del manifiesto para auditoría.
- **[REQ-EXP-03] Reporte de Control de Calidad Previo:**
  - *Al solicitar la exportación*, *el sistema deberá* mostrar un resumen de control de calidad indicando el porcentaje de partidas completadas y alertando sobre cuántas permanecen en estado "Dudoso / Revisión".
- **[REQ-EXP-04] Streaming de Entrega de Imágenes:**
  - *Para la descarga de fotos del tomo*, *el sistema deberá* procesar los archivos en streaming o mediante URLs seguras por lotes para no exceder la memoria RAM del servidor.

---

## 4. Criterios de Aceptación y Casos Límite

1. **Aislamiento Multi-Tenant Estricto:** Toda carpeta o tomo creado pertenece exclusivamente al `tenant_id` autenticado con RLS estricto.
2. **Resiliencia ante Folios Huérfanos:** Los folios subidos antes de la creación de carpetas permanecen accesibles en una vista de "Folios sin clasificar" y pueden ser reasignados a un tomo en cualquier momento sin pérdida de datos.
3. **Coherencia de Nomenclatura:** Los nombres de archivo exportados en el Excel deben coincidir de forma idéntica con los nombres de archivo almacenados en Cloudflare R2.
