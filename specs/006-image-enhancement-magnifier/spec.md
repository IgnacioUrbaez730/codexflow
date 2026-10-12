# Especificación Funcional: Mejora de Imagen y Lupa Interactiva (Spec 006)

**Identificador:** `006-image-enhancement-magnifier`  
**Estado:** Aprobado  
**Fecha:** 2026-10-12  
**Autor:** Agente Planificador SDD  
**Ciclo SDD:** Pasos 2, 4 y 5  

---

## 1. Propósito y Alcance

### 1.1 Propósito
Dotar a los transcriptores y archivistas de herramientas visuales avanzadas en el visor de documentos para descifrar manuscritos eclesiásticos antiguos con tinta degradada, manchas o caligrafía compleja, mediante una lupa interactiva (Magnifier Lens) y una suite de filtros de legibilidad aplicados en tiempo real con aceleración por hardware.

### 1.2 Alcance
- **Lupa Interactiva (Magnifier Lens):** Lente flotante circular de 180px con retícula central, zoom dinámico (1.5x a 5.0x) controlado por rueda de ratón, activación por tecla rápida (`L`) o botón, compatible con rotación geométrica (90°, 180°, 270°).
- **Suite de Filtros de Legibilidad:** Ajuste dinámico de brillo (50%-200%), contraste (50%-250%), nitidez/contraste adaptativo, inversión/negativo (`I`), escala de grises y modo binarizado (alto contraste B/N para tinta tenue).
- **Consistencia y Sincronización:** Herencia bidireccional inmediata de filtros en el lienzo principal y en la lupa.
- **Puntos de Integración:** Vista principal de transcripción (`/[subdomain]/visor`) y modal de vista previa en catálogo de registros (`/[subdomain]/records`).

---

## 2. Actores y Roles

| Actor | Descripción |
|---|---|
| **Transcriptor / Indexador** | Usuario operativo encargado de leer y transcribir registros parroquiales manuscritos. Requiere inspección rápida de grafías dudosas y aumento localizado sin perder contexto general. |
| **Archivista / Revisor QA** | Valida calidad y coteja partidas históricas, necesitando resaltar trazos de tinta degradada y comparar folio original. |
| **Sistema Frontend** | Cliente web Next.js/React encargado de procesar transforms matriciales y filtros CSS en GPU a 60 FPS sin recargar el backend. |

---

## 3. Requerimientos Funcionales (EARS)

### 3.1 Lupa Interactiva (Magnifier Lens)

- **REQ-MAG-01 (Event-driven):** CUANDO el usuario presione la tecla `L` Y el foco activo del navegador NO se encuentre en un campo editable (`input`, `textarea`, `select` o `contenteditable`), el sistema DEBERÁ alternar el estado activo/inactivo de la lupa.
- **REQ-MAG-02 (Event-driven):** CUANDO el usuario haga clic en el botón de lupa en la barra de herramientas flotante, el sistema DEBERÁ alternar el estado activo/inactivo de la lupa.
- **REQ-MAG-03 (State-driven):** MIENTRAS la lupa esté activa y el cursor del ratón se mueva sobre el área visible de la imagen del documento, el sistema DEBERÁ posicionar un lente circular de 180px de diámetro centrado en el puntero, mostrando la porción ampliada de la imagen correspondiente a dichas coordenadas.
- **REQ-MAG-04 (Event-driven):** MIENTRAS la lupa esté activa, CUANDO el usuario accione la rueda del ratón (`wheel`) sobre el área del documento, el sistema DEBERÁ ajustar el nivel de aumento entre un mínimo de 1.5x y un máximo de 5.0x en incrementos de 0.25x, previniendo el scroll o zoom global de la página durante dicha acción.
- **REQ-MAG-05 (Ubiquitous):** El lente de la lupa DEBERÁ incluir un borde óptico circular con sombra profunda (`box-shadow`), y una retícula o cruz central translúcida para facilitar la alineación sobre trazos caligráficos.
- **REQ-MAG-06 (Unwanted behavior):** SI el cursor del ratón sale de los límites perimetrales de la imagen o del contenedor del visor, el sistema DEBERÁ ocultar suavemente el lente circular hasta que el cursor reingrese.
- **REQ-MAG-07 (State-driven):** MIENTRAS la imagen esté rotada a 90°, 180° o 270°, el sistema DEBERÁ calcular las coordenadas de muestreo de la lupa compensando la matriz de rotación para mantener la coherencia espacial exacta del fragmento ampliado.

