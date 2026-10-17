# SPEC-016: Rediseño Jerárquico del Explorador de Registros (`/records`), Filtrado por Tomos/Carpetas y Visibilidad Multi-Estado

## 1. Contexto y Problema Actual
Actualmente, la pantalla del Explorador de Registros (`/[subdomain]/records`) presenta tres limitaciones estructurales heredadas de las primeras fases del MVP:
1. **Filtro obsoleto por "Lotes" (`batch_id`):** Los usuarios ven un selector de "Lotes" con identificadores técnicos en lugar de la estructura archivística real implementada en el sistema (`Diócesis ➔ Parroquia ➔ Serie ➔ Tomo/Libro`).
2. **Ocultamiento de folios no completados:** El endpoint `GET /api/v1/records` fuerza internamente `.in_("status", ["completed", "verified"])`, impidiendo consultar qué folios o partidas están en estado `pending` (pendientes de transcribir), `in_progress` (en curso) o `revision` (dudosos/observados) dentro de un libro.
3. **Escalabilidad ante múltiples libros:** Cuando una organización gestione decenas o cientos de libros parroquiales, un listado plano sin agrupación jerárquica ni filtrado por serie/tomo dificulta localizar actas o auditar el avance de un libro específico.

## 2. Objetivos de Negocio y Producto
- **Sustitución de "Lote" por Selectores en Cascada (DCam):** Permitir filtrar primero por **Serie / Carpeta Documental** (Todas, Bautismos, Matrimonios, Defunciones, Sin Clasificar) y luego por **Tomo / Libro**.
- **Visibilidad Total de Estados y Barra de Contadores en Vivo:** Mostrar por defecto `"Todos los estados"` junto con una barra superior de tarjetas/píldoras interactivas (`Total`, `Completados`, `Verificados`, `Pendientes`, `Dudosos / Revisión`) que actúen como filtros rápidos.
- **Orden Archivístico Natural:** Listar por defecto siguiendo el orden físico del libro (`Tomo` ➔ `Folio Físico` `F.1r, F.1v, F.2r...` ➔ `N° de Partida`).
- **Acciones Contextuales y Arbitraje en Modal Detalle:** Ofrecer botón directo `"Transcribir en Visor"` para pendientes/dudosos y `"Detalle + Visor"` para completados/verificados, incluyendo botones de cambio de estatus (`Verificar`, `Enviar a Revisión`, `Devolver a Pendiente`) dentro del modal `"Detalle"`.

## 3.Decisiones Consensuadas en Fase de Clarificación (Triple Filtro QA — 15 Respuestas)

### Ronda 1: Estructura Jerárquica, Estados y Vista Inicial
1. **Navegación de Carpetas y Libros:** Dos selectores en cascada: **Serie / Carpeta** (`Todas`, `Bautismos`, `Matrimonios`, `Defunciones`, `Sin Clasificar`) y luego **Tomo / Libro**.
2. **Estado por Defecto:** Mostrar **`Todos los estados`** por defecto al entrar a `/records` para visualizar de inmediato tanto lo completado como lo pendiente.
3. **Representación de Folios Pendientes:** Mostrar etiqueta clara `"⏳ Pendiente de transcripción"` junto al código canónico del archivo (`CARUPANO_BAU_T01_F011V.jpg`).
4. **Botones de Acción Contextuales:** Mostrar botón directo **`Transcribir en Visor`** para registros `pending` / `revision` / `in_progress`, y **`Detalle` + `Visor`** para `completed` / `verified`.
5. **Folios Huérfanos ("Sin Clasificar"):** Incluir la opción `"Sin Clasificar"` en el filtro para que ningún folio suelto quede oculto en el sistema.

### Ronda 2: Contadores, Ordenamiento, Multi-Partida y Exportación
6. **Barra de Contadores Interactivos:** Mostrar arriba de la tabla los contadores en vivo de la selección actual (`Total`, `Completados`, `Verificados`, `Pendientes`, `Dudosos`) que además funcionen como filtros rápidos al hacer clic.
7. **Orden por Defecto:** Orden archivístico natural: por Tomo y luego por Folio Físico correlativo (`F.1r, F.1v, F.2r...`) y número de partida (`entry_number`).
8. **Visualización Multi-Partida:** Mostrar cada partida en su propia fila (como el índice del libro) con un indicador visual cuando varias pertenecen al mismo folio físico (ej. `F.3r · Partida 1`, `F.3r · Partida 2`).
9. **Folios en Blanco (`Ctrl + B`):** Mostrar un badge claro `"📄 Folio en Blanco / Sin Partidas"` en gris/azul tenue para distinguirlo de los pendientes y de las actas con personas.
10. **Sincronización con Exportación DIP:** Sincronizar automáticamente el botón `"Exportar Registros"` con el Tomo seleccionado en el filtro de la tabla (manteniendo la regla estricta de que el paquete DIP de FS solo exporta las completadas/verificadas).

### Ronda 3: Búsqueda Multicriterio, Fechas Históricas, Arbitraje y Rendimiento
11. **Alcance de Búsqueda:** Búsqueda integral: por nombre/apellido de persona principal, padres/cónyuges, número de acta, folio físico (ej. `F.14r`) o código canónico de archivo (`CARUPANO_BAU...`).
12. **Filtro de Fechas:** Filtrar por la **Fecha Histórica del Acta** (ej. `1885-01-01` a `1888-12-31`), permitiendo localizar registros por su periodo sacramental real.
13. **Acciones de Calidad en Modal "Detalle":** Dentro del modal `"Detalle"`, incluir botones de acción rápida para `Admin / Archivist / Evaluator`: **`✔ Aprobar / Verificar`** (`verified`), **`⚠ Enviar a Dudoso / Revisión`** (`revision`) y **`↩ Devolver a Pendiente`** (`pending`).
14. **Señalización Interfolio:** Mostrar una insignia **`↪ Continuación de folio anterior`** en las partidas con `is_continued = true`.
15. **Rendimiento y Carga Bajo Demanda:** Paginación rápida en servidor (`20`, `50` o `100` filas por página) sin precargar imágenes pesadas en la tabla; la URL firmada de R2 se carga bajo demanda únicamente al abrir el modal `"Detalle"` o al ir al `"Visor"`.
