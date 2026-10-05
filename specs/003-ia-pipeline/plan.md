# Plan Técnico - Pipeline de IA (Spec 003)

## 1. Base de Datos (Supabase)
- **Modificación en tabla `folios`**: Añadir una columna `ai_predictions` de tipo `JSONB` para almacenar las predicciones en bruto (texto, nivel de confianza y bounding boxes).
- **Nueva tabla `training_data`**: 
  - Columnas requeridas: `id` (UUID), `tenant_id` (UUID - Clave para RLS), `folio_id` (UUID), `field_name` (Varchar), `predicted_value` (Text), `actual_value` (Text), `created_at` (Timestamp).
  - Políticas RLS (Row Level Security) obligatorias para asegurar el aislamiento de los datos por `tenant_id` y garantizar el multi-tenant absoluto (Constitución #1).

## 2. Backend (FastAPI)
- **Empaquetado (Dockerfile)**:
  - Crear o actualizar el `Dockerfile` del servicio backend para incluir la instalación de paquetes del sistema operativo requeridos para la inferencia local.
  - Instalar `tesseract-ocr` (y librerías de soporte gráfico) mediante el gestor de paquetes de la distribución base.
- **Background Task (Inferencia IA y Regex)**:
  - **OCR Local:** Una vez completada la generación DZI, la Background Task invocará `pytesseract` (Tesseract) sobre la imagen del folio original para extraer el texto y sus coordenadas en pantalla (`[xmin, ymin, xmax, ymax]`).
  - **Mapeo Inteligente (Regex):** Con la respuesta bruta de Tesseract, el sistema usará expresiones regulares (configuradas a nivel plantilla) para detectar formatos específicos (fechas, montos) y ubicar proximidad a palabras clave (ej. "Nombre:").
  - **Almacenamiento:** El output estructurado (con confianza y recuadros de coordenadas para cada campo mapeado) se escribirá en el JSONB `ai_predictions` del folio procesado.

## 3. Frontend (React / OpenSeadragon)
- **Consumo de Coordenadas (Overlays)**:
  - Al cargar un folio, el visor extraerá los bounding boxes de `ai_predictions`.
  - Se utilizará la funcionalidad de "Overlays" de OpenSeadragon para dibujar los recuadros estáticos en el lienzo sobre las zonas pre-detectadas.
- **Ergonomía Reactiva (Foco Automático)**:
  - En la vista del formulario, cada input (asociado a un campo de la plantilla) escuchará su evento `onFocus`.
  - Al tabular o hacer foco en un campo, el frontend invocará los métodos correspondientes (ej. `viewport.panTo` / `viewport.fitBounds`) de la instancia de OpenSeadragon, utilizando las coordenadas de su `ai_predictions` mapeado, logrando enfocar e iluminar la región de texto correspondiente al instante, cumpliendo el principio de Eficiencia Extrema (Constitución #3).
