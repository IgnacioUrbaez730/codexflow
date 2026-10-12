# Plan de Arquitectura Técnica: 009 - Indexación Asistida por Inteligencia Artificial (AI-Assisted Indexing)

## 1. Visión General de la Arquitectura

El módulo de Indexación Asistida por IA se integra sobre el visor de imágenes existente y el formulario de catalogación de CodexFlow. La arquitectura implementa un flujo desacoplado entre el procesamiento de visión/OCR, la renderización de la capa vectorial interactiva y la sincronización bidireccional con el formulario.

```mermaid
flowchart TD
    subgraph Backend [Backend & Almacenamiento]
        DB[(PostgreSQL / Supabase)]
        Cache[(Cache de Predicciones)]
        APIService[API Service / Folio Endpoints]
        TrainQueue[Cola / Ingestion Training Data]
    end

    subgraph Store [Gestión de Estado Frontend]
        IndexingStore[useIndexingStore / Zustand]
        AIOverlayStore[useAIOverlayStore]
    end

    subgraph Viewport [Visor de Folio & Canvas/SVG]
        ImageViewer[Base Image Viewer]
        LensViewer[Optical Lens Spec 006]
        AIBoundingBoxLayer[AIBoundingBoxLayer (SVG / Canvas Overlay)]
    end

    subgraph FormUI [Formulario de Catalogación]
        IndexForm[Dynamic Indexing Form]
        FieldInput[Field Input + AI Badge]
    end

    APIService -->|JSON Predicciones| IndexingStore
    IndexingStore -->|Predicciones & Confianza| AIOverlayStore
    AIOverlayStore -->|Geometrías Transformadas| AIBoundingBoxLayer
    AIOverlayStore -->|Sincronización Lente| LensViewer
    IndexForm <-->|Foco & Sincronización| AIOverlayStore
    IndexForm -->|Ctrl+Enter / Discrepancias| TrainQueue
    TrainQueue --> DB
```

---

## 2. Modelos de Datos

### 2.1 Esquema de Base de Datos (PostgreSQL)

```sql
-- Extensión para IDs y marcas de tiempo
CREATE TABLE IF NOT EXISTS ai_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folio_id UUID NOT NULL REFERENCES folios(id) ON DELETE CASCADE,
    model_version VARCHAR(50) NOT NULL,
    field_key VARCHAR(100) NOT NULL,
    suggested_text TEXT NOT NULL,
    confidence NUMERIC(4, 3) NOT NULL CHECK (confidence >= 0.000 AND confidence <= 1.000),
    -- Coordenadas normalizadas relativas a la resolución nativa de la imagen (0.0 a 1.0)
    bbox_x NUMERIC(6, 5) NOT NULL,
    bbox_y NUMERIC(6, 5) NOT NULL,
    bbox_width NUMERIC(6, 5) NOT NULL,
    bbox_height NUMERIC(6, 5) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_predictions_folio ON ai_predictions(folio_id);

-- Tabla para Aprendizaje Activo (Active Learning)
CREATE TABLE IF NOT EXISTS training_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folio_id UUID NOT NULL REFERENCES folios(id) ON DELETE CASCADE,
    field_key VARCHAR(100) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    original_ai_text TEXT NOT NULL,
    human_validated_text TEXT NOT NULL,
    confidence NUMERIC(4, 3) NOT NULL,
    bbox_x NUMERIC(6, 5) NOT NULL,
    bbox_y NUMERIC(6, 5) NOT NULL,
    bbox_width NUMERIC(6, 5) NOT NULL,
    bbox_height NUMERIC(6, 5) NOT NULL,
    action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('accepted_exact', 'corrected_text', 'rejected_blank', 'manual_inserted')),
    corrected_by_user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_training_data_field_created ON training_data(field_key, created_at DESC);
CREATE INDEX idx_training_data_action ON training_data(action_type);
```

### 2.2 Modelos TypeScript / Interfaces

