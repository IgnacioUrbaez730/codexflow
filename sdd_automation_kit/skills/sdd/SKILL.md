---
name: sdd
description: Úsala siempre que trabajes con Spec-Driven Development en este proyecto (docs/constitution.md o cualquier archivo dentro de specs/) - redactar, revisar o cambiar specs, planes y tareas, o implementar y validar tareas de una spec.
---
# Spec-Driven Development (SDD)

## Flujo
Paso 0: Configuración Multiagente -> Constitución -> Spec -> Clarificación -> Plan -> Tareas -> Implementación -> Validación -> Cambio.
- **Regla de oro:** Los agentes y subagentes (Coordinator, Planner, Implementer, Reviewer) DEBEN definirse en el sistema justo al momento de la Constitución, ANTES de redactar cualquier Spec.
- Nunca pases a la siguiente fase sin la aprobación explícita del usuario.
- La spec manda: si algo no está en la spec, no se implementa. Si falta una decisión, para y pregunta.
- Cada spec vive en su carpeta: `specs/NNN-nombre/` con `spec.md`, `plan.md` y `tasks.md`.
- Al terminar cada fase, actualiza `MEMORY.md`.

## Plantilla de spec (spec.md)
```markdown
# Spec NNN — <Nombre>
Estado: borrador | aprobada | implementada
## Contexto y objetivo
## Usuarios / Actores
## Historias de usuario
- HU-1. Como <rol>, quiero <acción> para <beneficio>.
## Requisitos funcionales
- RF-x: CUANDO <evento>, EL SISTEMA <respuesta>.
- RF-x: SI <condición no deseada>, ENTONCES EL SISTEMA <respuesta>.
- RF-x: MIENTRAS <estado>, EL SISTEMA <respuesta>.
- RF-x: EL SISTEMA <comportamiento permanente>.
## Requisitos no funcionales
## Casos límite
## Fuera de alcance
## Criterios de finalización
## Dudas abiertas
- [NECESITA ACLARACIÓN] <duda>
```
La spec describe el QUÉ y el POR QUÉ. Nada de stack, arquitectura ni nombres de archivos.

## Plan (plan.md)
Archivos y responsabilidades · Funciones puras · Algoritmo en pseudocódigo · Interfaz · Decisiones justificadas con su alternativa descartada · Estrategia de tests. Indica qué RF cubre cada parte.

## Tareas (tasks.md)
```markdown
- [ ] **Tn. <Descripción>.** RF-x, RF-y
  - Hecho cuando: <comprobación verificable>.
```
Máximo 20-30 min por tarea, en orden de dependencia.

## Implementación
Una sola tarea cada vez: tests primero (en rojo), después el código en verde, marcar la tarea y parar.
