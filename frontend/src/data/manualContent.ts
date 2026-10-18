/**
 * CodexFlow — Manual Interactivo del Software, Centro de Ayuda y Base de Conocimiento Operativa
 * 
 * Este módulo contiene la especificación de tipos y la documentación estructurada completa
 * para la base de conocimiento offline-first del sistema.
 */

// ============================================================================
// 1. TIPOS E INTERFACES TYPESCRIPT (T01)
// ============================================================================

export type TargetRole = 'all' | 'admin' | 'archivist' | 'digitizer' | 'evaluator';

export interface CalloutBox {
  type: 'note' | 'warning' | 'tip' | 'archival';
  title: string;
  content: string;
}

export interface ShortcutItem {
  keys: string[];
  description: string;
  context: string;
}

export interface ContentStep {
  stepNumber: number;
  title: string;
  description: string;
  tips?: string[];
}

export interface ContentTable {
  headers: string[];
  rows: string[][];
}

export interface ManualSection {
  id: string;
  title: string;
  targetRole: TargetRole;
  summary: string;
  steps?: ContentStep[];
  callouts?: CalloutBox[];
  shortcuts?: ShortcutItem[];
  table?: ContentTable;
  keyPoints?: string[];
}

export interface ManualChapter {
  id: string;
  number: number;
  title: string;
  badge: string;
  iconName: string;
  targetRole: TargetRole;
  summary: string;
  sections: ManualSection[];
}

// ============================================================================
// 2. CHEAT SHEET GLOBAL DE ATAJOS DE TECLADO (T03)
// ============================================================================

export const GLOBAL_SHORTCUTS: ShortcutItem[] = [
  {
    keys: ['Ctrl', 'Enter'],
    description: 'Guardar partida y alternar automáticamente folio (Recto/Vuelto) en el Visor, o Aprobar y certificar registro en la Mesa de Evaluación.',
    context: 'Visor de Transcripción / Mesa de Evaluación',
  },
  {
    keys: ['Alt', 'N'],
    description: 'Crear una nueva partida sacramental dentro del mismo folio físico activo sin perder el contexto visual.',
    context: 'Visor de Transcripción',
  },
  {
    keys: ['Alt', 'R'],
    description: 'Devolver / rechazar la partida en revisión requiriendo la captura obligatoria de una nota prioritaria de discrepancia.',
    context: 'Mesa de Evaluación',
  },
  {
    keys: ['Ctrl', 'U'],
    description: 'Insertar la etiqueta canónica normalizada <Ilegible> en el campo de texto en foco.',
    context: 'Visor de Transcripción',
  },
  {
    keys: ['Ctrl', 'B'],
    description: 'Declarar el folio completo como <En Blanco>, registrando la constancia canónica sin crear partidas huérfanas.',
    context: 'Visor de Transcripción',
  },
  {
    keys: ['Ctrl', 'D'],
    description: 'Duplicar de manera instantánea el valor del campo homólogo desde la partida sacramental inmediatamente anterior.',
    context: 'Visor de Transcripción',
  },
  {
    keys: ['L'],
    description: 'Activar o desactivar la Lupa Óptica Virtual flotante de alta precisión para inspección de trazos paleográficos.',
    context: 'Visor Paleográfico',
  },
  {
    keys: ['Alt', 'A'],
    description: 'Alternar la visualización de las cajas delimitadoras de IA (Bounding Boxes) sobre el facsímil.',
    context: 'Visor Paleográfico',
  },
  {
    keys: ['Alt', 'F'],
    description: 'Abrir y cerrar el panel de filtros fotográficos espectrales (inversión negativa, contraste dinámico, binarización).',
    context: 'Visor Paleográfico',
  },
  {
    keys: ['Alt', 'E'],
    description: 'Escalar el folio o partida conflictiva directamente a la Bandeja de Dudosos del Archivista.',
    context: 'Visor de Transcripción / Mesa de Evaluación',
  },
  {
    keys: ['Alt', 'P'],
    description: 'Plegar o desplegar el panel superior retráctil de control de arbitraje [▲ / ▼].',
    context: 'Mesa de Evaluación',
  },
  {
    keys: ['Alt', '→'],
    description: 'Avanzar a la siguiente partida en la cola de trabajo o folio siguiente.',
    context: 'Visor / Mesa de Evaluación',
  },
  {
    keys: ['Alt', '←'],
    description: 'Retroceder a la partida anterior en la cola de trabajo o folio previo.',
    context: 'Visor / Mesa de Evaluación',
  },
  {
    keys: ['Tab'],
    description: 'Navegar secuencialmente hacia adelante entre los campos del formulario sacramental.',
    context: 'Formularios / Global',
  },
  {
    keys: ['Shift', 'Tab'],
    description: 'Navegar secuencialmente hacia atrás entre los campos del formulario sacramental.',
    context: 'Formularios / Global',
  },
  {
    keys: ['F11'],
    description: 'Alternar el modo de pantalla completa inmersiva para transcripción y cotejo sin distracciones visuales.',
    context: 'Global',
  },
  {
    keys: ['Escape'],
    description: 'Cerrar diálogos modales activos, desactivar la lupa óptica flotante o cancelar la herramienta en uso.',
    context: 'Global',
  },
];

// ============================================================================
// 3. CAPÍTULOS CANÓNICOS DEL MANUAL (T02 y T03)
// ============================================================================

