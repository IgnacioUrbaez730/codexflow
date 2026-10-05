# Toolkit SDD: Prompts y Comandos Reutilizables

A continuación se presentan los prompts genéricos extraídos y adaptados del curso. Puedes usarlos directamente en el chat o guardarlos como "Custom Commands" en tu herramienta de IA (ej. `.opencode/commands/`).

## 1. Prompt para generar la Constitución (`/sdd-constitution`)
**Uso:** Al inicio de un proyecto completamente nuevo.

```markdown
Actúa como Arquitecto de Software Principal. 
Vamos a crear (o revisar) el archivo `docs/constitution.md` para nuestro proyecto. 
Lee el documento de requerimientos base (si existe) y el `AGENTS.md`.

Tu tarea:
Proponme un `docs/constitution.md` con entre 5 y 8 principios innegociables, cortos y verificables. 
Deben cubrir: 
- Simplicidad y restricciones del Stack tecnológico.
- Regla de oro de SDD (La spec manda).
- Separación de responsabilidades (Lógica vs Interfaz).
- Política estricta de Testing.
- Manejo de datos y seguridad.

NO escribas el archivo en el sistema todavía: muéstrame tu propuesta en formato Markdown y espera mi aprobación o correcciones.
```

## 2. Prompt para generar una Especificación (`/sdd-spec`)
**Uso:** Cuando quieres desarrollar una nueva funcionalidad (Feature).

```markdown
Actúa como Analista de Producto (Product Manager). 
NO escribas código en ningún momento. Vamos a redactar la especificación de una nueva funcionalidad. 
Lee `docs/constitution.md` y `MEMORY.md`.

Idea inicial de la funcionalidad: [INSERTAR IDEA/MÓDULO AQUÍ]

Tu flujo de trabajo:
1. Hazme preguntas de UNA en UNA para eliminar ambigüedades, descubrir casos límite y definir qué queda fuera del alcance. (Máximo 5 preguntas iterativas).
2. Una vez resueltas las dudas, genera un archivo `specs/[numero]-[nombre-feature]/spec.md` siguiendo esta estructura:
   - Contexto y Objetivo
   - Usuarios / Actores
   - Historias de Usuario
   - Requisitos Funcionales en formato EARS (CUANDO... EL SISTEMA... / SI... ENTONCES...)
   - Requisitos No Funcionales
   - Casos Límite y Fuera de Alcance
   - Criterios de finalización.
3. Recuerda: La spec describe el QUÉ y el POR QUÉ. No incluyas detalles de arquitectura ni nombres de archivos aquí.
```

## 3. Prompt para generar el Plan Técnico (`/sdd-plan`)
**Uso:** Cuando la `spec.md` ya está aprobada por ti.

```markdown
Actúa como Ingeniero de Software Senior (Agente Planificador).
Lee `docs/constitution.md`, `AGENTS.md` y la spec activa en `specs/[nombre-feature]/spec.md`. 
NO escribas código funcional todavía.

Genera el archivo `specs/[nombre-feature]/plan.md` y `tasks.md` que contengan:
1. Qué archivos exactos se van a crear o modificar.
2. Responsabilidad de cada archivo.
3. Estructura de datos o interfaces necesarias.
4. Decisiones técnicas justificadas (y qué alternativa se descartó).
5. Estrategia de Testing.
6. En `tasks.md`, divide el plan en tareas pequeñas de 20-30 minutos, en orden estricto de dependencia. Usa checkboxes `[ ]`. Cada tarea debe enlazar al Requisito Funcional (RF) que cubre y tener un criterio verificable ("Hecho cuando:").

Asegúrate de que el plan cumple con el 100% de los requisitos de la spec. Espera mi aprobación antes de implementar.
```

## 4. Prompt para Implementar (Multiagente - Bucle de trabajo)
**Uso:** Para que el agente ejecutor haga el código de UNA sola tarea.

```markdown
Actúa como Desarrollador Especialista (Agente Implementador).
Tu objetivo es implementar SOLO LA SIGUIENTE TAREA del archivo `tasks.md`: [INSERTAR NOMBRE DE TAREA O NÚMERO].

Reglas de implementación:
1. Lee la `spec.md` y el `plan.md` para tener el contexto completo.
2. Sigue estrictamente la `constitution.md`.
3. Escribe PRIMERO los tests asociados a esta tarea y comprueba que fallan (TDD).
4. Escribe el código de implementación hasta que los tests pasen en verde.
5. Ejecuta las herramientas de verificación (linters, tests) y muéstrame el resultado.
6. Marca la tarea con una `[x]` en el `tasks.md`.

Después de esto PÁRATE. No empieces la siguiente tarea. Dame un reporte corto de archivos modificados y decisiones menores tomadas.
```

## 5. Prompt para el Revisor / QA (`/sdd-review`)
**Uso:** Al finalizar todas las tareas de un módulo para asegurar calidad antes de cerrar la spec.

```markdown
Actúa como Revisor de Calidad estricto (QA / Agente Reviewer).
No modifiques ningún archivo de código.
Lee la `spec.md` activa, los cambios realizados en el código (git diff o equivalente) y los resultados de los tests.

Tu trabajo:
1. Recorre la spec Requisito por Requisito (RF).
2. Indica para cada uno qué test lo cubre y si está pasando correctamente.
3. Evalúa si se cumplen los Criterios de Finalización y la Constitución del proyecto.

Termina tu respuesta con una de estas dos líneas:
- VEREDICTO: APROBADO (Podemos actualizar MEMORY.md y cerrar la spec).
- VEREDICTO: CAMBIOS NECESARIOS (Lista los problemas exactos, en qué archivo/línea y qué se esperaba según la spec).
```
