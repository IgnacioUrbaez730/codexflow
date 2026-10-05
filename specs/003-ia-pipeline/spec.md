# Spec 003: Pipeline de Inteligencia Artificial (Active Learning)

## 1. Objetivo
Implementar el motor asíncrono de Inteligencia Artificial en el Backend (FastAPI). Este motor debe analizar los folios procesados, extraer la información mediante Bounding Boxes y pre-llenar los formularios para reducir la carga de trabajo del digitador. Además, debe capturar las correcciones humanas para re-entrenarse en el futuro (Active Learning).

## 2. Requisitos Funcionales (Borrador)
- **RF-1 (Inferencia Automática):** Una vez que el Worker (T5) finaliza la generación del DZI, debe disparar la petición de inferencia de IA sobre la imagen original.
- **RF-2 (Ergonomía de Bounding Boxes):** Toda predicción de la IA devolverá texto y Coordenadas (`[xmin, ymin, xmax, ymax]`). En el Frontend, estos recuadros funcionarán como una **ayuda visual reactiva estática**. Para cumplir la regla de "Eficiencia Extrema" (cero ratón), cuando el digitador haga foco (Tab) en un campo del formulario (ej. "Nombre"), el visor OpenSeadragon automáticamente iluminará o hará zoom hacia el recuadro correspondiente en la imagen.
- **RF-3 (Mapeo por Patrones - Regex):** Para cruzar la data cruda de Tesseract OCR con los campos específicos de la plantilla dinámica, se utilizará una lógica basada en **Expresiones Regulares (Regex)** y palabras clave configuradas por el Administrador en el esquema de la plantilla (ej. buscar formatos de fecha, o texto próximo a la palabra "Nombre").
- **RF-4 (Umbrales de Confianza):** 
  - Alta Confianza (>90% y match de Regex fuerte): Se pre-llena el input del formulario automáticamente.
  - Baja Confianza (<90% o match ambiguo): Se muestra como una "Sugerencia" visual en la bandeja de dudosos.
- **RF-5 (Bucle de Aprendizaje Activo):** Cuando el Archivista pulsa `Ctrl+Enter` (Guardar), si el valor guardado es diferente al predicho por la IA, esa corrección se guarda en una tabla `training_data` ligada al `tenant_id` para futuros Fine-Tunings.

## 3. Arquitectura y Casos Límite
- **Modelo de Inferencia:** Se utilizará un modelo de IA local ultraligero (**Tesseract OCR**) para respetar la limitación de 512MB de RAM del plan gratuito de Render.
- **Escalabilidad y Despliegue:** El backend se empaquetará mediante un `Dockerfile` para poder instalar las dependencias del sistema operativo (Poppler, Tesseract) directamente en Render.
- **Almacenamiento Espacial (DB):** Las predicciones en bruto de la IA (texto, confianza y coordenadas `[x1, y1, x2, y2]`) se almacenarán comprimidas en una nueva columna de tipo **JSONB** (ej. `ai_predictions`) dentro de la tabla `folios`. Esto evita la sobrepoblación de filas en la base de datos y optimiza la lectura desde el Frontend.

## 4. Roadmap / Actualizaciones Futuras (Backlog V2)
Para preservar la visión original del producto a medida que escale a infraestructura de pago, quedan documentadas las siguientes tareas pendientes a futuro:
- **Actualización de Motor:** Reemplazo de Tesseract por modelos neuronales profundos especializados en escritura a mano (ej. Donut, TrOCR).
- **Active Learning Real (Fine-Tuning):** Implementar un pipeline offline o asíncrono que consuma la tabla `training_data` recolectada para re-entrenar los pesos del modelo neuronal de forma automatizada por cada `tenant_id`, logrando que la IA mejore su precisión con cada corrección humana.