### 3.2 Suite de Filtros de Legibilidad

- **REQ-FLT-01 (Event-driven):** CUANDO el usuario haga clic en el botón de controles de imagen (icono `Sliders` / `Wand2`) en la barra flotante, el sistema DEBERÁ desplegar un popover o menú flotante accesible con los controles de ajuste visual.
- **REQ-FLT-02 (State-driven):** El menú de filtros DEBERÁ ofrecer controles deslizantes (sliders) para:
  - **Brillo (`brightness`):** Rango de 50% a 200%, valor por defecto 100%.
  - **Contraste (`contrast`):** Rango de 50% a 250%, valor por defecto 100%.
  - **Nitidez / Claridad de bordes (`sharpness`):** Rango de 0 a 100 (implementado mediante filtro de convolución SVG/contraste acentuado dinámico), valor por defecto 0.
- **REQ-FLT-03 (Event-driven):** CUANDO el usuario presione la tecla `I` (fuera de elementos de entrada de texto) O active el conmutador "Invertir", el sistema DEBERÁ alternar la inversión cromática negativa (`invert(100%)`).
- **REQ-FLT-04 (State-driven):** El menú DEBERÁ proveer conmutadores independientes (Toggles) para:
  - **Escala de Grises (`grayscale`):** Alterna entre color original y 100% escala de grises.
  - **Modo Binarizado:** Aplica una combinación calibrada de alto contraste, desaturación y umbralización para convertir el folio a blanco y negro puro, destacando tinta desvanecida frente a papel oxidado o amarillento.
- **REQ-FLT-05 (Ubiquitous):** La lupa interactiva DEBERÁ heredar y renderizar de manera idéntica e instantánea la misma combinación de filtros visuales activos en el lienzo principal del documento.

### 3.3 Persistencia de Sesión y Navegación entre Folios

- **REQ-NAV-01 (Event-driven):** CUANDO el usuario navegue hacia el folio siguiente o anterior dentro de la misma sesión de trabajo, el sistema DEBERÁ conservar intactos los valores de filtros configurados (brillo, contraste, nitidez, negativo, escala de grises, binarización).
- **REQ-NAV-02 (Event-driven):** CUANDO el usuario cambie de folio, el sistema DEBERÁ desactivar automáticamente la lupa interactiva para evitar desorientación visual en la nueva página cargada.
- **REQ-NAV-03 (Event-driven):** CUANDO el usuario haga clic en el botón "Restablecer" de la barra principal, el sistema DEBERÁ reiniciar el zoom general (1.0x), posición panorámica (0,0), rotación (0°), desactivar la lupa y restaurar todos los filtros visuales a sus valores predeterminados de fábrica.

### 3.4 Puntos de Disponibilidad

- **REQ-INT-01 (Ubiquitous):** La suite completa de filtros y lupa interactiva DEBERÁ estar disponible en la vista operativa de transcripción: `frontend/src/app/[subdomain]/visor/page.tsx`.
- **REQ-INT-02 (Ubiquitous):** La suite completa de filtros y lupa interactiva DEBERÁ estar disponible en el modal de detalle e inspección de registros en: `frontend/src/app/[subdomain]/records/page.tsx`.
- **REQ-INT-03 (Ubiquitous):** La lógica de cálculo, transformaciones y estado de filtros DEBERÁ encapsularse en un hook modular reutilizable (`useImageViewerFilters`) y un subcomponente visual (`MagnifierLens`) consumibles por `DocumentViewer`.