export const MANUAL_CHAPTERS: ManualChapter[] = [
  // --------------------------------------------------------------------------
  // CAPÍTULO 1: INTRODUCCIÓN Y ARQUITECTURA DE CODEXFLOW
  // --------------------------------------------------------------------------
  {
    id: 'capitulo-1',
    number: 1,
    title: 'Introducción y Arquitectura de CodexFlow',
    badge: 'Fundamentos',
    iconName: 'ShieldCheck',
    targetRole: 'all',
    summary: 'Visión general de CodexFlow, principios de soberanía archivística eclesiástica, arquitectura multi-tenant con Row-Level Security (RLS) en PostgreSQL, almacenamiento de alta seguridad en Cloudflare R2 sin costo de egress y ciclo de producción integral desde la captura DCam hasta la exportación normalizada a FamilySearch.',
    sections: [
      {
        id: 'mision-soberania-archivistica',
        title: 'Misión de Preservación y Soberanía Canónica',
        targetRole: 'all',
        summary: 'CodexFlow es un ecosistema tecnológico diseñado para salvaguardar el patrimonio documental de la Iglesia Católica y de instituciones históricas, asegurando que cada acta sacramental permanezca bajo el estricto control canónico de su respectiva diócesis u orden religiosa.',
        keyPoints: [
          'La custodia de los fondos sacramentales pertenece de manera inalienable a la diócesis u orden custodia.',
          'La digitalización sistemática previene la pérdida irreversible debida a humedad, acidez de tintas ferrogálicas, insectos xilófagos o catástrofes naturales.',
          'CodexFlow no es un simple visor de imágenes: constituye una cadena de custodia digital que homologa metadatos bajo las normas canónicas y el estándar archivístico internacional ISAD(G).'
        ],
        callouts: [
          {
            type: 'archival',
            title: 'Mandato Canónico de Preservación',
            content: 'Desde las disposiciones del Concilio de Trento (1563) y el Código de Derecho Canónico (Can. 535), los párrocos están obligados a registrar diligentemente los bautismos, matrimonios y defunciones, y a custodiar los libros en el archivo parroquial. CodexFlow traslada esta responsabilidad secular a la era digital moderna.'
          }
        ]
      },
      {
        id: 'arquitectura-multitenant-rls',
        title: 'Arquitectura Multi-Tenant con Aislamiento Estricto (RLS)',
        targetRole: 'admin',
        summary: 'La infraestructura de CodexFlow está blindada mediante partición lógica multi-inquilino. Cada diócesis opera en un subdominio dedicado (ej. carupano.codexflow.com) y sus registros están aislados en base de datos mediante políticas de Row-Level Security (RLS) de PostgreSQL.',
        keyPoints: [
          'Aislamiento de capa cero: Ninguna consulta SQL puede ejecutarse en el sistema sin inyectar explícitamente el tenant_id autenticado.',
          'Políticas nativas de base de datos impiden que personal de una diócesis visualice o altere datos de otra jurisdicción, incluso en escenarios de fuga de sesión en cliente.',
          'Identidad de dominio canónico: Cada curia o diócesis dispone de su propio espacio de trabajo con personalización visual e institucional.'
        ],
        table: {
          headers: ['Nivel de Seguridad', 'Mecanismo de Control', 'Garantía Operativa'],
          rows: [
            ['Enrutamiento DNS / HTTP', 'Subdominios aislados (*.codexflow.com)', 'Aislamiento contextual de cookies, tokens de sesión y almacenamiento local.'],
            ['Base de Datos (SQL)', 'PostgreSQL Row-Level Security (RLS)', 'Filtrado forzoso por tenant_id a nivel de motor de datos en toda consulta.'],
            ['Repositorio de Archivos', 'Directorios estructurados en Cloudflare R2', 'Prefijado por tenant_id con tokens prefirmados de acceso temporal.'],
            ['Control de Acceso (RBAC)', 'Políticas de rol granulares por usuario', 'Restricción de vistas y mutaciones según el rol asignado.']
          ]
        },
        callouts: [
          {
            type: 'warning',
            title: 'Regla de Oro Constitucional Multi-Tenant',
            content: 'Bajo ninguna circunstancia un usuario u operador puede traspasar las fronteras de su tenant asignado. Cualquier intento de consulta cruzada es bloqueado en backend y registrado inmediatamente en los registros de auditoría de seguridad.'
          }
        ]
      },
      {
        id: 'almacenamiento-cloudflare-r2',
        title: 'Almacenamiento de Facsímiles en Cloudflare R2 sin Costo de Egress',
        targetRole: 'archivist',
        summary: 'Los facsímiles de alta resolución y archivos maestros se conservan en Cloudflare R2, eliminando las penalizaciones económicas por volumen de descarga y garantizando disponibilidad ultra-rápida mediante una red de entrega global (Edge CDN).',
        keyPoints: [
          'Tarifa cero por egreso de datos: Las diócesis pueden consultar, transcribir y auditar millones de folios sin incurrir en cobros variables imprevistos.',
          'Almacenamiento inmutable: Los archivos maestros cargados no sufren compresión destructiva en el repositorio original.',
          'Optimización DZI (Deep Zoom Images): Los facsímiles de gran peso se sirven fraccionados en teselas para renderizado fluido en el Visor Paleográfico en menos de 1.2 segundos.'
        ],
        callouts: [
          {
            type: 'tip',
            title: 'Velocidad de Carga en Conexiones Parroquiales',
            content: 'Gracias a la arquitectura de teselado piramidal servida desde R2 Edge, un folio de 50 Megapíxeles puede visualizarse instantáneamente con ancho de banda modesto, cargando solo los cuadrantes visualizados por el transcriptor.'
          }
        ]
      },
      {
        id: 'ciclo-produccion-documental',
        title: 'Ciclo de Producción Documental: De la Toma DCam a FamilySearch',
        targetRole: 'all',
        summary: 'CodexFlow articula una cadena de producción lineal, transparente y reproducible que convierte libros parroquiales físicos en paquetes de difusión normalizados de grado genealógico e histórico.',
        steps: [
          {
            stepNumber: 1,
            title: 'Captura Fotográfica Cenital DCam',
            description: 'Toma fotográfica de cada folio físico con estación cenital, iluminación balanceada y carta de color, conforme a los estándares de Digital Camera (DCam) de FamilySearch.',
            tips: ['Mantener la numeración física visible en el encuadre.', 'Verificar el enfoque y balance de blancos antes de iniciar la sesión de disparo.']
          },
          {
            stepNumber: 2,
            title: 'Ingesta y Foliación Jerárquica',
            description: 'El archivista crea la estructura Diócesis > Parroquia > Serie > Tomo, carga los facsímiles a Cloudflare R2 y valida la secuencia física Recto/Vuelto.',
            tips: ['Configurar adecuadamente canonical_place para garantizar herencia territorial automática.']
          },
          {
            stepNumber: 3,
            title: 'Transcripción Paleográfica Ergonómica',
            description: 'El digitador transcribe cada acta sacramental empleando el Visor Paleográfico 100% mediante teclado y atajos rápidos, minimizando el cansancio visual.',
            tips: ['Utilizar la Lupa [L] para ligaduras paleográficas complejas y Ctrl+D para campos repetitivos.']
          },
          {
            stepNumber: 4,
            title: 'Arbitraje y Doble Cotejo en Mesa de Calidad',
            description: 'El evaluador revisa cada registro confrontándolo directamente con el facsímil original, determinando su aprobación, corrección o escalamiento a dudosos.',
            tips: ['Los registros certificados pasan automáticamente al conjunto Gold Standard para Active Learning de IA.']
          },
          {
            stepNumber: 5,
            title: 'Generación y Exportación del Paquete DIP',
            description: 'Empaquetado final con matriz Excel estilizada, CSV universal (UTF-8 con BOM), archivo de genealogía GEDCOM 5.5.1 y manifiesto de integridad SHA-256.',
            tips: ['Activar el filtro only_verified para exportaciones oficiales de entrega canónica.']
          }
        ]
      }
    ]
  },

  // --------------------------------------------------------------------------
  // CAPÍTULO 2: GUÍA DEL ADMINISTRADOR DE LA ORGANIZACIÓN
  // --------------------------------------------------------------------------
  {
    id: 'capitulo-2',
    number: 2,
    title: 'Guía del Administrador de la Organización',
    badge: 'Administración',
    iconName: 'Users',
    targetRole: 'admin',
    summary: 'Procedimientos institucionales para el onboarding de la organización diocesana, emisión y monitoreo de invitaciones seguras mediante Magic Link, modelo de roles RBAC y mecanismos de blindaje contra la auto-degradación de la cuenta de administración principal.',
    sections: [
      {
        id: 'onboarding-configuracion-diocesana',
        title: 'Onboarding y Configuración de la Sede Diocesana',
        targetRole: 'admin',
        summary: 'Configuración inicial del espacio de trabajo canónico, definición de la jurisdicción eclesiástica y establecimiento de parámetros operativos del tenant.',
        steps: [
          {
            stepNumber: 1,
            title: 'Aprovisionamiento del Subdominio Institucional',
            description: 'El administrador valida que el subdominio configurado (ej. diocesis-cumana.codexflow.com) responde adecuadamente y refleja la identidad de la curia.',
            tips: ['Evitar caracteres especiales o acentos en la denominación técnica del subdominio.']
          },
          {
            stepNumber: 2,
            title: 'Definición de Identidad Canónica y Geográfica',
            description: 'Registrar la denominación oficial de la Diócesis o Arquidiócesis, país, estado o provincia, y localidad sede para la adecuada vinculación canónica.',
            tips: ['Esta información alimentará automáticamente el encabezado canónico de los paquetes de exportación GEDCOM.']
          },
          {
            stepNumber: 3,
            title: 'Ajuste de Parámetros de Retención y Sesión',
            description: 'Configurar tiempos de expiración de sesiones inactivas y políticas de renovación de tokens de acceso para salvaguardar las estaciones de trabajo parroquiales.',
            tips: ['Recomendado: 8 horas para digitadores de jornada completa y 2 horas para terminales compartidas.']
          }
        ]
      },
      {
        id: 'invitaciones-magic-link',
        title: 'Gestión de Usuarios e Invitaciones por Magic Link',
        targetRole: 'admin',
        summary: 'Incorporación segura de voluntarios, transcriptores paleógrafos y evaluadores mediante enlaces mágicos de un solo uso enviados por correo electrónico, suprimiendo la fragilidad de contraseñas compartidas.',
        steps: [
          {
            stepNumber: 1,
            title: 'Acceder a la Consola de Administración de Equipo',
            description: 'En la barra lateral de navegación, seleccionar la opción "Equipo" (ruta /[subdomain]/settings/users).',
            tips: ['Esta vista únicamente es visible para usuarios con rol admin.']
          },
          {
            stepNumber: 2,
            title: 'Introducir Correo y Asignar Rol Específico',
            description: 'Ingresar el correo institucional o personal del colaborador y seleccionar su rol operativo con precisión (Digitador, Evaluador, Archivista o Administrador).',
            tips: ['Asignar digitizer a quienes solo transcribirán y evaluator a revisores experimentados.']
          },
          {
            stepNumber: 3,
            title: 'Emisión y Monitoreo del Enlace Criptográfico',
            description: 'Al hacer clic en "Enviar Invitación", el sistema genera un Magic Link con un token firmado criptográficamente válido por 48 horas.',
            tips: ['En caso de extravío o expiración, el administrador puede reemitir la invitación con un solo clic desde la tabla de usuarios pendientes.']
          }
        ],
        callouts: [
          {
            type: 'note',
            title: 'Seguridad de los Magic Links',
            content: 'Cada enlace de invitación queda invalidado en el instante en que el usuario completa su primer acceso y establece sus credenciales seguras. Los enlaces son estrictamente de un solo uso.'
          }
        ]
      },
      {
        id: 'matriz-roles-rbac',
        title: 'Matriz de Permisos RBAC y Privilegios Granulares',
        targetRole: 'admin',
        summary: 'CodexFlow implementa un esquema de Control de Acceso Basado en Roles (RBAC) con estricta segregación de funciones canónicas y operativas.',
        table: {
          headers: ['Módulo / Acción', 'Digitador (digitizer)', 'Evaluador (evaluator)', 'Archivista (archivist)', 'Administrador (admin)'],
          rows: [
            ['Visor de Indexación', 'Acceso Completo (Escritura)', 'Acceso Completo (Lectura)', 'Acceso Completo (Lectura)', 'Acceso Completo (Lectura)'],
            ['Mesa de Evaluación', 'Sin Acceso', 'Acceso Completo (Arbitraje)', 'Acceso Completo (Arbitraje)', 'Acceso Completo (Arbitraje)'],
            ['Ingesta y Tomos (DCam)', 'Sin Acceso', 'Sin Acceso', 'Acceso Completo (Carga / Dudosos)', 'Acceso Completo (Carga / Dudosos)'],
            ['Explorador y Exportación', 'Sin Acceso', 'Acceso Lectura', 'Acceso Completo (Exportar DIP)', 'Acceso Completo (Exportar DIP)'],
            ['Gestión de Equipo / Tenant', 'Sin Acceso', 'Sin Acceso', 'Sin Acceso', 'Acceso Completo (Admin Total)'],
            ['Mis Métricas Personales', 'Métricas Propias', 'Métricas Propias', 'Métricas Globales', 'Métricas Globales']
          ]
        },
        keyPoints: [
          'Principio de menor privilegio: Los digitadores no pueden alterar libros en ingesta ni exportar matrices de datos masivos.',
          'Separación de funciones de calidad: El evaluador audita y certifica, evitando que quien transcribe certifique sus propias partidas sin doble cotejo.'
        ]
      },
      {
        id: 'blindaje-ultimo-admin',
        title: 'Blindaje contra Auto-Degradación del Último Administrador',
        targetRole: 'admin',
        summary: 'Mecanismo de seguridad activo que previene que una organización quede acéfala o inaccesible por error involuntario de configuración de cuentas.',
        keyPoints: [
          'La base de datos y la capa de API interceptan cualquier solicitud de cambio de rol o eliminación de cuenta proveniente de un usuario administrador.',
          'Si el sistema detecta que el solicitante es el único administrador activo del tenant, la operación es abortada con error 400 (Bad Request).',
          'Para transferir la administración, se debe invitar y activar previamente a un segundo administrador antes de poder degradar o remover al primero.'
        ],
        callouts: [
          {
            type: 'warning',
            title: 'Regla de Supervivencia Canónica',
            content: 'El sistema no permite bajo ninguna circunstancia que el último administrador de un tenant se auto-degrade a digitador o elimine su propio perfil. Esta protección garantiza que la diócesis conserve siempre la gobernanza de su repositorio digital.'
          }
        ]
      }
    ]
  },

  // --------------------------------------------------------------------------
  // CAPÍTULO 3: GUÍA DEL ARCHIVISTA (GESTIÓN DCAM & INGESTA)
  // --------------------------------------------------------------------------
  {
    id: 'capitulo-3',
    number: 3,
    title: 'Guía del Archivista: Gestión DCam e Ingesta',
    badge: 'Archivística',
    iconName: 'UploadCloud',
    targetRole: 'archivist',
    summary: 'Estructuración canónica del archivo eclesiástico (Diócesis > Parroquia > Serie Sacramental > Tomo), herencia territorial automática mediante canonical_place, directrices técnicas de captura fotográfica DCam, carga masiva de facsímiles (JPEG/PDF) y resolución de folios conflictivos en la Bandeja de Dudosos.',
    sections: [
      {
        id: 'jerarquia-custodia-canonical-place',
        title: 'Jerarquía Documental y Herencia Territorial (canonical_place)',
        targetRole: 'archivist',
        summary: 'Esquema jerárquico canónico que organiza la documentación parroquial y asegura que cada acta sacramental herede la denominación geográfica y eclesiástica de su sede original.',
        steps: [
          {
            stepNumber: 1,
            title: 'Selección o Alta de la Parroquia Histórica',
            description: 'Identificar la parroquia titular (ej. Parroquia San José de Areocual) y asociarla a su circunscripción diocesana.',
            tips: ['Verificar la fecha de erección canónica de la parroquia para libros antiguos.']
          },
          {
            stepNumber: 2,
            title: 'Asignación de la Serie Sacramental',
            description: 'Clasificar el fondo según los sacramentos canónicos: Bautismos, Matrimonios, Defunciones, Confirmaciones o Informaciones Matrimoniales.',
            tips: ['No mezclar series sacramentales en un mismo tomo a menos que el libro físico original sea un misceláneo.']
          },
          {
            stepNumber: 3,
            title: 'Creación del Tomo o Libro Físico',
            description: 'Registrar el número de tomo, año inicial, año final y signatura topográfica de archivo físico.',
            tips: ['Consignar si el tomo presenta numeración original corrida o foliación moderna añadida a lápiz.']
          },
          {
            stepNumber: 4,
            title: 'Validación del Campo canonical_place',
            description: 'El sistema compila y hereda el estándar de localidad: Parroquia, Municipio/Cantón, Estado/Provincia, País.',
            tips: ['Este valor canónico se adjuntará a cada registro para su indexación directa en el árbol de FamilySearch.']
          }
        ],
        callouts: [
          {
            type: 'archival',
            title: 'Diferencia Canónica vs División Político-Territorial',
            content: 'Los límites parroquiales históricos frecuentemente no coinciden con los municipios civiles contemporáneos. El campo canonical_place de CodexFlow preserva la nomenclatura eclesiástica canónica original requerida por la archivística de la Iglesia.'
          }
        ]
      },
      {
        id: 'estandar-captura-dcam',
        title: 'Estandarización de Tomas Fotográficas (Norma DCam)',
        targetRole: 'archivist',
        summary: 'Requisitos técnicos y físicos indispensables para la digitalización con cámara cenital antes de subir facsímiles al sistema.',
        keyPoints: [
          'Resolución óptica nativa mínima: 300 puntos por pulgada (DPI) al tamaño real del documento físico original.',
          'Inclusión de carta de balance de blancos y escala milimétrica en la primera toma de calibración de cada sesión.',
          'Iluminación suave difusa (sin destellos de flash directo) en ángulo de 45 grados para no quemar el papel ni acentuar ondulaciones.',
          'Encuadre completo: Debe apreciarse el margen exterior del folio y el lomo del tomo sin cercenar firmas ni notas marginales.'
        ],
        table: {
          headers: ['Parámetro Técnico', 'Estándar Recomendado', 'Tolerancia Mínima'],
          rows: [
            ['Resolución', '400 DPI / 50 Megapíxeles', '300 DPI / 24 Megapíxeles'],
            ['Formato de Archivo', 'JPEG de alta calidad (calidad 90+) o TIFF', 'JPEG sin artefactos de compresión visibles'],
            ['Espacio de Color', 'sRGB o Adobe RGB 1998', 'sRGB calibrado'],
            ['Profundidad de Color', '24-bit Color Verdadero (8 bits por canal)', '24-bit Color'],
            ['Orientación', 'Lectura vertical natural (Recto a la derecha)', 'Rotación vertical sin inclinación > 1 grado']
          ]
        }
      },
      {
        id: 'carga-facsimiles-gestion-tomos',
        title: 'Carga Masiva de Facsímiles a Cloudflare R2',
        targetRole: 'archivist',
        summary: 'Mecanismo de subida masiva por lotes que procesa imágenes individuales o archivos PDF multipágina para generar tomos digitales.',
        steps: [
          {
            stepNumber: 1,
            title: 'Acceder al Módulo de Ingesta',
            description: 'En el menú lateral, hacer clic en "Ingesta/Dudosos" y seleccionar la pestaña "Carga de Facsímiles".',
            tips: ['Comprobar que el tomo de destino esté creado antes de iniciar la subida.']
          },
          {
            stepNumber: 2,
            title: 'Arrastre y Depósito de Archivos',
            description: 'Arrastrar la carpeta de imágenes fotográficas numeradas correlativamente (ej. 001.jpg a 250.jpg) o el archivo PDF escaneado.',
            tips: ['El sistema ordena automáticamente los archivos por orden alfanumérico estricto.']
          },
          {
            stepNumber: 3,
            title: 'Procesamiento en Segundo Plano y Generación DZI',
            description: 'Las imágenes se transmiten de manera segura a Cloudflare R2, desencadenando la creación de teselas Deep Zoom para visualización inmediata.',
            tips: ['No es necesario esperar a que concluya el lote completo para continuar navegando.']
          }
        ]
      },
      {
        id: 'bandeja-dudosos-foliacion',
        title: 'Foliación Física Recto/Vuelto y Bandeja de Dudosos',
        targetRole: 'archivist',
        summary: 'Gestión de excepciones archivísticas: folios bis, páginas rasgadas, actas en blanco y casos escalados por digitadores o evaluadores.',
        keyPoints: [
          'La Bandeja de Dudosos clasifica folios con insignias semánticas: Duda Paleográfica, Folio Deteriorado, Salto de Numeración y Error de Encuadre.',
          'El archivista tiene potestad para reordenar la secuencia física, insertar folios suplementarios (ej. Folio 45 bis) o devolver el folio con notas de instrucción al transcriptor.',
          'Resolución de dudas: El archivista puede consultar el libro físico original en el archivo y despejar lecturas ambiguas directamente en la ficha del tomo.'
        ],
        callouts: [
          {
            type: 'tip',
            title: 'Resolución de Saltos de Foliación',
            content: 'Si el encuadernador histórico omitió un número de folio (ej. del folio 23 pasa al 25), el archivista debe registrar la nota aclaratoria en la ficha del tomo para que el evaluador no rechace las partidas por supuesta pérdida documental.'
          }
        ]
      }
    ]
  },

  // --------------------------------------------------------------------------
  // CAPÍTULO 4: GUÍA DEL DIGITADOR (VISOR PALEOGRÁFICO ERGONÓMICO)
  // --------------------------------------------------------------------------
  {
    id: 'capitulo-4',
    number: 4,
    title: 'Guía del Digitador: Visor Paleográfico Ergonómico',
    badge: 'Transcripción',
    iconName: 'Scan',
    targetRole: 'digitizer',
    summary: 'Operación diaria del Visor Dual Ergonómico: flujo de trabajo 100% mediante teclado sin requerir ratón, alternancia automática Recto/Vuelto con Ctrl+Enter, manejo de múltiples partidas por folio con Alt+N, uso de la Lupa óptica interactiva [L], filtros fotográficos de realce de tintas, atajos de estandarización paleográfica y autoguardado en memoria local tolerante a caídas de red.',
    sections: [
      {
        id: 'operacion-teclado-ergonomia',
        title: 'Operación 100% Teclado y Ergonomía Visual',
        targetRole: 'digitizer',
        summary: 'El Visor Dual de CodexFlow está optimizado para permitir que el 95% de la captura se realice sin levantar las manos del teclado, mitigando lesiones por esfuerzo repetitivo (RSI) y acelerando la velocidad de captura.',
        shortcuts: [
          {
            keys: ['Tab'],
            description: 'Avanzar al siguiente campo del formulario de partida sacramental.',
            context: 'Visor de Transcripción'
          },
          {
            keys: ['Shift', 'Tab'],
            description: 'Retroceder al campo anterior del formulario sacramental.',
            context: 'Visor de Transcripción'
          },
          {
            keys: ['Ctrl', 'Enter'],
            description: 'Guardar la partida en curso y avanzar automáticamente al folio Vuelto o al siguiente número de folio.',
            context: 'Visor de Transcripción'
          },
          {
            keys: ['Alt', 'N'],
            description: 'Crear una nueva partida sacramental en el mismo folio activo.',
            context: 'Visor de Transcripción'
          },
          {
            keys: ['F11'],
            description: 'Modo pantalla completa inmersiva para expandir el lienzo de visualización del manuscrito.',
            context: 'Global'
          }
        ],
        callouts: [
          {
            type: 'tip',
            title: 'Postura y Ergonomía en Paleografía',
            content: 'Recomendamos activar el modo de pantalla completa [F11] y apoyar ambos antebrazos sobre el escritorio. La disposición de campos en el formulario reproduce la sintaxis habitual de las fórmulas eclesiásticas (Fecha, Celebrante, Bautizado/Contrayentes, Padres, Padrinos).'
          }
        ]
      },
      {
        id: 'lupa-filtros-fotograficos',
        title: 'Inspección Óptica: Lupa Interactiva y Filtros Espectrales',
        targetRole: 'digitizer',
        summary: 'Herramientas de aumento y realce de imagen que permiten descifrar trazos desvanecidos, abreviaturas con nudo y letras enrevesadas de los siglos XVI al XIX.',
        keyPoints: [
          'Lupa flotante de alta precisión [L]: Proporciona un aumento instantáneo de 2.5x a 4x en la zona del cursor sin alterar el nivel de zoom general del documento.',
          'Filtro de Inversión Negativa: Convierte fondo sepia oscuro en negro y tinta desvanecida en trazo blanco brillante, facilitando la lectura de tintas pálidas.',
          'Filtro de Contraste y Binarización Dinámica: Resalta las partículas ferrogálicas sobre el grano del papel de tina.'
        ],
        shortcuts: [
          {
            keys: ['L'],
            description: 'Activar o desactivar la Lupa Óptica Virtual interactiva.',
            context: 'Visor Paleográfico'
          },
          {
            keys: ['Alt', 'F'],
            description: 'Abrir el panel de filtros fotográficos espectrales (inversión, contraste, brillo).',
            context: 'Visor Paleográfico'
          },
          {
            keys: ['Alt', 'A'],
            description: 'Alternar la visualización de las Bounding Boxes sugeridas por el motor de IA.',
            context: 'Visor Paleográfico'
          }
        ]
      },
      {
        id: 'foliacion-recto-vuelto',
        title: 'Foliación Física Recto / Vuelto con Alternancia Inteligente',
        targetRole: 'digitizer',
        summary: 'En los libros eclesiásticos antiguos no se numeraban páginas sino folios (hojas). Cada folio consta de dos caras: el anverso o "Recto" (r) y el reverso o "Vuelto" (v).',
        steps: [
          {
            stepNumber: 1,
            title: 'Transcripción de la Primera Partida del Folio',
            description: 'El digitador transcribe las partidas que figuran en el folio 1r (Recto).',
            tips: ['Verificar siempre que el número impreso o manuscrito del folio coincida con el encabezado superior del visor.']
          },
          {
            stepNumber: 2,
            title: 'Múltiples Actas en la Misma Cara (Alt + N)',
            description: 'Si en el mismo folio 1r constan dos o más partidas, pulsar Alt+N para abrir un nuevo formulario en el mismo folio sin avanzar la imagen.',
            tips: ['Cada partida conserva su propia foliación y orden relativo (Partida 1 de 3, etc.).']
          },
          {
            stepNumber: 3,
            title: 'Alternancia Inteligente (Ctrl + Enter)',
            description: 'Al concluir las partidas de la cara activa, presionar Ctrl+Enter. El sistema guarda la partida, actualiza el indicador de 1r a 1v y desplaza la imagen a la cara correspondiente.',
            tips: ['Al terminar el folio 1v, otro Ctrl+Enter avanzará de forma natural hacia el folio 2r.']
          }
        ]
      },
      {
        id: 'atajos-paleograficos-irregularidades',
        title: 'Atajos Paleográficos y Manejo de Irregularidades',
        targetRole: 'digitizer',
        summary: 'Tratamiento normalizado de abreviaturas, palabras ilegibles, hojas en blanco y agilización de campos repetitivos.',
        shortcuts: [
          {
            keys: ['Ctrl', 'U'],
            description: 'Marcar el campo actual con la etiqueta canónica normalizada <Ilegible>.',
            context: 'Visor de Transcripción'
          },
          {
            keys: ['Ctrl', 'B'],
            description: 'Marcar el folio completo como <En Blanco>, registrando la constancia formal.',
            context: 'Visor de Transcripción'
          },
          {
            keys: ['Ctrl', 'D'],
            description: 'Duplicar el valor del campo homólogo desde el acta sacramental anterior (ej. Sacerdote o Parroquia).',
            context: 'Visor de Transcripción'
          },
          {
            keys: ['Alt', 'E'],
            description: 'Escalar el folio a la Bandeja de Dudosos para asistencia del Archivista.',
            context: 'Visor de Transcripción'
          }
        ],
        table: {
          headers: ['Etiqueta / Atajo', 'Uso Canónico Adecuado', 'Efecto en la Exportación Final'],
          rows: [
            ['<Ilegible> (Ctrl + U)', 'Trazos carcomidos, tintas desvanecidas o manchas que impiden leer con certeza un nombre o fecha.', 'FamilySearch y GEDCOM lo reconocen como valor indeterminado sin bloquear la partida.'],
            ['<En Blanco> (Ctrl + B)', 'Folios encuadernados vacíos, portadillas o páginas sin asientos sacramentales.', 'Crea un hito de foliación continua sin partidas huérfanas en el tomo.'],
            ['Duplicar (Ctrl + D)', 'Nombres de párrocos, padrinos comunes en un mismo día o lugares de residencia idénticos.', 'Copia el texto idéntico en < 50ms evitando tecleos redundantes.']
          ]
        }
      },
      {
        id: 'resiliencia-offline-borrador',
        title: 'Autoguardado Local y Resiliencia ante Cortes de Conexión',
        targetRole: 'digitizer',
        summary: 'CodexFlow protege el trabajo del digitador frente a desconexiones de red repentinas frecuentes en archivos parroquiales rurales mediante persistencia en caché local (IndexedDB).',
        keyPoints: [
          'Cada pulsación de tecla actualiza un borrador cifrado en la memoria local del navegador.',
          'Si la conexión a internet cae, el indicador superior cambia a "Modo Local / Sin Conexión", permitiendo continuar transcribiendo sin interrupción.',
          'Al restablecerse el enlace, la cola de sincronización envía automáticamente los borradores locales al servidor sin duplicar registros ni perder trabajo.'
        ],
        callouts: [
          {
            type: 'note',
            title: 'Protección de Borradores en Caso de Cierre Fortuito',
            content: 'Si la batería del equipo se agota o se cierra el navegador por equivocación, al volver a abrir el tomo en el Visor, CodexFlow detecta el borrador local y ofrece restaurar de inmediato el estado exacto del formulario.'
          }
        ]
      }
    ]
  },

  // --------------------------------------------------------------------------
  // CAPÍTULO 5: GUÍA DEL EVALUADOR DE CALIDAD (MESA DE ARBITRAJE)
  // --------------------------------------------------------------------------
  {
    id: 'capitulo-5',
    number: 5,
    title: 'Guía del Evaluador de Calidad: Mesa de Arbitraje',
    badge: 'Calidad',
    iconName: 'CheckSquare',
    targetRole: 'evaluator',
    summary: 'Metodología de control de calidad paleográfico mediante doble cotejo simultáneo: facsímil en alta resolución contra transcripción, operación ágil del panel retráctil de arbitraje [▲ / ▼], ejecución de los 3 veredictos canónicos (Aprobar, Devolver con notas prioritarias o Escalar a Dudosos) y ciclo de retroalimentación Active Learning para el reentrenamiento de modelos de IA.',
    sections: [
      {
        id: 'metodologia-doble-cotejo',
        title: 'Metodología de Doble Cotejo y Panel Retráctil',
        targetRole: 'evaluator',
        summary: 'La Mesa de Evaluación confronta la verdad visual del documento histórico con los datos capturados por el digitador, asegurando cero tolerancia a alucinaciones o errores de lectura.',
        keyPoints: [
          'Doble cotejo sincronizado: La imagen del facsímil se enfoca en las coordenadas de la partida seleccionada mientras los campos transcritos se despliegan para validación inmediata.',
          'Panel retráctil superior [Alt + P]: El evaluador puede colapsar o desplegar la cabecera con el botón toggle [▲ / ▼] para maximizar el área de inspección visual del manuscrito.',
          'Navegación secuencial por teclado: Movimiento fluido entre actas pendientes con [Alt + →] y [Alt + ←].'
        ],
        shortcuts: [
          {
            keys: ['Alt', 'P'],
            description: 'Plegar o desplegar el panel superior de arbitraje [▲ / ▼].',
            context: 'Mesa de Evaluación'
          },
          {
            keys: ['Alt', '→'],
            description: 'Avanzar a la siguiente partida de la cola de evaluación.',
            context: 'Mesa de Evaluación'
          },
          {
            keys: ['Alt', '←'],
            description: 'Retroceder a la partida previa de la cola de evaluación.',
            context: 'Mesa de Evaluación'
          }
        ],
        callouts: [
          {
            type: 'archival',
            title: 'Responsabilidad Canónica del Evaluador',
            content: 'Un error en la transcripción de un nombre o parentesco en una partida de bautismo o matrimonio puede distorsionar árboles genealógicos centenarios o invalidar trámites canónicos. La revisión del evaluador es el sello de certeza jurídica del sistema.'
          }
        ]
      },
      {
        id: 'tres-veredictos',
        title: 'Los Tres Veredictos del Evaluador Canónico',
        targetRole: 'evaluator',
        summary: 'Ante cada partida sometida a cotejo, el evaluador cuenta con tres vías resolutivas ejecutables mediante atajos de teclado.',
        steps: [
          {
            stepNumber: 1,
            title: 'Veredicto 1: Aprobar y Certificar (Ctrl + Enter)',
            description: 'Si la transcripción es fiel y exacta, el evaluador presiona Ctrl+Enter. El registro adquiere el estado canónico "verified", se bloquea contra ediciones accidentales y queda calificado para exportación DIP.',
            tips: ['Si detecta una falta ortográfica menor o errata evidente, el evaluador puede corregirla directamente antes de certificar.']
          },
          {
            stepNumber: 2,
            title: 'Veredicto 2: Devolver al Digitador con Nota Prioritaria (Alt + R)',
            description: 'Si la partida contiene omisiones graves, nombres truncados o mala interpretación paleográfica, presionar Alt+R. Se abre un diálogo modal obligatorio donde se redacta la instrucción prioritaria (ej. "Revisar apellido materno en la tercera línea").',
            tips: ['El registro regresa a la cola del digitador con una insignia roja de corrección prioritaria y la nota visible.']
          },
          {
            stepNumber: 3,
            title: 'Veredicto 3: Escalar al Archivista como Dudoso (Alt + E)',
            description: 'Si el acta plantea un conflicto paleográfico de fondo, una mutilación física del folio o una alteración sospechosa en el libro original, presionar Alt+E para remitirla a la Bandeja de Dudosos.',
            tips: ['Permite que el archivista examine el volumen físico original en la curia o archivo parroquial.']
          }
        ],
        shortcuts: [
          {
            keys: ['Ctrl', 'Enter'],
            description: 'Aprobar y certificar formalmente la partida sacramental (estado verified).',
            context: 'Mesa de Evaluación'
          },
          {
            keys: ['Alt', 'R'],
            description: 'Devolver la partida al digitador con requerimiento de nota prioritaria obligatoria.',
            context: 'Mesa de Evaluación'
          },
          {
            keys: ['Alt', 'E'],
            description: 'Escalar el registro a la Bandeja de Dudosos del Archivista de Curia.',
            context: 'Mesa de Evaluación'
          }
        ],
        callouts: [
          {
            type: 'warning',
            title: 'Cero Tolerancia a Alucinaciones',
            content: 'Bajo ningún concepto se debe aprobar una partida que contenga conjeturas no respaldadas por el trazo visual de la imagen. Ante dudas persistentes, el camino adecuado es siempre Escalar al Archivista (Alt + E).'
          }
        ]
      },
      {
        id: 'active-learning-gold-standard',
        title: 'Active Learning: Bucle de Reentrenamiento y Gold Standard',
        targetRole: 'evaluator',
        summary: 'Cada decisión tomada por el evaluador no solo certifica el acta individual, sino que entrena de forma continua el motor de inteligencia artificial de CodexFlow.',
        keyPoints: [
          'Generación de pares anotados Gold Standard: Cuando un evaluador corrige una alucinación o interpreta un nudo caligráfico complejo, el sistema vincula las coordenadas exactas de la Bounding Box con el texto canónico corregido.',
          'Reentrenamiento supervisado: Las correcciones de los evaluadores alimentan los lotes periódicos de ajuste fino (Fine-Tuning) del modelo paleográfico diocesano.',
          'Métricas de concordancia: El sistema registra el índice de acuerdo entre las predicciones del modelo y las validaciones humanas, elevando progresivamente la tasa de acierto del prellenado automático.'
        ]
      }
    ]
  },

  // --------------------------------------------------------------------------
  // CAPÍTULO 6: EXPLORADOR DE REGISTROS & EXPORTACIÓN FAMILYSEARCH DIP
  // --------------------------------------------------------------------------
  {
    id: 'capitulo-6',
    number: 6,
    title: 'Explorador de Registros y Exportación FamilySearch (DIP)',
    badge: 'Exportación',
    iconName: 'Download',
    targetRole: 'archivist',
    summary: 'Herramientas de búsqueda multicriterio en el fondo documental consolidado, filtros en cascada (Diócesis > Parroquia > Serie Sacramental > Tomo), auditoría previa con semáforo de integridad y generación del paquete de difusión DIP (Dissemination Information Package) con Microsoft Excel, CSV universal (UTF-8 con BOM), árbol de linajes GEDCOM 5.5.1 y manifiesto criptográfico SHA-256.',
    sections: [
      {
        id: 'busqueda-multicriterio-filtros',
        title: 'Explorador de Registros y Filtros en Cascada',
        targetRole: 'all',
        summary: 'Consulta instantánea en miles de partidas indexadas mediante filtros cruzados y búsqueda fonética/ortográfica.',
        keyPoints: [
          'Filtros en cascada: Al seleccionar una Parroquia se actualizan automáticamente las Series disponibles, y al elegir una Serie se filtran exclusivamente los Tomos correspondientes.',
          'Búsqueda por nombres, apellidos, fechas exactas o intervalos cronológicos (ej. 1750 a 1780).',
          'Filtro por estado de certificación: Permite aislar partidas verificadas, borradores en transcripción o registros en corrección.'
        ],
        table: {
          headers: ['Criterio de Filtro', 'Valores Admitidos', 'Comportamiento en Cascada'],
          rows: [
            ['Parroquia', 'Todas o Parroquia específica del tenant', 'Actualiza la lista de series y libros asociados.'],
            ['Serie Sacramental', 'Bautismos, Matrimonios, Defunciones, etc.', 'Restringe los tomos a la serie litúrgica elegida.'],
            ['Tomo / Libro', 'Número de tomo y signatura', 'Carga el rango de folios específicos del libro físico.'],
            ['Rango Temporal', 'Año inicial - Año final', 'Filtra las actas cuya data cronológica encaje en el lapso.'],
            ['Estado de Validación', 'Todos, Verificados, Pendientes, En Corrección', 'Discrimina según el sello de calidad del evaluador.']
          ]
        }
      },
      {
        id: 'auditoria-previa-semaforo',
        title: 'Auditoría Previa a la Exportación con Semáforo de Integridad',
        targetRole: 'archivist',
        summary: 'Módulo de pre-auditoría automática (pre-export-summary) que inspecciona la coherencia y completitud del tomo o serie antes de permitir la generación del paquete final.',
        keyPoints: [
          'Semáforo Verde: El tomo cuenta con el 100% de sus actas certificadas (estado verified), sin folios pendientes ni discrepancias de foliación.',
          'Semáforo Amarillo: Existen partidas transcritas pero aún no certificadas en la Mesa de Evaluación; la exportación solo es posible activando el interruptor only_verified.',
          'Semáforo Rojo: Se detectan folios huérfanos, roturas en la numeración física o partidas marcadas en duda grave sin resolución.'
        ],
        callouts: [
          {
            type: 'note',
            title: 'El Interruptor only_verified',
            content: 'Para garantizar la pulcritud de las remisiones institucionales a FamilySearch o al Archivo Diocesano, el selector "Solo Registros Verificados" viene activado por defecto, impidiendo que borradores incompletos se cuelen en la exportación definitiva.'
          }
        ]
      },
      {
        id: 'paquete-dip-familysearch',
        title: 'Estructura del Paquete DIP (Dissemination Information Package)',
        targetRole: 'archivist',
        summary: 'El comando de exportación genera un archivo comprimido .ZIP autónomo que reúne los cuatro estándares internacionales de entrega y preservación documental.',
        table: {
          headers: ['Archivo en el Paquete ZIP', 'Formato y Codificación', 'Propósito y Compatibilidad'],
          rows: [
            ['matriz_consolidada.xlsx', 'Microsoft Excel estilizado con tipos nativos', 'Auditoría administrativa, filtros por columnas y reportes eclesiásticos.'],
            ['registros_sacramentales.csv', 'Texto plano CSV con UTF-8 BOM', 'Compatibilidad universal sin corrupción de caracteres españoles (ñ, acentos, diéresis).'],
            ['arbol_genealogico.ged', 'Estándar GEDCOM versión 5.5.1', 'Ingesta directa en el motor genealógico de FamilySearch con eventos INDI y FAM.'],
            ['manifest.json', 'JSON estructurado con checksums SHA-256', 'Cadena de custodia técnica y verificación criptográfica de no-alteración.']
          ]
        },
        steps: [
          {
            stepNumber: 1,
            title: 'Seleccionar Tomo o Serie en el Explorador',
            description: 'Localizar el conjunto documental deseado y verificar el estado del semáforo de integridad.',
            tips: ['Asegurarse de que no existan folios pendientes en la Bandeja de Dudosos.']
          },
          {
            stepNumber: 2,
            title: 'Configurar Opciones de Exportación',
            description: 'Verificar que la casilla "Solo registros verificados" esté activa y seleccionar si se incluye el árbol GEDCOM 5.5.1.',
            tips: ['El formato GEDCOM 5.5.1 es el estándar exigido por FamilySearch para linajes bautismales y matrimoniales.']
          },
          {
            stepNumber: 3,
            title: 'Descarga del Paquete ZIP y Validación de Checksums',
            description: 'Hacer clic en "Exportar Paquete DIP". El sistema compila los archivos en memoria y entrega la descarga inmediata.',
            tips: ['Conservar el manifest.json junto con el paquete para futuras auditorías de integridad.']
          }
        ]
      }
    ]
  },

  // --------------------------------------------------------------------------
  // CAPÍTULO 7: RESOLUCIÓN DE PROBLEMAS Y CASOS LÍMITE (TROUBLESHOOTING)
  // --------------------------------------------------------------------------
  {
    id: 'capitulo-7',
    number: 7,
    title: 'Resolución de Problemas y Casos Límite (Troubleshooting)',
    badge: 'Soporte',
    iconName: 'LifeBuoy',
    targetRole: 'all',
    summary: 'Guía práctica para resolver situaciones excepcionales y anomalías en la transcripción y preservación: tratamiento de fechas sacramentales ambiguas o faltantes, actas continuadas entre folios (↪ Continúa de folio anterior), caligrafías severamente desvanecidas, contingencia ante caídas de internet y recuperación de borradores en memoria local.',
    sections: [
      {
        id: 'fechas-aproximadas-faltantes',
        title: 'Fechas Ambiguas, Estimadas o Mutiladas',
        targetRole: 'digitizer',
        summary: 'En libros sacramentales antiguos es frecuente hallar actas donde el sacerdote omitió el día exacto o donde el borde del papel sufrió carcoma o humedad.',
        keyPoints: [
          'Omisión de día o mes: Si solo consta el año (ej. "En el año de 1782..."), ingresar el año en el campo respectivo y pulsar [Ctrl + U] en los campos de día y mes.',
          'Fechas por estimación canónica: Si el acta carece por completo de fecha pero se encuentra flanqueada por una partida del 14 de marzo de 1754 y otra del 22 de marzo de 1754, consignar "hacia 1754" en las notas de la partida.',
          'Nunca inventar fechas: Ante la duda insalvable, marcar como <Ilegible> para no introducir datos apócrifos en los linajes.'
        ],
        callouts: [
          {
            type: 'tip',
            title: 'Regla Canónica de Fechas Flanqueadas',
            content: 'En la tradición archivística eclesiástica, los asientos sacramentales se redactaban en estricto orden cronológico. La posición de un acta entre dos fechas ciertas proporciona una presunción canónica válida del intervalo temporal.'
          }
        ]
      },
      {
        id: 'partidas-continuadas-interfolio',
        title: 'Partidas Continuadas Interfolio (↪ Continúa de folio anterior)',
        targetRole: 'digitizer',
        summary: 'Tratamiento de actas bautismales o matrimoniales extensas que inician al pie del folio Recto y concluyen en la cabecera del folio Vuelto, o que saltan al folio siguiente.',
        steps: [
          {
            stepNumber: 1,
            title: 'Capturar la Primera Fracción en el Folio de Inicio',
            description: 'Transcribir los datos disponibles en el folio donde comienza el acta (ej. Folio 45r).',
            tips: ['No forzar datos del siguiente folio en esta pantalla.']
          },
          {
            stepNumber: 2,
            title: 'Activar la Casilla de Continuidad Interfolio',
            description: 'Al avanzar al siguiente folio (Folio 45v), marcar el indicador "↪ Continúa de folio anterior".',
            tips: ['El sistema unifica automáticamente ambos registros bajo un mismo identificador canónico principal.']
          },
          {
            stepNumber: 3,
            title: 'Completar los Datos Finales y Firmas',
            description: 'Finalizar la transcripción con los padrinos, advertencias canónicas y firmas de los celebrantes.',
            tips: ['En la exportación final, el acta se presentará consolidada haciendo referencia a ambos folios de procedencia (ej. Folios 45r-45v).']
          }
        ]
      },
      {
        id: 'caligrafias-desvanecidas-deterioro',
        title: 'Caligrafías Desvanecidas y Tintas Ferrogálicas',
        targetRole: 'digitizer',
        summary: 'Técnicas paleográficas asistidas por software para descifrar manuscritos afectados por oxidación, desvanecimiento o perforación ácida.',
        keyPoints: [
          'Inversión espectral [Alt + F]: La inversión en negativo elimina el deslumbramiento del papel amarillento y realza el contraste de la tinta ocre o pálida.',
          'Aumento focal con Lupa [L]: Permite seguir la continuidad de los trazos ascendentes y descendentes de pluma para diferenciar entre letras homólogas (ej. c, e, t o u, n, m).',
          'Abreviaturas con tilde o nudo: Cuando una palabra figure abreviada con calderón o enlace (ej. "Dho." por "Dicho" o "P.e" por "Padre"), transcribir la forma expandida normalizada solo si existe certeza indubitada, o registrar la abreviatura literal con nota aclaratoria.'
        ]
      },
      {
        id: 'contingencia-red-recuperacion',
        title: 'Contingencia de Red, Modo Local y Recuperación de Caché',
        targetRole: 'all',
        summary: 'Procedimiento de salvaguarda ante pérdidas de conexión a internet o fallas de energía durante la jornada de indexación.',
        steps: [
          {
            stepNumber: 1,
            title: 'Monitoreo del Indicador de Conexión',
            description: 'Observar la esquina superior del visor: si se muestra el badge ámbar "Modo Local", el sistema está almacenando cada pulsación en IndexedDB.',
            tips: ['No refrescar la página de manera compulsiva; el trabajo sigue activo en memoria.']
          },
          {
            stepNumber: 2,
            title: 'Continuar la Transcripción de Folios Cargados',
            description: 'Los folios previamente cacheados pueden seguir transcribiéndose con normalidad.',
            tips: ['Todos los guardados locales recibirán una marca de tiempo criptográfica.']
          },
          {
            stepNumber: 3,
            title: 'Sincronización Automática al Restaurar Conexión',
            description: 'Tan pronto como el navegador detecte acceso al servidor, la cola de sincronización diferida enviará los registros pendientes.',
            tips: ['El indicador volverá al verde "Sincronizado" confirmando que ninguna partida sufrió pérdida.']
          }
        ],
        callouts: [
          {
            type: 'note',
            title: 'Caché Cifrada y Confidencialidad',
            content: 'La base de datos local del navegador (IndexedDB) mantiene los borradores en un espacio aislado por subdominio y usuario, garantizando que el material sacramental no quede expuesto a accesos no autorizados en terminales parroquiales comunitarias.'
          }
        ]
      }
    ]
  }
];
