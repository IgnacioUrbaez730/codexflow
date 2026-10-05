---
description: SDD · Valida la spec RF por RF (Quality Assurance)
agent: build
---
Recorre specs/$1/spec.md requisito por requisito. Para cada RF indica qué prueba o test lo cubre y el resultado de ejecutarlo.

Si algún RF no está cubierto o falla, dilo claramente. NO arregles nada todavía.
Después comprueba los criterios de finalización y la constitución y dame un veredicto:
¿La spec está cumplida?
- VEREDICTO: APROBADO
- VEREDICTO: CAMBIOS NECESARIOS (Lista los fallos)
