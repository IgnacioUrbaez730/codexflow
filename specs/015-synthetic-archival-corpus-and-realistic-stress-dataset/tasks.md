# Lista de Tareas Técnicas (Tasks) - SPEC-015: Corpus Paleográfico Realista, Variantes de Estrés Archivístico y Dataset de Entrenamiento

## Fase 1: Especificación del Catálogo y Generación de Metadatos Canónicos
- [x] 1.1 Crear el archivo de catálogo declarativo `tools/seeding/corpus_manifest.json` con la definición estructural de los 60 folios.
- [x] 1.2 Definir los metadatos de los 20 folios de Bautismos (Tomo 1: 1885-1890) con balance 10 completados y 10 pendientes.
- [x] 1.3 Definir los metadatos de los 20 folios de Matrimonios (Tomo 1: 1885-1895) con balance 10 completados y 10 pendientes.
- [x] 1.4 Definir los metadatos de los 20 folios de Defunciones (Tomo 1: 1885-1892) con balance 10 completados y 10 pendientes.
- [x] 1.5 Incorporar en el manifiesto los casos especiales de estrés:
  - [x] 1.5.1 Doble página (apertura de libro, F006DP y F007DP en cada serie).
  - [x] 1.5.2 Partidas continuadas interfolio con marcadores `is_continued` y `continued_from_entry_id` (F008V a F009R).
  - [x] 1.5.3 Folios con degradación visual (tinta desvaída y manchas de humedad) en F010 a F012.
  - [x] 1.5.4 Folios con texto mutilado o dudoso para validación de `Ctrl + U` en F013 y F014.
  - [x] 1.5.5 Folios en blanco / autos de visita para validación de `Ctrl + B` en F015R.
  - [x] 1.5.6 Partidas con notas marginales densas en F016 y F017.

## Fase 2: Pipeline de Imágenes Paleográficas y Almacenamiento en Cloudflare R2
- [x] 2.1 Configurar el script de carga de imágenes `tools/seeding/upload_corpus_to_r2.py`.
- [x] 2.2 Implementar soporte para conexión y autenticación con Cloudflare R2 / S3 Storage mediante variables de entorno (`R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT_URL`).
- [x] 2.3 Generar y estructurar las 60 imágenes paleográficas en alta resolución bajo la convención `[ORG]_[SERIE]_T[NUM]_F[FOLIO][CARA].jpg`:
  - [x] 2.3.1 20 imágenes de Bautismo (`CARUPANO_BAU_T01_F001R.jpg` a `CARUPANO_BAU_T01_F020V.jpg`).
  - [x] 2.3.2 20 imágenes de Matrimonio (`CARUPANO_MAT_T01_F001R.jpg` a `CARUPANO_MAT_T01_F020V.jpg`).
  - [x] 2.3.3 20 imágenes de Defunción (`CARUPANO_DEF_T01_F001R.jpg` a `CARUPANO_DEF_T01_F020V.jpg`).
- [x] 2.4 Ejecutar la sincronización hacia el bucket `codexflow-folios/corpus/` asegurando URLs públicas accesibles y cabeceras de cache adecuadas.
- [x] 2.5 Actualizar las URLs de imágenes resueltas dentro de `corpus_manifest.json`.

## Fase 3: Script de Seeding Idempotente en Base de Datos
- [x] 3.1 Crear el script orquestador `tools/seeding/seed_realistic_corpus.py`.
- [x] 3.2 Implementar el mecanismo de purga segura `--clean` para limpiar los tomos y folios del corpus de demostración en `codexflow-folios` sin alterar otras organizaciones.
- [x] 3.3 Implementar creación y verificación de los 3 Tomos oficiales asociados a la organización `codexflow-folios` y sus plantillas canónicas.
- [x] 3.4 Implementar la inserción en masa/atómica de los 60 registros en la tabla `folios`.
- [x] 3.5 Implementar la inserción de las partidas completadas en la tabla `entries` con JSON canónico validado para FamilySearch:
  - [x] 3.5.1 Inserción de partidas completadas de Bautismo con relaciones familiares (padres, padrinos, abuelos).
  - [x] 3.5.2 Inserción de partidas completadas de Matrimonio con contrayentes, progenitores, testigos y proclamas.
  - [x] 3.5.3 Inserción de partidas completadas de Defunción con causa de muerte, sepultura y cónyuge.
- [x] 3.6 Implementar la resolución de enlaces de partidas continuadas (`is_continued = true`, `continued_from_entry_id`).
- [x] 3.7 Soporte para argumentos CLI: `--type [bautismo|matrimonio|defuncion|all]`, `--count [10|20]`, y `--dry-run`.

## Fase 4: Validación Funcional de la Casuística en el Frontend y Exportación
- [ ] 4.1 Validar la visualización del Árbol de Ingesta en `/ingest`:
  - [ ] 4.1.1 Comprobar que los 3 Tomos aparecen con conteo exacto de 20 folios cada uno.
  - [ ] 4.1.2 Comprobar que los estados (`completed`, `pending`, `blank`) se reflejan en los indicadores visuales.
- [ ] 4.2 Validar la experiencia en el Visor Dual (`/visor`):
  - [ ] 4.2.1 Comprobar carga fluida de imágenes en alta resolución con zoom y navegación pan.
  - [ ] 4.2.2 Probar Lupa Interactiva (`L`) y filtros de contraste sobre folios con degradación (F010-F012).
  - [ ] 4.2.3 Validar atajo `Ctrl + U` y botón *Marcar Dudoso* sobre folios mutilados (F013-F014).
  - [ ] 4.2.4 Validar atajo `Ctrl + B` (*Folio en blanco/sin partidas*) sobre F015R.
  - [ ] 4.2.5 Probar navegación y transcripción en aperturas de doble página (F006DP y F007DP).
  - [ ] 4.2.6 Probar visualización y continuidad de partidas interfolio (F008V a F009R).
- [ ] 4.3 Validar el flujo de exportación de datos:
  - [ ] 4.3.1 Probar exportación DIP y verificación de integridad genealógica.
  - [ ] 4.3.2 Probar exportación a Excel y CSV asegurando que únicamente las partidas completadas se emiten limpiamente sin errores de campos nulos.
