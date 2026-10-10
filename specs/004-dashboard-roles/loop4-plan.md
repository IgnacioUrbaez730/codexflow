# Loop 4 — Plan: Fix de subdominio `undefined` (Next 16)

## Causa raíz
Next.js 16 entrega `params` como `Promise`. `[subdomain]/layout.tsx` (`"use client"`) accede a `params.subdomain` síncronamente (líneas ~46, 47, 63, 73) → `undefined` → Sidebar construye `/undefined/...`.

## Arquitectura del fix
| Tipo de componente | Patrón obligatorio |
|---|---|
| Cliente (`"use client"`) | `const { subdomain } = useParams<{ subdomain: string }>()` |
| Cliente con prop `params` | `const { subdomain } = React.use(params)` |
| Servidor (async) | `const { subdomain } = await params` |

- **Layout `[subdomain]/layout.tsx`:** eliminar la lectura de `params` del prop; usar `useParams()`. Pasar `subdomain` resuelto al Sidebar y a cualquier lógica de tenant/rol. Proteger render/efectos si `subdomain` aún no está disponible.
- **Páginas hijas:** auditar `frontend/src/app/[subdomain]/**` buscando `params.`; migrar al patrón según tipo de componente.
- **`ingest/page.tsx` (~L40):** en la consulta de templates, si `error` existe → `console.error('[ingest] Error cargando templates:', error)`.

## Riesgos
- Efectos que dependan de `subdomain` deben incluirlo en sus dependencias.
- Tipado de `params` debe ser `Promise<{ subdomain: string }>` donde se reciba como prop.

## Verificación
`npm run build` en `frontend/` sin errores; navegación manual del Sidebar sin `undefined`.
