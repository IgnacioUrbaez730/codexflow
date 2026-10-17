# SPEC-015: Corpus Paleográfico Realista, Variantes de Estrés Archivístico y Dataset de Entrenamiento

## 1. Contexto y Justificación
Para demostrar la robustez del SaaS CodexFlow ante instituciones eclesiásticas, archivísticas y FamilySearch, se requiere un corpus sintético de alta fidelidad visual e histórica. La digitalización real de libros sacramentales (siglos XVIII al XX) presenta una amplia casuística operativa: folios con tinta desvaída, manchas, aperturas dobles (2 páginas en 1 toma), partidas continuadas entre caras, folios cancelados/en blanco y lecturas dudosas o ilegibles.

Este módulo define la generación, estructuración y aprovisionamiento aislado de un corpus realista de entre 20 y 25 folios por cada una de las 3 series sacramentales canónicas (Bautismo, Matrimonio y Defunción), alcanzando un total de hasta 60 a 75 folios documentales con sus correspondientes metadatos de calibración.

## 2. Requerimientos Funcionales

### RF-01: Generación de Imágenes Paleográficas con GenAI
- Generación de imágenes en alta resolución con textura de papel de época, tinta ferrogálica y caligrafía cursiva histórica española/latinoamericana (siglo XIX).
- Almacenamiento aislado en `tools/seeding/corpus/` sin engrosar el bundle de producción de Next.js ni el contenedor FastAPI de Render.
- Formatos: JPG / WebP con dimensiones optimizadas para visualización rápida y zoom fluido.

### RF-02: Catálogo de Variantes y Casuística Archivística
Para cada tipo de documento (Bautismo, Matrimonio, Defunción), el corpus debe distribuir de forma equilibrada los siguientes escenarios:
1. **Estándar Canónico:** Acta íntegra legible en una sola cara (Recto o Vuelto).
2. **Doble Página (Apertura de Libro):** Una toma fotográfica que contiene tanto la página izquierda (Vuelto) como la derecha (Recto), probando la segmentación o transcripción multi-partida.
3. **Continuación Interfolio (`is_continued = true`):** Partida que inicia en el folio anterior y concluye en el actual, referenciando `continued_from_entry_id`.
4. **Desgaste / Dificultad Paleográfica:** Tinta desvaída, oxidación moderada o manchas de humedad que exijan el uso de la Lupa Interactiva (`L`), contraste invertido o binarización.
5. **Dudoso / Ilegible:** Campos con texto mutilado o borroso que motiven el uso de los atajos `Ctrl + U` (`<Ilegible>`) o el botón *"Marcar Dudoso"*.
6. **Folio en Blanco / Sin Partidas (`Ctrl + B`):** Páginas con notas de apertura, cierre de año, o sin inscripciones.
7. **Folio Único (`unica`):** Expediente suelto encuadernado.

### RF-03: Asignación a Tomos Oficiales y Plantillas FamilySearch
- Creación de 3 tomos representativos en la organización de demostración (`codexflow-folios`):
  1. *Libro 1 de Bautismos (1885-1890)* -> Enlazado a la plantilla oficial de Bautismo.
  2. *Libro 1 de Matrimonios (1885-1895)* -> Enlazado a la plantilla oficial de Matrimonio.
  3. *Libro 1 de Defunciones (1885-1892)* -> Enlazado a la plantilla oficial de Defunción.
- Vinculación estricta de las partidas completadas con los esquemas canónicos de FamilySearch.

### RF-04: Balance de Estados (Completadas vs Pendientes)
- Alrededor del 40%-50% de las partidas estarán en estado `completed` con transcripción humana perfecta para alimentar la exportación DIP y matrices Excel/CSV/GEDCOM.
- El 50%-60% restante estará en estado `pending` para permitir demostraciones y prácticas interactivas en vivo durante la presentación.

### RF-05: Tooling Aislado e Idempotente
- Script ejecutable en `tools/seeding/seed_realistic_corpus.py`.
- Soporte para parámetros `--clean`, `--type [bautismo|matrimonio|defuncion|all]` y `--count [15|20|25]`.
- Respaldo de metadatos en JSON para re-ejecución instantánea sin re-generar imágenes innecesariamente.

## 3. Criterios de Aceptación
1. Cero imágenes de prueba ajenas a la temática (logos, fotos personales o documentos modernos) en la base de datos de folios.
2. Cada tomo en el Árbol de Carpetas (`/ingest`) muestra su conteo fiel de folios y permite la exportación DIP limpia con cero folios pendientes en Excel/CSV.
3. El Visor Dual (`/visor`) carga fluidamente las imágenes paleográficas y permite probar la lupa, rotación, atajos y cambio de caras sin errores de renderizado.
