# Constitución — Sistema Inteligente de Indexación

Principios innegociables del proyecto. Toda especificación, plan técnico, tarea y código escrito por Antigravity o el usuario DEBE cumplir estas reglas.

1. **Aislamiento Multi-Tenant Absoluto:** La seguridad y partición de datos por organización (`tenant_id`) es la máxima prioridad. Aplica a Base de Datos (RLS), Almacenamiento (Buckets/Carpetas) y Modelos de IA. Ninguna query puede carecer de contexto de tenant.
2. **La Spec manda (SDD Estricto):** Nada se implementa si no está en la especificación activa (`spec.md`). Si un requisito choca con la arquitectura, se detiene el código, se actualiza la spec y luego se implementa.
3. **Eficiencia Operativa Extrema (Frontend):** El "Visor Dual Ergonómico" es la herramienta de trabajo diario de los digitadores. El 95% de la captura debe poder realizarse con atajos de teclado, sin forzar el uso del ratón.
4. **Resiliencia y Rendimiento Visual:** Las imágenes pesadas de folios deben renderizar su primera vista en < 1.2 segundos (Pirámide de Teselas DZI). Debe existir autoguardado local constante para no perder trabajo ante fallos de red.
5. **IA como Asistente Seguro, no Sustituto:** El motor de IA actúa en Fases según su umbral de confianza (Supervisión, Focalización Visual, Prellenado). La IA *sugiere*, el humano *valida*. Todas las inferencias deben registrar sus Coordenadas (Bounding Boxes) exactas.
6. **Mantenibilidad y Memoria:** Toda decisión de diseño mayor debe quedar registrada. Los agentes actualizarán `MEMORY.md` tras completar especificaciones mayores para no saturar la ventana de contexto.
