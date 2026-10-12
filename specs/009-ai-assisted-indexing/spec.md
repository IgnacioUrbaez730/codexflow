# Especificación: 009 - Indexación Asistida por Inteligencia Artificial (AI-Assisted Indexing)

## 1. Visión General y Propósito

El módulo de **Indexación Asistida por IA** amplía las capacidades de digitalización y catalogación de libros parroquiales y documentos históricos en CodexFlow. Su objetivo es acelerar la extracción de metadatos (nombres, fechas, sacramentos, lugares, padrinos/testigos) reduciendo el esfuerzo cognitivo del operador mediante predicciones visuales y prellenado inteligente, manteniendo al humano como autoridad final de validación (Human-in-the-Loop) y retroalimentando los modelos mediante Aprendizaje Activo (Active Learning).

---

## 2. Roles de Usuario y Permisos

- **Archivista / Catalogador**:
  - Visualiza sugerencias de IA en el formulario y bounding boxes en el visor de imágenes.
  - Edita, confirma o descarta valores sugeridos.
  - Alterna la visualización de capas de IA (`Alt + A`) y centra vistas (`Alt + C`).
  - Consulta métricas básicas de precisión de IA en sus sesiones de trabajo.
- **Administrador**:
  - Configura umbrales de confianza mínima de IA (predeterminado 80%).
  - Accede al panel de métricas de precisión global, tasa de corrección y dataset de `training_data`.
  - Exporta datos de entrenamiento generados por discrepancias usuario-IA.
- **Sistema / Pipeline de IA**:
  - Genera predicciones estructuradas con coordenadas geométricas normalizadas, texto extraído y porcentaje de confianza.
  - Registra eventos de discrepancia para reentrenamiento de modelos OCR/NER.

---

## 3. Requisitos Funcionales en Sintaxis EARS (Easy Approach to Requirements Syntax)

### 3.1 Prellenado Inteligente del Formulario

- **[EARS-001] Prellenado Condicional por Umbral de Confianza**
  - *Cuando* se cargue un folio con predicciones de IA disponibles, *el sistema deberá* prellenar automáticamente los campos del formulario únicamente si el nivel de confianza de la predicción es superior o igual al 80% (`confidence >= 0.80`) y el valor cumple con las reglas de validación sintáctica del campo (ej. fechas en formato ISO válido).
- **[EARS-002] Campo Vacío ante Baja Confianza o Invalidez**
  - *Si* la confianza de una predicción de IA es inferior al 80% (`confidence < 0.80`) o el valor extraído no supera la validación estructural (ej. fecha mal formada o truncada), *el sistema deberá* dejar el campo del formulario en blanco para evitar inducción a error o sesgo de confirmación en el operador.
- **[EARS-003] Insignia Visual y Borde de Origen IA**
  - *Mientras* un campo contenga un valor derivado de prellenado de IA sin modificar por el operador, *el sistema deberá* renderizar una insignia sutil verde con el texto `IA: X%` y un contorno/borde contextual verde tenue.
- **[EARS-004] Edición y Mutabilidad de Campos Sugeridos**
  - *Cuando* el usuario edite o ingrese manualmente un valor en un campo prellenado por IA, *el sistema deberá* actualizar el valor del campo, cambiar el estado del indicador a editado por el usuario y preservar la sugerencia original de la IA en memoria para propósitos de auditoría y aprendizaje activo.

### 3.2 Visualización de Bounding Boxes (Cajas Delimitadoras)

- **[EARS-005] Renderizado de Cajas Delimitadoras Semitransparentes**
  - *Mientras* la capa de IA esté habilitada en el visor, *el sistema deberá* renderizar recuadros semitransparentes (bounding boxes) con bordes delgados azul/verde sobre las regiones de la imagen correspondientes a los campos extraídos.
- **[EARS-006] Resaltado Reactivo al Foco del Formulario**
  - *Cuando* un campo del formulario reciba foco (mediante teclado `Tab` o clic), *el sistema deberá* iluminar la caja delimitadora asociada en color amarillo de alto contraste (`#F59E0B` / `#EAB308`) y destacar su contorno.
- **[EARS-007] Inserción Directa por Clic en Bounding Box**
  - *Cuando* el operador haga clic directamente sobre una caja delimitadora en el visor, *el sistema deberá* transferir de inmediato el texto asociado a dicha caja al campo del formulario que se encuentre actualmente activo/enfocado.
- **[EARS-008] Compensación Geométrica ante Rotación**
  - *Cuando* la imagen del folio sea rotada en el visor (90°, 180°, 270°), *el sistema deberá* recalcular y transformar las matrices de coordenadas de todas las cajas delimitadoras para mantener su alineación matemática exacta con el texto de la imagen rotada.
- **[EARS-009] Sincronización con la Lupa Óptica (Spec 006)**
  - *Mientras* la Lupa Óptica (Spec 006) esté activa sobre la imagen, *el sistema deberá* proyectar de forma escalada y sin artefactos las cajas delimitadoras y sus resaltados dentro del lente magnificador.

### 3.3 Auto-Enfoque y Ergonomía Visual