```typescript
export interface BoundingBoxNormalized {
  x: number;       // [0.0, 1.0] porcentaje respecto al ancho de la imagen original
  y: number;       // [0.0, 1.0] porcentaje respecto al alto de la imagen original
  width: number;   // [0.0, 1.0]
  height: number;  // [0.0, 1.0]
}

export interface AIPrediction {
  id: string;
  folioId: string;
  fieldKey: string;
  suggestedText: string;
  confidence: number; // 0.00 - 1.00
  bbox: BoundingBoxNormalized;
  isValidSyntax: boolean;
}

export interface FormFieldAIState {
  currentValue: string;
  initialAISuggestion: string | null;
  confidence: number | null;
  isAIPrefilled: boolean;
  isModifiedByUser: boolean;
  activePredictionId: string | null;
}

export type RotationAngle = 0 | 90 | 180 | 270;

export interface ViewportTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: RotationAngle;
  naturalWidth: number;
  naturalHeight: number;
}
```

---

## 3. Algoritmo y Cálculo de Coordenadas Espaciales Escaladas

Las coordenadas de la IA provienen en espacio normalizado `[0.0, 1.0]` relativo a la imagen original (`naturalWidth` $\times$ `naturalHeight`). Para su renderizado interactivo en el canvas/SVG y en la lupa, se proyectan aplicando la matriz de transformación del viewport.

### 3.1 Transformación Geométrica ante Rotación

Sean $(x_n, y_n, w_n, h_n)$ las coordenadas normalizadas originales:

1. **Rotación 0°**:
   $$x' = x_n \cdot W, \quad y' = y_n \cdot H, \quad w' = w_n \cdot W, \quad h' = h_n \cdot H$$
2. **Rotación 90° en sentido horario**:
   $$x' = (1 - y_n - h_n) \cdot H, \quad y' = x_n \cdot W, \quad w' = h_n \cdot H, \quad h' = w_n \cdot W$$
   *(Nota: las dimensiones efectivas de la imagen rotada intercambian ancho y alto: $W_{\text{eff}} = H, H_{\text{eff}} = W$)*
3. **Rotación 180°**:
   $$x' = (1 - x_n - w_n) \cdot W, \quad y' = (1 - y_n - h_n) \cdot H, \quad w' = w_n \cdot W, \quad h' = h_n \cdot H$$
4. **Rotación 270° en sentido horario**:
   $$x' = y_n \cdot H, \quad y' = (1 - x_n - w_n) \cdot W, \quad w' = h_n \cdot H, \quad h' = w_n \cdot W$$

### 3.2 Proyección en Pantalla y Canvas/SVG

Dada la escala de zoom $S$ y los desplazamientos de paneo $(T_x, T_y)$:
$$\text{ScreenX} = x' \cdot S + T_x, \quad \text{ScreenY} = y' \cdot S + T_y$$
$$\text{ScreenWidth} = w' \cdot S, \quad \text{ScreenHeight} = h' \cdot S$$

### 3.3 Centrado Suave y Auto-Enfoque

Cuando un campo recibe foco:
- Centro objetivo en coordenadas transformadas:
  $$C_x = x' + \frac{w'}{2}, \quad C_y = y' + \frac{h'}{2}$$
- Si $\text{Zoom} \le 2.5\text{x}$:
  Calcular $(T_x, T_y)$ para alinear $(C_x, C_y)$ con el centro geométrico del contenedor del visor:
  $$T_x^{\text{target}} = \frac{V_w}{2} - C_x \cdot S, \quad T_y^{\text{target}} = \frac{V_h}{2} - C_y \cdot S$$
  Animar con interpolación lerp o `requestAnimationFrame` en $250\text{ms}$ con easing cúbico.
- Si $\text{Zoom} > 2.5\text{x}$:
  No se modifican $(T_x, T_y)$ ni $S$. Solo se actualiza el estado de `activeBoundingBoxId` provocando el cambio de estilo CSS a amarillo resplandeciente (`filter: drop-shadow(...)` y borde amarillo).

### 3.4 Sincronización con la Lupa Óptica (Spec 006)

