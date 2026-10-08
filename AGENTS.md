# AGENTS.md — Sistema Inteligente de Indexación (Plataforma SaaS)

Este archivo define el contexto y las reglas para los agentes de Antigravity que trabajan en este proyecto.

## Stack y Estructura Arquitectónica (Freemium MVP)
- **Frontend:** Next.js (React) + TailwindCSS. Despliegue pensado para Vercel. Prioridad en manejo de teclado.
- **Backend Core e IA:** Python con FastAPI. Encargado de procesar imágenes pesadas, generar teselas (DZI/WebP), gestionar URLs firmadas y lógica de IA. Despliegue en Render/Railway.
- **Base de Datos y Auth:** Supabase Cloud. Uso estricto de PostgreSQL con Row-Level Security (RLS) por `tenant_id`.
- **Almacenamiento de Imágenes:** Cloudflare R2. Se usará para alojar las imágenes pesadas debido a su ancho de banda de salida gratuito ($0 Egress), protegido mediante Signed URLs emitidas por FastAPI.
- **IA / HTR:** Pipeline de Aprendizaje Activo (Active Learning) asíncrono con modelos base y fine-tuning por organización.

## Flujo de Trabajo (Spec-Driven Development - SDD)
1. **Nunca escribas código de implementación sin una especificación (Spec) aprobada.**
2. **El flujo estricto de SDD es:**
   - **Paso 1:** Constitución (una vez por proyecto - `docs/constitution.md`)
   - **Paso 2:** Especificación (`spec.md`)
   - **Paso 3:** Clarificación
   - **Paso 4:** Planificación (`plan.md`)
   - **Paso 5:** Tareas (`tasks.md`)
   - **Paso 6:** Implementación
   - **Paso 7:** Validación
   - **Loop al Paso 2:** Mantenimiento y correcciones por bugs o lógica.
3. Utiliza el comando nativo `/plan` de Antigravity para razonar sobre las specs antes de implementarlas.
4. Si la especificación es ambigua, DEBES detenerte y hacer preguntas al usuario. No alucines soluciones.
5. **Regla de Oro de QA (Paso 3 - Clarificación):** La fase de clarificación de una Spec se debe hacer OBLIGATORIAMENTE en **bloques de 5 preguntas** divididas en **3 rondas** mínimas para buscar huecos, casos límite o contradicciones lógicas. Aunque el Coordinador intente que salga a la primera, el triple filtro es obligatorio.

### Kit de Automatización SDD (Subagentes Oficiales)
El flujo anterior se delega en el siguiente "Kit" de subagentes especializados para mantener la velocidad y seguridad:
- **`sdd_planner`**: Crea los archivos `plan.md` y `tasks.md` dividiendo los problemas en tareas secuenciales sin programar código.
- **`sdd_implementer`**: Escribe el código estricto de una tarea específica sin salirse de su límite.
- **`sdd_reviewer`**: Actúa como auditor de QA validando el código escrito contra la especificación.
- **`github_manager`**: (DevSecOps) Encargado de revisar `.gitignore` y realizar `git add`, `git commit` y `git push` automáticamente tras cada tarea implementada, previniendo fuga de secretos y automatizando el CI/CD hacia Vercel/Render.

## Reglas de Dominio y Trampas Conocidas
- **Multi-Tenancy:** Jamás escribas una consulta a la BD o al Storage que no filtre por `tenant_id`. El aislamiento de datos es crítico.
- **Coordenadas (Bounding Boxes):** Todas las predicciones de la IA y recortes manuales deben guardar su estructura espacial `[xmin, ymin, xmax, ymax]`.
- **Telemetría y Estado:** Mantén actualizado el archivo `MEMORY.md` al finalizar cada módulo importante.

## Límites para Antigravity
- ✅ **Siempre:** Lee el archivo `docs/constitution.md` al iniciar una tarea y respeta sus principios de manera estricta. Ninguna decisión técnica o de código puede violar la constitución.
- ✅ **Siempre:** Al requerir respuestas del usuario para resolver **ambigüedades técnicas menores o bloqueos fuera de la Fase de Clarificación**, haz las preguntas estrictamente de **UNA EN UNA**. Prohibido hacer bloques de preguntas para evitar confusión. *(Nota: Esta regla NO aplica al Paso 3 del SDD, el cual requiere bloques de 5 preguntas)*.
- ✅ **Siempre:** Alerta al usuario y pide credenciales antes de intentar programar accesos a servicios externos (Supabase, Render, Cloudflare R2, GitHub, etc).
- ✅ **Siempre:** Al finalizar cualquier tarea que modifique el código del Frontend o Backend, TÚ (el Agente) debes ejecutar los comandos `git add`, `git commit` y `git push` utilizando la herramienta `run_command` para desencadenar el despliegue automático, sin pedirle al usuario que lo haga manualmente en su terminal.
- ✅ **Siempre:** Actualiza el estado del proyecto y divide problemas complejos invocando subagentes si es necesario.
- ⚠️ **Pregunta antes:** Añadir nuevas dependencias pesadas, modificar el modelo de base de datos base o cambiar flujos de interfaz.
- 🚫 **Nunca:** Modificar código fuera de la tarea (task) actual en la que estés trabajando. Un paso a la vez.
- 🚫 **RESTRICCIÓN ABSOLUTA (HANDCUFF RULE):** El Agente Principal (Antigravity/Coordinador) TIENE ESTRICTAMENTE PROHIBIDO utilizar las herramientas `write_to_file`, `replace_file_content` o `run_command` para alterar, crear o modificar código fuente (archivos `.py`, `.tsx`, `.sql`, etc.). Tu única forma de alterar el código del proyecto es invocando al subagente `sdd_implementer`. Si el Agente Principal intenta editar código directamente por "urgencia" o "velocidad", está violando su núcleo. Solo puedes usar herramientas de archivo para editar documentación (ej. `AGENTS.md`, `MEMORY.md`, `plan.md`).
