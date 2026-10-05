# Tareas de Implementación - Pipeline de IA (Spec 003)

- [x] **T1: Base de Datos - Migración de tabla `folios`:** Crear una migración en Supabase SQL para añadir la columna `ai_predictions` de tipo JSONB a la tabla `folios`.
- [x] **T2: Base de Datos - Nueva tabla `training_data`:** Crear la tabla `training_data` (`id`, `tenant_id`, `folio_id`, `field_name`, `predicted_value`, `actual_value`) e implementar las políticas RLS estrictas.
- [x] **T3: Backend - Configuración de Docker:** Implementar el `Dockerfile` para el empaquetado del backend, asegurando la instalación de la dependencia de sistema `tesseract-ocr`.
- [x] **T4: Backend - Motor de OCR:** Añadir `pytesseract` al proyecto e integrarlo para procesar imágenes locales extrayendo texto, bounding boxes y confianza.
- [x] **T5: Backend - Extracción por Regex:** Desarrollar la lógica de mapeo en la Background Task para cruzar resultados del OCR con la configuración Regex de la plantilla del folio.
- [x] **T6: Backend - Persistencia de Predicciones:** Actualizar el flujo del Worker para que, tras el procesamiento DZI y OCR, guarde el payload estructurado dentro de `ai_predictions` en base de datos.
- [ ] **T7: Backend - Endpoint Active Learning:** Crear el endpoint en FastAPI (POST) que permita registrar el feedback del usuario en la tabla `training_data`.
- [ ] **T8: Frontend - Integración de Predicciones:** Modificar las consultas y estado global (Zustand/Redux) para disponer de `ai_predictions` al inicializar un folio.
- [ ] **T9: Frontend - OpenSeadragon Overlays:** Programar un componente/lógica que dibuje recuadros visuales en OpenSeadragon basados en las coordenadas (`xmin, ymin, xmax, ymax`).
- [ ] **T10: Frontend - Ergonomía Visual por Foco:** Enlazar el evento `onFocus` de los inputs del formulario para que el visor OpenSeadragon haga zoom/paneo a la coordenada vinculada al campo activo.
- [ ] **T11: Frontend - Feedback (Active Learning):** Al accionar la tecla de guardado rápido (`Ctrl+Enter`), verificar si el valor confirmado difiere de la predicción y enviar la discrepancia al endpoint de Active Learning.
