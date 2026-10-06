# Plan Técnico: Dashboard, Roles y Exportación (Spec 004)

## 1. Arquitectura de Autenticación y Roles (RBAC)
- **Modelo de Datos:** 
  - Se utilizará Supabase Auth para la gestión de identidades. 
  - Extensión en base de datos: Tabla `user_profiles` con columnas `user_id` (UUID referenciando a `auth.users`), `tenant_id` (UUID), y `role` (enum: 'admin', 'archivist', 'digitizer').
- **Invitaciones (Magic Links):**
  - Utilización de la API de administración de Supabase (`admin.createUser` / `inviteUserByEmail`) desde el backend para enviar un enlace mágico (Magic Link) al correo del nuevo empleado. Inmediatamente se inserta el `role` y `tenant_id` en `user_profiles`.
- **Políticas RLS:**
  - **Global:** Todas las políticas RLS validarán que el `tenant_id` del registro coincida con el `tenant_id` del usuario autenticado (extraído vía claim JWT o consulta segura al perfil).
  - **Digitador:** Acceso de lectura y actualización en modo ciego (sólo a folios durante la captura en Visor Dual).
  - **Archivista:** Lectura/Escritura en lotes creados por él. La bandeja de dudosos consultará la tabla `folios` con un JOIN a `batches`, filtrando donde `batches.uploaded_by = auth.uid()`.
  - **Admin:** Lectura/Escritura total en el tenant ("Modo Dios"), sin restricción de lotes.

## 2. Dashboard Operativo y Soft Paywall
- **Consultas (Queries):**
  - **Gráfico de Productividad:** Se creará una query optimizada para el Dashboard que agrupe `count(folios.id)` por `DATE(folios.verified_at)` (tendencia en el tiempo) filtrado por `tenant_id`. Se respaldará con un índice en `(tenant_id, verified_at)`.
  - **Bandeja de Dudosos para Admin:** Incluirá un `LEFT JOIN` con `user_profiles` para renderizar la columna de **Archivista Responsable**.
- **Soft Paywall (UI):**
  - Estado del Tenant: El `tenant` tendrá un registro de suscripción/cuotas (ej. `subscription_status` o tabla `quotas`).
  - Si la cuota se agota, el frontend cargará el Dashboard normal (gráficas de productividad históricas continuarán funcionando), pero renderizará una Alerta persistente ("Procesamiento Congelado").
  - El ingreso de nuevos lotes o transcripciones en backend será rechazado mientras persista este estado.

## 3. Exportación (CSV y API REST)
- **API Key Management:**
  - Creación de tabla `api_keys` con columnas `tenant_id` (PRIMARY KEY/UNIQUE) y `hashed_key` (hash de la clave en texto plano).
  - Al pulsar "Regenerar", el backend produce un UUID o token seguro, aplica un hash, hace un `UPSERT` en la tabla (sobreescribiendo el valor previo y destruyendo la conexión anterior), y muestra al usuario el texto plano por única vez.
- **Exportación Estática CSV:**
  - La lógica de extracción armará dinámicamente las columnas basándose en el `schema` de la plantilla vigente del día de la descarga, asegurando que columnas añadidas recientemente queden en blanco para registros pasados, manteniendo la integridad del archivo exportado.
- **API REST de Tiempo Real (`GET /api/v1/export`):**
  - **Enrutamiento:** Se implementará con Next.js API Routes (o el framework backend configurado).
  - **Auth:** Extracción del header `Authorization: Bearer <API_KEY>`, búsqueda y validación del hash en `api_keys` para resolver el `tenant_id`.
  - **Bloqueo Financiero (Cuota):** Antes de la query, el endpoint validará la tabla de suscripción/cuotas del tenant. Si está excedido, retornará HTTP `402 Payment Required` y cortará la sincronización con Excel.
  - **Protección de Rendimiento:** La consulta aplicará un límite por defecto: buscar folios modificados/verificados en el rango `NOW() - INTERVAL '30 days'`. Para rangos mayores, el usuario deberá especificarlo vía parámetros bajo límites paginados, evitando escaneos completos.
