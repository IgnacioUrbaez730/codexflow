# Planificación Loop 2 - Creador Visual de Plantillas y Formularios Dinámicos

## 1. Arquitectura de Base de Datos y Modelo de Datos
- **Entidad `templates`**:
  - `id` (UUID, Primary Key)
  - `tenant_id` (UUID, Foreign Key)
  - `name` (String)
  - `fields` (JSONB)
  - `created_at` (Timestamp)
  - `updated_at` (Timestamp)
  - `is_in_use` (Booleano o computado a partir de si existen lotes asociados).
- **JSONB `fields` Structure**:
  - `[{ "id": "snake_case_name", "label": "Label", "type": "text | long_text | date | dropdown", "required": boolean, "options": ["opt1", "opt2"] }]`

## 2. Endpoints Backend (FastAPI o Next.js Server Actions)
- `POST /api/templates`: Crear una nueva plantilla.
- `GET /api/templates`: Obtener todas las plantillas del `tenant_id`.
- `GET /api/templates/:id`: Obtener una plantilla específica.
- `PUT /api/templates/:id`: Actualizar una plantilla. **Regla RLS / Validación Backend**: Solo permitir si no hay lotes apuntando a este `template_id`. Si está en uso, retornar error 403 (o 409).
- `POST /api/templates/:id/duplicate`: Crear una copia de una plantilla existente (útil cuando la original está bloqueada por estar en uso).

## 3. UI / UX Frontend (React / Next.js)
### 3.1 Creador de Plantillas (Split Screen)
- **Panel Izquierdo (Builder):**
  - Botones "Plantillas Maestras" (Bautismo, Defunción) que precargan el array de `fields`.
  - Lista de campos con DnD (Drag and Drop) o botones Up/Down para reordenar.
  - Tarjetas de edición de campo: Label, Type, y Checkbox "Requerido". Si es "Dropdown", input de texto para opciones separadas por comas.
  - Generación automática de `id` basado en el `label` (snake_case).
  - Límite máximo de 40 campos validado en el UI.
- **Panel Derecho (Live Preview):**
  - Mapea el estado actual del array `fields` y renderiza el formulario dinámico tal como se vería en el Visor.

### 3.2 Renderizado en Visor
- El Visor obtiene el `folio` y el `template` asociado a su lote.
- Genera el formulario dinámicamente iterando sobre `template.fields`.
- **Interacciones de Guardado**:
  - `Ctrl + Enter`: Única forma de guardar y avanzar. Valida `is_required` si el folio no es dudoso.
  - `Ctrl + Espacio` (Duda): Guarda el contenido actual como `jsonb` en el folio, permitiendo progreso parcial, y marca el estado como dudoso.

## 4. Validaciones RLS / Lógica de Negocio
- **Protección de Datos**: Un template referenciado por uno o más `batches` no puede ser modificado (excepto su nombre) ni eliminado para preservar la integridad estructural de los folios digitados.
- **Validación de Tipos**: Al guardar (`Ctrl + Enter`), el backend debe comprobar que el JSON del folio coincide estructural y tipológicamente con el JSON de la plantilla.