La Lupa Óptica utiliza una sub-cámara con factor de magnificación $M_{\text{lens}}$ sobre el punto cursor $(P_x, P_y)$.
La capa SVG o Canvas de las cajas delimitadoras se renderiza en un sub-contexto espejo usando la transformación local de la lupa:
$$\text{LensOffset}_x = (x' - P_x) \cdot M_{\text{lens}} + R_{\text{lens}}$$
$$\text{LensOffset}_y = (y' - P_y) \cdot M_{\text{lens}} + R_{\text{lens}}$$
garantizando cero desfase y total fidelidad visual dentro del lente magnificador.

---

## 4. Arquitectura de Componentes Frontend

```
src/features/indexing/
├── components/
│   ├── AIOverlayLayer.tsx         # Contenedor SVG con todas las cajas delimitadoras
│   ├── AIBoundingBoxItem.tsx      # Recuadro individual con eventos de hover/click
│   ├── AIAssistedInput.tsx        # Input de formulario enriquecido con badge IA
│   ├── AIAssistanceToolbar.tsx    # Toggle On/Off (Alt+A), Recentrar (Alt+C), info
│   └── AIDashboardMetrics.tsx     # Gráficos y tablas de aceptación vs corrección
├── hooks/
│   ├── useAIBoundingBoxes.ts      # Cálculo de matrices afines y proyección
│   ├── useAICameraNavigation.ts   # Manejo de centrado automático y umbrales de zoom
│   └── useAIShortcuts.ts          # Gestor de eventos de teclado (Alt+A, Alt+C)
└── stores/
    └── aiIndexingStore.ts         # Estado de predicciones, selecciones y telemetría
```

### 4.1 Estrategia de Renderizado

- **Capa SVG Superpuesta**:
  Se utiliza un SVG posicionado de forma absoluta sobre el lienzo de la imagen (`pointer-events: none` en el SVG, y `pointer-events: auto` exclusivamente en las geometrías de las cajas).
  Esto permite soporte nativo de estilos vectoriales nítidos, animaciones CSS de foco y eventos estándar de puntero `onClick` y `onMouseEnter`.
- **Desacoplamiento de Re-renderizados**:
  El estado del zoom y paneo utiliza referencias mutables sincronizadas con `transform: matrix3d(...)` por aceleración de hardware GPU, evitando re-renderizados costosos del árbol de React durante el arrastre o rueda de zoom.

---

## 5. Pipeline de Aprendizaje Activo (Active Learning)

1. **Captura en Guardado**:
   - Al pulsar `Ctrl + Enter` o confirmar el formulario, se invoca `evaluateFieldDiscrepancies(currentFormData, originalAIPredictions)`.
2. **Clasificación de la Acción**:
   - `accepted_exact`: El texto final coincide exactamente con la sugerencia original de IA con confianza $\ge 80\%$.
   - `corrected_text`: El humano editó o corrigió total o parcialmente el valor sugerido.
   - `rejected_blank`: La IA sugirió un valor con $\ge 80\%$, pero el humano borró el campo.
   - `manual_inserted`: El humano rellenó un campo que la IA no predijo o cuya confianza fue $< 80\%$.
3. **Despacho No Bloqueante**:
   - Los registros de discrepancia se envían mediante una petición en segundo plano (`fetch` con `keepalive: true` o llamada Supabase asíncrona) sin detener la transición hacia el siguiente folio.

---

## 6. Monitoreo y Dashboard de Métricas

Para los roles Administrador y Archivista:
- **Tasa de Aceptación Global**:
  $$\text{AccuracyRate} = \frac{\sum \text{accepted\_exact}}{\sum (\text{accepted\_exact} + \text{corrected\_text} + \text{rejected\_blank})} \times 100$$
- **Distribución por Campo**: Métricas segmentadas para `nombre_bautizado`, `fecha_sacramento`, `padres`, `padrinos`.
- **Análisis de Confianza vs Exactitud**: Gráfica de calibración que compara el score de confianza de la IA con la tasa real de aceptación humana, permitiendo ajustar dinámicamente el umbral óptimo.
