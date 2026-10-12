# Plan Técnico: Explorador y Editor de Registros (Records Explorer)

## 1. Visión General de la Arquitectura

La funcionalidad de **Explorador y Editor de Registros** conecta la persistencia de folios y plantillas en Supabase PostgreSQL con una interfaz reactiva e interactiva en Next.js (App Router), mediada por endpoints securizados en FastAPI (`backend/main.py`).

```
+---------------------------------------------------------------------------------+
|                                Frontend (Next.js)                               |
|  /[subdomain]/records/page.tsx                                                  |
|  - RecordsFilterBar (BatchSelector, SearchInput, DateRange, ExportBtn)          |
|  - RecordsTable (DynamicHeaders, RowActions, StatusBadge, Pagination)           |
|  - RecordDetailModal (Split Screen: ImageViewer [Pan/Zoom/Rotate] + RecordForm) |
|  - Sidebar.tsx (Enlace condicional para admin y archivist)                      |
+----------------------------------------+----------------------------------------+
                                         | REST / HTTPS (JWT Bearer)
+----------------------------------------v----------------------------------------+
|                                Backend (FastAPI)                                |
|  - GET  /api/v1/records                (Filtros, paginación, metadatos lote)    |
|  - PATCH /api/v1/records/{folio_id}     (RBAC, lock check, auditoría sin cuota)  |
|  - GET  /api/v1/records/export         (Streaming CSV con columnas dinámicas)   |
|  - GET  /api/v1/records/{folio_id}/url (Signed URL segura bajo demanda)         |
+----------------------------------------+----------------------------------------+
                                         | Supabase Python Client (RLS / Service)
+----------------------------------------v----------------------------------------+
|                             Base de Datos & Storage                             |
|  - Tables: folios, batches, templates, organizations, profiles                  |
|  - Storage Bucket: folios (Signed URLs temporales)                              |
+---------------------------------------------------------------------------------+
```

---

## 2. Contratos de API REST

### 2.1. `GET /api/v1/records`
Obtiene la lista paginada de folios del tenant con soporte de filtrado y definición de plantilla.

**Query Parameters:**
| Parámetro | Tipo | Requerido | Default | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `batch_id` | `UUID` | No | `None` | Filtrar por lote específico. |
| `search` | `string` | No | `None` | Búsqueda por texto en nombre de archivo y valores de metadatos. |
| `start_date`| `string (ISO)`| No | `None` | Filtro de fecha inicio (`>= verified_at` o `>= created_at`). |
| `end_date` | `string (ISO)`| No | `None` | Filtro de fecha fin (`<= verified_at` o `<= created_at`). |
| `page` | `integer` | No | `1` | Número de página (1-based). |
| `page_size` | `integer` | No | `20` | Cantidad de registros por página (máx: 100). |

**Headers:**
- `Authorization: Bearer <supabase_jwt>`

**Response (200 OK):**
```json
{
  "records": [
    {
      "id": "e4b2d3c1-...",
      "batch_id": "a1b2c3d4-...",
      "batch_name": "Lote Notarial Enero 2026",
      "file_name": "acta_045.jpg",
      "status": "completed",
      "is_locked": false,
      "locked_by": null,
      "metadata": {
        "numero_acta": "1045",
        "fecha": "1984-05-12",
        "nombres": "Juan Alberto Pérez"
      },
      "created_at": "2026-01-10T14:32:00Z",
      "verified_at": "2026-01-10T15:20:00Z",
      "verified_by": "u-1234",
      "updated_at": "2026-01-10T15:20:00Z",
      "last_modified_by": null,
      "view_url": "https://<supabase-url>/storage/v1/object/sign/..."
    }
  ],
  "template": {
    "id": "t-123",
    "name": "Actas de Nacimiento v1",
    "fields": [
      { "key": "numero_acta", "label": "N° de Acta", "type": "text", "required": true },
      { "key": "fecha", "label": "Fecha de Registro", "type": "date", "required": true },
      { "key": "nombres", "label": "Nombres y Apellidos", "type": "text", "required": true }
    ]
  },
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total_records": 142,
    "total_pages": 8
  }
}
```

*Nota:* Si `batch_id` no fue provisto, el objeto `template` será `null`.

---

### 2.2. `PATCH /api/v1/records/{folio_id}`
Actualiza metadatos de un folio específico.

**Headers:**
- `Authorization: Bearer <supabase_jwt>`

**Request Body:**
```json
{
  "metadata": {
    "numero_acta": "1045-A",
    "fecha": "1984-05-12",
    "nombres": "Juan Alberto Pérez Gómez"
  }
}
```

**Lógica de Control en Backend:**
1. Extraer `user_id`, `tenant_id` y `role` desde el token verificado.
2. Obtener el folio y su lote asociado asegurando `tenant_id == auth.tenant_id`.
3. Validar permisos:
   - Si `role == 'admin'`: Autorizado.
   - Si `role == 'archivist'`: Verificar que `folio.batch.uploaded_by == user_id`. Si no coincide, responder `403 Forbidden`.
   - Si `role == 'digitizer'`: Responder `403 Forbidden`.