- **[EARS-010] Centrado Automático en Navegación con Tab**
  - *Cuando* el usuario navegue secuencialmente entre campos del formulario y el zoom manual actual del visor sea menor o igual a 2.5x (`zoom <= 2.5x`), *el sistema deberá* animar y centrar suavemente la cámara del visor sobre las coordenadas de la caja delimitadora correspondiente al campo activo.
- **[EARS-011] Preservación de Encuadre ante Alto Zoom**
  - *Si* el zoom manual actual del visor es superior a 2.5x (`zoom > 2.5x`), *el sistema deberá* resaltar la caja delimitadora en amarillo sin desplazar abruptamente la cámara ni alterar las coordenadas del viewport, protegiendo al operador de mareos o pérdida de orientación espacial.
- **[EARS-012] Atajos de Teclado Globales**
  - *Cuando* el usuario presione `Alt + A`, *el sistema deberá* alternar la visibilidad de la capa completa de IA (On/Off).
  - *Cuando* el usuario presione `Alt + C`, *el sistema deberá* centrar forzosamente la cámara del visor en la caja delimitadora del campo actualmente activo, independientemente del nivel de zoom actual.

### 3.4 Resiliencia y Modo Degradado

- **[EARS-013] Operación Fluida en Modo Degradado (Sin IA / OCR Nulo)**
  - *Si* un folio carece de predicciones de IA (documento deteriorado, fallo temporal del servicio OCR/NER, o proceso no ejecutado), *el sistema deberá* operar en modo de indexación 100% manual con latencia normal, sin alertas intrusivas, sin errores de renderizado en consola y sin bloquear el formulario ni el visor.

### 3.5 Aprendizaje Activo (Active Learning) y Métricas

- **[EARS-014] Registro Silencioso de Discrepancias**
  - *Cuando* el usuario guarde el registro mediante `Ctrl + Enter` o botón de confirmación, *el sistema deberá* evaluar si el valor final introducido por el humano difiere de la sugerencia original de la IA; de existir discrepancia o corrección, *el sistema deberá* registrar silenciosamente una entrada en la tabla `training_data` con el texto de la IA, el texto corregido, las coordenadas espaciales, el folio y metadatos del modelo.
- **[EARS-015] Métricas de Rendimiento en Dashboard**
  - *El sistema deberá* proporcionar a los roles Administrador y Archivista un panel de métricas con la tasa de aceptación sin cambios (% prellenado aceptado intacto), tasa de corrección por tipo de campo, y precisión promedio por modelo/lote.

---

## 4. Casos Límite y Consideraciones de Borde

1. **Documentos con Orientación Mixta o Sesgo Angular**:
   - Folios escaneados torcidos o con rotación no ortogonal: las coordenadas poligonales o bounding boxes rotadas deben transformarse mediante matrices afines sin desbordar el contenedor SVG/Canvas.
2. **Campos con Múltiples Detecciones Competidoras**:
   - Casos donde el modelo detecta dos nombres potenciales (ej. "hijo legítimo de Juan y María"): el campo prellena la hipótesis con mayor confianza (`confidence`), mientras que ambas bounding boxes permanecen clickeables en el visor para permitir selección manual con un clic.
3. **Fechas con Formatos Ambigüos o Parciales**:
   - Expresiones coloniales como "a cinco días del mes de...": si el parser de fechas no puede inferir un ISO válido (`YYYY-MM-DD` o fecha parcial estructurada), el campo se mantiene vacío con confianza descartada, pero la caja de texto permanece visible en la imagen.
4. **Pérdida de Conexión o Fallo de Red Durante Guardado**:
   - El guardado de la indexación principal es transaccionalmente prioritario. El envío de registros a `training_data` debe encolarse en búfer local o procesarse de forma asíncrona no bloqueante para no interrumpir el flujo del archivista.
5. **Zoom Ultra Rápido o Ráfaga de Tabs**:
   - Navegación rápida con la tecla `Tab`: las transiciones de centrado de cámara deben contar con debounce/cancelación de animaciones en curso (`requestAnimationFrame` / `abortController`) para evitar sacudidas visuales.

---

## 5. Criterios de Aceptación (Definición de Terminado)

- [ ] Las predicciones con `confidence >= 0.80` y sintaxis válida se prellenan con indicador visual `IA: X%`.
- [ ] Las predicciones con `confidence < 0.80` o con errores de formato dejan el campo en blanco.
- [ ] Todos los bounding boxes se renderizan semitransparentes en visor y se sincronizan con la Lupa Óptica.
- [ ] Al enfocar un campo del formulario, su caja delimitadora se resalta en amarillo.
- [ ] Con zoom `<= 2.5x`, el foco en campo centra suavemente la cámara; con zoom `> 2.5x`, la cámara no se mueve a menos que se invoque `Alt + C`.
- [ ] `Alt + A` apaga/enciende las capas de IA en menos de 50ms sin re-renderizar la imagen base.
- [ ] Un clic sobre un bounding box inserta su texto en el campo activo al instante.
- [ ] Rotaciones de 90°, 180° y 270° mantienen perfecta alineación de las cajas con la imagen.
- [ ] En folios sin predicción, la interfaz se comporta exactamente igual que la indexación manual sin mostrar errores.
- [ ] Guardar con `Ctrl + Enter` almacena el registro y persiste discrepancias en `training_data` de forma silenciosa.
- [ ] El Dashboard muestra las métricas de precisión y corrección accesibles para Admin y Archivista.
