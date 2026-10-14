# Especificación de Requerimientos: Gestión de Tomos/Carpetas e Interoperabilidad FamilySearch

**Identificador de Especificación:** `SPEC-012`  
**Versión:** 1.0.0  
**Fecha de Creación:** 2026-10-13  
**Estado:** Propuesta / En Clarificación SDD  
**Autor:** Agente Coordinador Antigravity (Flujo Spec-Driven Development)  

---

## 1. Resumen Ejecutivo y Propósito

El propósito de esta especificación es expandir el modelo de catalogación y entrega de CodexFlow para responder a los estándares operativos de proyectos internacionales de digitalización patrimonial (tales como los requeridos por **FamilySearch**, diócesis, archivos generales y notariales).

Esta especificación cubre dos pilares fundamentales:
1. **Agrupación Jerárquica Documental (Carpetas / Tomos / Libros):**
   Evolución del modelo de lotes hacia carpetas virtuales que reflejan la estructura real de un archivo físico (Fondo documental, Parroquia/Notaría, Serie, Tomo/Libro, Años). Proporciona la capacidad de organizar folios en tomos y asignar folios sueltos a carpetas existentes sin reiniciar lotes completos.
2. **Interoperabilidad y Paquete de Exportación FamilySearch (DIP - Dissemination Package):**
   Generación de paquetes de entrega estandarizados compuestos por:
   - Imágenes fotográficas en alta resolución con nomenclatura homologada (`image_file_name`).
   - Matriz de indexación normalizada en Excel (.xlsx) y CSV delimitado, donde cada registro indexado contiene el identificador y nombre exacto del archivo de imagen correspondiente.
   - Manifiesto estructurado de metadatos del tomo (Fondo, Diócesis, Parroquia, Fechas extremas, Tipo de registro).

---

## 2. Partes Interesadas (Stakeholders) y Actores

- **Archivista / Coordinador de Digitalización:** Responsable de crear las carpetas correspondientes a los libros físicos, asignar imágenes, supervisar el avance del tomo e incorporar folios sueltos/adicionales.
- **Indexador / Digitador:** Operador que transcribe los folios dentro del contexto de un libro específico, heredando metadatos generales (parroquia, libro, serie).
- **Auditor Externo / FamilySearch / Curia Diocesana:** Receptor final del paquete digitalizado que valida la integridad entre las fotos y la base de datos indexada.
- **Administrador / SuperAdmin:** Gestor de organizaciones que audita las cuotas de digitalización por tomo y fondo.

---

## 3. Requerimientos del Sistema (Sintaxis EARS)

### 3.1. Gestión Estructurada de Tomos y Carpetas (Inspirado en DCam)

- **[REQ-TOMO-01] Creación de Carpetas / Tomos:**
  - *El sistema deberá* permitir a los usuarios con rol Administrador y Archivista crear "Carpetas / Tomos" dentro de su organización (`tenant_id`), especificando:
    - Nombre del Tomo (ej. *Libro 3 de Bautismos*).
    - Serie Documental (Bautismos, Matrimonios, Defunciones, Confirmaciones, Notarial, Protocolos).
    - Entidad o Parroquia productora (ej. *Parroquia San José*).
    - Años extremos (Año inicial y Año final).
    - Número de Tomo / Libro físico y Ubicación (Caja/Estante).
    - Plantilla de indexación predeterminada asignada al tomo.
- **[REQ-TOMO-02] Ingesta Directa hacia un Tomo:**
  - *Cuando* el usuario suba archivos fotográficos en el Hub de Ingesta, *el sistema deberá* permitir seleccionar un Tomo/Carpeta existente como destino directo del lote de folios.
- **[REQ-TOMO-03] Incorporación de Folios Sueltos:**
  - *El sistema deberá* proveer una función para reasignar folios individuales o lotes sueltos hacia una Carpeta/Tomo existente sin alterar los folios ya indexados de ese tomo.
- **[REQ-TOMO-04] Herencia de Metadatos de Contexto:**
  - *Mientras* un folio pertenezca a un Tomo/Carpeta, *el sistema deberá* permitir que el formulario del Visor herede y prellene los metadatos comunes del tomo (ej. Nombre de la Parroquia, Años probables) sin obligar al transcriptor a repetirlos en cada página.

### 3.2. Múltiples Registros por Folio (Casos de Actas Parroquiales)

- **[REQ-MULTI-01] Soporte de Varias Partidas por Página:**
  - *El sistema deberá* permitir registrar múltiples unidades documentales (ej. 2 a 6 actas) asociadas al mismo folio/imagen física, indexando cada persona de forma independiente.
- **[REQ-MULTI-02] Vinculación con Imagen Primaria:**
  - *Cada* registro individual extraído *deberá* mantener la referencia exacta al archivo de imagen (`file_name` y `r2_url`) y al número de partida/secuencia dentro del folio.

### 3.3. Paquete de Entrega e Interoperabilidad FamilySearch (DIP)

- **[REQ-EXP-01] Matriz Normalizada Imagen-Datos:**
  - *El sistema deberá* generar una exportación consolidada en Excel (.xlsx) y CSV donde cada fila corresponda a una persona/acta indexada y contenga de forma mandatoria:
    - `image_file_name`: Nombre exacto del archivo digital fotográfico.
    - `folio_number`: Número o identificación del folio/página.
    - `entry_number`: Número de acta o partida.
    - Campos estandarizados según la serie (Nombres, Apellidos, Fechas normalizadas `YYYY-MM-DD`, Parentescos, Notas/Dudas).
- **[REQ-EXP-02] Manifiesto del Tomo (Manifest JSON / Dublin Core):**
  - *Al exportar un Tomo completo*, *el sistema deberá* generar un archivo de manifiesto con los metadatos del libro físico, total de imágenes, total de registros procesados, fecha de generación y firma de procedencia (`tenant_id`).
- **[REQ-EXP-03] Empaquetado y Descarga de Archivos de Imagen:**
  - *El sistema deberá* permitir la descarga o generación de enlaces de transferencia segura para el conjunto de imágenes que integran un tomo, preservando la nomenclatura que enlaza directamente con la matriz de datos.

---

## 4. Criterios de Aceptación y Casos Límite

1. **Aislamiento Multi-Tenant Estricto:** Toda carpeta o tomo creado pertenece exclusivamente al `tenant_id` autenticado con RLS estricto.
2. **Resiliencia ante Folios Huérfanos:** Los folios subidos antes de la creación de carpetas permanecen accesibles en una vista de "Folios sin clasificar" y pueden ser reasignados a un tomo en cualquier momento sin pérdida de datos.
3. **Coherencia de Nomenclatura:** Los nombres de archivo exportados en el Excel deben coincidir de forma idéntica con los nombres de archivo almacenados en Cloudflare R2.