4. Verificar bloqueo de concurrencia:
   - Si `folio.status == 'in_progress'` y `folio.in_progress_by != user_id`: Responder `409 Conflict`.
5. Ejecutar actualización:
   - `metadata = payload.metadata`
   - `updated_at = NOW()`
   - `last_modified_by = user_id`
6. Retornar el registro actualizado.

**Response (200 OK):**
```json
{
  "id": "e4b2d3c1-...",
  "metadata": { ... },
  "updated_at": "2026-10-12T03:00:00Z",
  "last_modified_by": "u-admin"
}
```

---

### 2.3. `GET /api/v1/records/export`
Genera la descarga en formato CSV con las cabeceras dinámicas correspondientes.

**Query Parameters:** Iguales a `GET /api/v1/records` (`batch_id`, `search`, `start_date`, `end_date`), sin paginación (aplica a todos los coincidentes del tenant).

**Headers de Respuesta:**
- `Content-Type: text/csv; charset=utf-8`
- `Content-Disposition: attachment; filename="registros_export_<timestamp>.csv"`

**Estructura del CSV:**
- Si `batch_id` está definido:
  `ID Folio,Archivo,Fecha Verificación,Estado,<Label_Campo_1>,<Label_Campo_2>,...`
- Si no hay `batch_id`:
  `ID Folio,Archivo,Lote,Fecha Verificación,Estado,Metadatos JSON`

---

## 3. Arquitectura Frontend (Next.js 16)

### 3.1. Enrutamiento y Layout
- **Ruta:** `frontend/src/app/[subdomain]/records/page.tsx`
- **Hook de Subdominio:** Utilizar `useParams()` de `next/navigation` respetando la regla anti-síncrona de Next.js 16.
- **Protección de Ruta:** En caso de que el rol sea `digitizer`, redirigir client-side o mediante middleware a `/[subdomain]/workspace`.

### 3.2. Árbol de Componentes
1. `RecordsPage` (`page.tsx`):
   - Estado global de filtros: `selectedBatch`, `searchTerm`, `dateRange`, `page`, `pageSize`.
   - Carga de lotes del tenant para el selector.
   - Carga reactiva de registros con `swr` o `useEffect`.
2. `RecordsFilterBar`:
   - Selector de Lotes (`<select>` estilizado con Tailwind).
   - Campo de búsqueda debounceado (300ms).
   - DatePicker o inputs `type="date"` (desde / hasta).
   - Botón "Exportar CSV" que desencadena descarga directa vía blob o link firmado.
3. `RecordsTable`:
   - Renderiza encabezados estándar si no hay lote seleccionado.
   - Renderiza encabezados con nombres de campos de la plantilla cuando hay un lote seleccionado.
   - Paginación integrada con selector de registros (20, 50).
   - Botón de acción "Ver / Editar" por fila.
4. `RecordDetailModal`:
   - Modal a pantalla completa o 90vw/90vh con layout de dos columnas:
     - **Columna Izquierda (`ImageViewer`):** Contenedor de lienzo o `img` con controles de:
       - Zoom in / Zoom out / Reset zoom.
       - Pan interactivo (drag-to-scroll).
       - Rotación (0°, 90°, 180°, 270°).
     - **Columna Derecha (`RecordEditorForm`):**
       - Muestra información general: Nombre de archivo, Lote, Verificado por, Última modificación.
       - Formulario dinámico basado en los `fields` de la plantilla.
       - Validación suave (advertencia visual si un campo requerido queda vacío antes de confirmar).
       - Acciones: "Cancelar" y "Guardar Cambios".

### 3.3. Actualización de `Sidebar.tsx`
- Añadir el ítem de navegación "Registros" en la lista de enlaces:
  - Etiqueta: "Registros"
  - Ruta: `/${subdomain}/records`
  - Ícono: Icono de base de datos o tabla (`lucide-react` `Database` o `Table2`).
  - Condición de visualización: `userRole === 'admin' || userRole === 'archivist'`. Oculto para `digitizer`.

---

## 4. Consideraciones de Rendimiento y Seguridad

1. **Generación de Signed URLs:** Para evitar generar URLs firmadas masivas en el listado inicial de 100 registros, la API puede proveer URLs con tiempo de expiración corto (ej. 30 minutos) o resolver la URL firmada de alta resolución al abrir el modal `RecordDetailModal`.
2. **Consultas Indexadas en Postgres:** Se recomienda utilizar índices sobre `(tenant_id, batch_id, status)` y `(tenant_id, verified_at)` en la tabla `folios` para garantizar latencia inferior a 150ms.
3. **Manejo de Errores y Estados Vacíos:** Si no hay registros coincidentes, la tabla debe mostrar un estado vacío amigable con opción de limpiar los filtros aplicados.