---

## 4. Requerimientos No Funcionales

- **RND-PERF-01 (Rendimiento 60 FPS):** La actualización de la posición de la lupa y el renderizado de filtros deben ejecutarse en el hilo de animación del navegador (`requestAnimationFrame`) y acelerados por GPU vía propiedades CSS transformadas (`transform: translate3d`, `filter`), sin generar bloqueos en el hilo principal ni repaints costosos del DOM.
- **RND-ACC-01 (Accesibilidad):** Los atajos de teclado (`L`, `I`) deben estar aislados para nunca dispararse mientras el usuario redacta en inputs, textareas o modales de transcripción. Cada botón de la interfaz debe contener etiquetas `aria-label` y tooltips descriptivos.
- **RND-MEM-01 (Consumo de Memoria):** La lupa debe reutilizar la misma instancia de imagen ya precargada en caché de memoria del navegador (evitando descargas duplicadas de la imagen en alta resolución).

---

## 5. Casos Límite y Manejo de Errores

| Caso Límite | Comportamiento Esperado |
|---|---|
| Cursor en el borde extremo de la imagen | El lente de la lupa se mantiene activo pero se recorta suavemente con respecto al límite de la imagen o se oculta al sobrepasar el margen exterior de 10px. |
| Rotación combinada (ej. 90° o 270°) con zoom alto | El cálculo de la posición relativa de fondo (`background-position` / transform) invierte adecuadamente los ejes X e Y en función del seno y coseno del ángulo de rotación. |
| Cambio rápido entre folios | La lupa se apaga de inmediato (`isMagnifierActive = false`) y no genera flickering ni referencias a imágenes nulas o descargándose. |
| Combinación de Binarizado + Inversión | Ambos filtros deben componerse ordenadamente en la cadena CSS (`grayscale(1) contrast(...) invert(...)`) produciendo texto blanco sobre fondo negro de alto contraste. |
| Resolución variable de pantalla | El lente se mantiene estrictamente en 180px físicos, con retícula centrada proporcionalmente. |

---

## 6. Criterios de Aceptación (Gherkin)

### Escenario 1: Activación y seguimiento de la Lupa
```gherkin
Given que el usuario está visualizando un folio en el visor de documentos
When presiona la tecla 'L' con el foco fuera de cualquier input
Then la lupa se activa y aparece un lente circular de 180px con retícula central
And al mover el puntero sobre la imagen, el lente muestra la región aumentada a 2.5x
```

### Escenario 2: Ajuste de aumento dinámico con rueda del ratón
```gherkin
Given que la lupa se encuentra activa sobre la imagen
When el usuario gira la rueda del ratón hacia arriba
Then el factor de magnificación se incrementa progresivamente hasta un tope de 5.0x
And el scroll vertical de la ventana permanece bloqueado
```

### Escenario 3: Aplicación simultánea de filtros en lienzo y lupa
```gherkin
Given que el usuario activa el filtro "Negativo" (tecla 'I') y ajusta Contraste al 180%
When activa la lupa interactiva sobre una firma manuscrita tenue
Then la lupa renderiza la firma ampliada con el mismo contraste de 180% e inversión negativa
```

### Escenario 4: Persistencia al avanzar folio
```gherkin
Given que el usuario configuró Brillo al 130% y Modo Binarizado activo
When hace clic en "Siguiente Folio"
Then el nuevo folio se presenta con Brillo al 130% y Modo Binarizado
And la lupa interactiva se desactiva automáticamente
```

### Escenario 5: Restablecimiento integral
```gherkin
Given que el usuario aplicó rotación, zoom, filtros de nitidez e inversión
When hace clic en el botón "Restablecer" de la barra de herramientas
Then todos los filtros vuelven a sus valores por defecto (100% brillo/contraste, sin invertir)
And la rotación vuelve a 0° y el zoom general a 1.0x
```
