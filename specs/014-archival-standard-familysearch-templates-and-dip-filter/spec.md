# SPEC-014: Estándar Archivístico, Foliación Recto/Vuelto, Plantillas Maestras FamilySearch y Filtro Estricto DIP

## 1. Visión General y Propósito

Esta especificación consolida la integridad archivística y genealógica de **CodexFlow** para alinearlo al 100% con los estándares internacionales de preservación de **FamilySearch** y los archivos históricos eclesiásticos/civiles. Resuelve de forma definitiva:
1. **La Foliación Archivística Tridimensional:** Desacopla el número correlativo de imagen digital del número de **Folio Físico**, su orientación de cara (**Recto / Vuelto**) y el **Número de Acta/Partida**.
2. **Plantillas Oficiales Completas de FamilySearch:** Provee esquemas canónicos preconfigurados y exhaustivos para Bautismo/Nacimiento, Matrimonio y Defunción/Entierro con todos los campos de filiación y sacramentales.
3. **Filtro Estricto de Exportación DIP:** Asegura que el paquete exportado (`.ZIP`, Excel `matriz_indexacion.xlsx`, CSV, GEDCOM y subcarpeta `images/`) incluya **exclusivamente partidas en estado `completed` (o `verified`)**, excluyendo folios o partidas vacías o pendientes (`pending`).
4. **Reparación del Explorador de Registros (`/records`):** Elimina el bloqueo por consulta infinita y permite listar, buscar y visualizar las partidas completadas vinculadas a sus tomos y folios.

---

## 2. Requisitos Funcionales en Sintaxis EARS

### 2.1 Foliación Archivística y Número de Acta
- **[EARS-001] Diferenciación de Folio Físico y Cara (Recto/Vuelto):**
  - *Cuando* un operador indexe una partida en un folio, *el sistema deberá* permitir registrar el número de folio físico (`folio_number`, ej. 14) y la cara de la hoja (`folio_side`: `'recto'` [`r`] o `'vuelto'` [`v`]).
- **[EARS-002] Número Correlativo de Acta / Partida:**
  - *Cuando* se agregue una partida dentro de un folio, *el sistema deberá* capturar el número de acta (`act_number`, ej. *Acta N° 45*) o permitir marcar `[ ] Sin Número`.
- **[EARS-003] Continuación de Partida Interfolio:**
  - *Si* un acta física comienza al pie de una página y concluye en la página siguiente, *el sistema deberá* permitir marcar `is_continued: true` con referencia al folio anterior/siguiente para preservar la unidad documental legal.

### 2.2 Plantillas Maestras Estandarizadas FamilySearch
- **[EARS-004] Plantilla Maestra de Bautismo / Nacimiento:**
  - *El sistema deberá* proveer una plantilla institucional inmutable con los campos:
    - Datos del Infante: Nombres, Apellidos, Sexo, Fecha de Nacimiento, Fecha de Bautismo/Registro, Lugar de Nacimiento.
    - Filiación: Padre, Madre, Abuelos Paternos (abuelo y abuela), Abuelos Maternos (abuelo y abuela), Naturaleza/Origen de los padres.
    - Ministros y Testigos: Sacerdote/Oficial, Padrino, Madrina, Testigos.
    - Notas Marginales: Anotaciones de legitimación, matrimonio posterior o confirmación.
- **[EARS-005] Plantilla Maestra de Matrimonio:**
  - *El sistema deberá* proveer campos para: Fecha de Matrimonio, Contrayente Masculino (nombres, apellidos, edad, estado civil previo, origen, padres), Contrayente Femenina (nombres, apellidos, edad, estado civil previo, origen, padres), Padrinos, Testigos y Celebrante.
- **[EARS-006] Plantilla Maestra de Defunción / Entierro:**
  - *El sistema deberá* proveer campos para: Fecha de Defunción, Fecha de Entierro, Nombres y Apellidos del Difunto, Sexo, Edad, Causa de Muerte, Estado Civil, Cónyuge (si aplica), Padres (si se mencionan), Lugar de Sepultura/Cementerio y Ministro.

### 2.3 Filtro Estricto en el Motor de Exportación DIP
- **[EARS-007] Exclusión Rigurosa de Registros Pendientes:**
  - *Cuando* se invoque `GET /api/v1/folders/{id}/export-familysearch`, *el sistema deberá* filtrar las partidas donde `status IN ('completed', 'verified')`.
  - *El sistema NO deberá* incluir en `matriz_indexacion.xlsx`, ni en el CSV, ni en `export_gedcom.ged` ninguna fila con `status == 'pending'` o campos vacíos.
- **[EARS-008] Empaquetado Selectivo de Imágenes en Paquete DIP Integral:**
  - *Si* se selecciona la opción de exportación integral con imágenes (`include_images=True`), *el sistema deberá* incluir en la carpeta `images/` únicamente aquellas fotografías digitales que contengan al menos un acta completada, omitiendo imágenes del tomo que aún no hayan sido transcritas.
- **[EARS-009] Manifiesto de Calidad con Trazabilidad Completa:**
  - *El sistema deberá* reflejar en `manifest.json`:
    - `total_tome_folios`: total de imágenes del libro.
    - `exported_entries_count`: total de actas completadas incluidas en el archivo.
    - `excluded_pending_folios`: cantidad de páginas que quedaron fuera por estar incompletas.

### 2.4 Explorador de Registros (`/records`)
- **[EARS-010] Desacoplamiento de Carga y Paginación Optimizada:**
  - *Cuando* el usuario acceda a `/[subdomain]/records`, *el sistema deberá* ejecutar una consulta paginada (límite 20 por página) trayendo exclusivamente las actas completadas con su tomo y folio asociado, evitando bloqueos de carga indefinida.

---

## 3. Modelo de Datos y Esquema

### 3.1 Extensión de `folio_entries` y `folios`
* En `public.folio_entries`:
  * `act_number`: TEXT (ej. "45", "S/N")
  * `folio_number`: INT (Número físico de folio en el libro)
  * `folio_side`: VARCHAR(10) (Valores: 'recto', 'vuelto', 'unica')
  * `is_continued`: BOOLEAN DEFAULT FALSE
  * `continued_from_entry_id`: UUID (opcional)
* En `document_folders`:
  * Metadato de plantilla predeterminada del tomo.

---

## 4. Criterios de Aceptación (Definición de Terminado)
- [ ] La interfaz del visor permite indicar Folio Físico (ej. 12), Lado (Recto/Vuelto) y Número de Acta.
- [ ] Las 3 plantillas canónicas completas de FamilySearch están disponibles y creadas para cada organización.
- [ ] El archivo Excel descargado solo contiene filas con datos reales de personas en estado `completed`.
- [ ] La pantalla `/records` carga en menos de 1 segundo mostrando la lista de actas indexadas.
