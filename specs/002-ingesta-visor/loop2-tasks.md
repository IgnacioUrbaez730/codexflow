# Tareas Loop 2 - Creador Visual de Plantillas y Formularios Dinámicos

1. **[Backend] Migración de Base de Datos y Tipos**
   - [x] Actualizar el esquema de la tabla `templates` para incluir el campo `fields` (JSONB).
   - [x] Crear función o trigger SQL para bloquear actualizaciones a `fields` en plantillas si existen registros en `batches` con dicho `template_id`.

2. **[Backend] Endpoints de Plantillas**
   - [x] Implementar CRUD en la API de Plantillas (`GET`, `POST`, `PUT`, `DELETE`).
   - [x] Implementar endpoint para duplicar plantilla.
   - [x] Añadir validación de límite de 40 campos.
   - [x] En el endpoint de guardado de folios, implementar guardado de progreso parcial cuando el estado cambie a `dudoso` (bypass de la validación estricta de `required`).

3. **[Frontend] Componente de Creador de Plantillas (Split Screen)**
   - [x] Crear el layout dividido (Builder a la izquierda, Preview a la derecha).
   - [x] Implementar el estado (State Management) para el array de campos.
   - [x] Implementar generación automática de `id` en `snake_case` al cambiar el `label`.
   - [x] Implementar los 4 tipos de campos: Texto Corto, Texto Largo, Fecha, Dropdown.

4. **[Frontend] Controles de Tarjetas de Campos**
   - [x] Añadir botones de mover Arriba / Abajo para ordenar el array.
   - [x] Añadir botón de Eliminar (Papelera) por campo.
   - [x] Añadir input para opciones (separadas por comas) cuando el tipo es Dropdown.
   - [x] Añadir checkbox de `is_required`.

5. **[Frontend] Plantillas Maestras**
   - [x] Añadir botones para precargar configuraciones JSON estáticas de "Bautismo" y "Defunción".

6. **[Frontend] Actualización del Visor Dual**
   - [x] Refactorizar el panel derecho del visor para leer `template.fields` en vez de campos hardcodeados.
   - [x] Implementar validación en frontend antes de enviar `Ctrl + Enter` verificando `is_required` y los tipos correctos.
   - [x] Asegurar que `Ctrl + Espacio` envíe el payload actual sin validaciones estrictas y lo marque como dudoso.

7. **[Pruebas e Integración]**
   - [x] Verificar la creación, guardado, edición, y bloqueo de edición de plantillas en uso.
   - [x] Probar atajos de teclado y guardado parcial en el visor con la nueva estructura dinámica.
