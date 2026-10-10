# Loop 4 — Tareas

- [x] **T1** — Corregir `frontend/src/app/[subdomain]/layout.tsx`: reemplazar lecturas síncronas de `params.subdomain` (~L46, 47, 63, 73) por `useParams()` de `next/navigation`; pasar el subdominio resuelto al Sidebar. (RL4-1, RL4-4)
- [x] **T2** — Auditar todas las páginas/layouts en `frontend/src/app/[subdomain]/**` y corregir cualquier uso síncrono de `params.` (cliente: `useParams()`/`React.use(params)`; servidor: `await params`). (RL4-2, RL4-3)
- [x] **T3** — En `frontend/src/app/[subdomain]/ingest/page.tsx` (~L40), registrar el error de la consulta de templates con `console.error`. (RL4-5)
- [x] **T4** — Ejecutar `npm run build` en `frontend/` y confirmar build sin errores. (Criterios de aceptación)
