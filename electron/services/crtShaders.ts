/**
 * Shader "CRT Royale" para Analog Replay TV.
 * ---------------------------------------------------------------------------
 * CRÉDITOS Y LICENCIA
 *
 * Este filtro es una implementación PROPIA escrita para Analog Replay TV, en el
 * espíritu del shader "crt-royale" y de su puerto a ReShade:
 *
 *   - CRT-Royale, shader original de TroggleMonkey (RetroArch / libretro)
 *     https://github.com/libretro/glsl-shaders
 *   - Puerto a ReShade de akgunter
 *     https://github.com/akgunter/crt-royale-reshade
 *
 * IMPORTANTE: el código fuente de crt-royale está bajo licencia GPL-2.0. Por ese
 * motivo aquí NO se ha copiado ni portado su código: este fragment shader es una
 * reimplementación original que reproduce las *características* del efecto
 * (geometría curva, overscan, máscara de fósforo, líneas de escaneo, error de
 * convergencia, viñeta y bloom) usando GLSL propio.
 *
 * Si en el futuro se desea incluir el shader original tal cual, hay que tener en
 * cuenta que la GPL-2.0 es copyleft y obligaría a licenciar el proyecto entero
 * bajo GPL-2.0.
 *
 * Se agradecen los trabajos de referencia:
 *   - TroggleMonkey (crt-royale original)
 *   - akgunter (puerto a ReShade)
 *   - libretro/glsl-shaders y libretro/slang-shaders
 *   - Matsilagi, Lord of Lunacy y Marty McFly (optimizaciones y pruebas)
 */

/** Estilos de filtro CRT disponibles en la TV. */
export type CRTFilterStyle = 'analog-replay' | 'royale';

export const CRT_FILTER_STYLES: CRTFilterStyle[] = ['analog-replay', 'royale'];

/** Etiquetas mostradas en el panel de ajustes del control remoto. */
export const CRT_FILTER_STYLE_LABELS: Record<CRTFilterStyle, string> = {
  'analog-replay': 'CRT Analog Replay TV',
  royale: 'CRT Royale'
};

export const DEFAULT_CRT_FILTER_STYLE: CRTFilterStyle = 'analog-replay';

export const isCRTFilterStyle = (value: unknown): value is CRTFilterStyle =>
  typeof value === 'string' && (CRT_FILTER_STYLES as string[]).includes(value);

/**
 * Parámetros ajustables del shader CRT Royale.
 * Todos los valores están pensados para el "stage" de resolución fija (540 líneas
 * de alto) que ya usa el reproductor, así que son independientes de la
 * resolución real de la pantalla.
 */
export interface CRTRoyaleOptions {
  /** Intensidad de la curvatura del tubo (0 = plano, 1 = muy curvo). */
  curvature: number;
  /** Zoom/"overscan" aplicado antes de curvar: simula el borde físico del tubo. */
  overscan: number;
  /** 0 = sin máscara, 1 = rejilla de apertura (vertical), 2 = máscara de ranuras. */
  maskMode: number;
  /** Cuánto se mezcla la máscara de fósforo con la imagen (0..1). */
  maskStrength: number;
  /** Tríadas de fósforo por ancho de pantalla. 0 = automático según resolución. */
  maskScale: number;
  /** 0 = sin líneas de escaneo, 1 = fijas, 2 = entrelazadas y animadas. */
  scanlineMode: number;
  /** Profundidad de las líneas de escaneo (0..1). */
  scanlineIntensity: number;
  /** Número de líneas de escaneo. 0 = automático (cada 3 píxeles del stage). */
  scanlineCount: number;
  /** Nitidez de las líneas de escaneo (1 = suave, >1 = más marcadas). */
  scanlineSharpness: number;
  /** Error de convergencia de los guns de color: separación RGB en los bordes. */
  convergence: number;
  /** Oscurecimiento hacia las esquinas. */
  vignette: number;
  /** Redondeo de las esquinas del área visible del tubo. */
  cornerRound: number;
  /** Multiplicador de brillo. */
  brightness: number;
  /** Contraste alrededor de gris medio. */
  contrast: number;
  /** Saturación del fósforo. */
  saturation: number;
  /** Tinte de fósforo (rojo, verde, azul) que refleja el fósforo real del tubo. */
  phosphorTint: [number, number, number];
  /** Resplandor (bloom) de las zonas brillantes. */
  bloom: number;
  /** Ruido de señal / grano. */
  noise: number;
}

/** Valores por defecto: calibrated para verse creíble pero no extremo. */
export const CRT_ROYALE_DEFAULTS: CRTRoyaleOptions = {
  curvature: 0.32,
  overscan: 0.045,
  maskMode: 1,
  maskStrength: 0.42,
  maskScale: 0,
  scanlineMode: 1,
  scanlineIntensity: 0.28,
  scanlineCount: 0,
  scanlineSharpness: 1.6,
  convergence: 0.35,
  vignette: 0.32,
  cornerRound: 0.35,
  brightness: 1.02,
  contrast: 1.06,
  saturation: 1.18,
  phosphorTint: [1.0, 1.0, 1.0],
  bloom: 0.18,
  noise: 0.03
};

/**
 * Catálogo de opciones del shader, con su rango y descripción.
 * Se usa para documentar el filtro y para centralizar los valores por defecto.
 */
export const CRT_ROYALE_OPTION_CATALOG: ReadonlyArray<{
  key: keyof CRTRoyaleOptions;
  label: string;
  min: number;
  max: number;
  default: number;
  description: string;
}> = [
  { key: 'curvature', label: 'Curvatura del tubo', min: 0, max: 1, default: CRT_ROYALE_DEFAULTS.curvature, description: 'Cuánto se curva la imagen hacia los bordes.' },
  { key: 'overscan', label: 'Overscan', min: 0, max: 0.2, default: CRT_ROYALE_DEFAULTS.overscan, description: 'Recorte del borde físico del tubo; la imagen no llega hasta el marco.' },
  { key: 'maskMode', label: 'Tipo de máscara', min: 0, max: 2, default: CRT_ROYALE_DEFAULTS.maskMode, description: '0 ninguna, 1 rejilla de apertura (Trinitron), 2 máscara de ranuras.' },
  { key: 'maskStrength', label: 'Intensidad de la máscara', min: 0, max: 1, default: CRT_ROYALE_DEFAULTS.maskStrength, description: 'Cuánto se nota la tríada de fósforo.' },
  { key: 'maskScale', label: 'Escala de la máscara', min: 0, max: 8, default: CRT_ROYALE_DEFAULTS.maskScale, description: 'Tríadas por ancho de pantalla. 0 = automático.' },
  { key: 'scanlineMode', label: 'Modo de escaneo', min: 0, max: 2, default: CRT_ROYALE_DEFAULTS.scanlineMode, description: '0 desactivadas, 1 fijas, 2 entrelazadas animadas.' },
  { key: 'scanlineIntensity', label: 'Intensidad de escaneo', min: 0, max: 1, default: CRT_ROYALE_DEFAULTS.scanlineIntensity, description: 'Profundidad de las líneas de escaneo.' },
  { key: 'scanlineCount', label: 'Número de líneas', min: 0, max: 1200, default: CRT_ROYALE_DEFAULTS.scanlineCount, description: 'Líneas de escaneo del fosforo. 0 = automático.' },
  { key: 'scanlineSharpness', label: 'Nitidez de escaneo', min: 0.5, max: 8, default: CRT_ROYALE_DEFAULTS.scanlineSharpness, description: 'Mayor valor = líneas más finas y definidas.' },
  { key: 'convergence', label: 'Error de convergencia', min: 0, max: 2, default: CRT_ROYALE_DEFAULTS.convergence, description: 'Desalineación de los guns rojo, verde y azul, visible en los bordes.' },
  { key: 'vignette', label: 'Viñeta', min: 0, max: 1, default: CRT_ROYALE_DEFAULTS.vignette, description: 'Oscurecimiento progresivo hacia las esquinas.' },
  { key: 'cornerRound', label: 'Redondeo de esquinas', min: 0, max: 1, default: CRT_ROYALE_DEFAULTS.cornerRound, description: 'Cuánto se redondean las esquinas del área de imagen.' },
  { key: 'brightness', label: 'Brillo', min: 0.5, max: 1.6, default: CRT_ROYALE_DEFAULTS.brightness, description: 'Ganancia de luminancia del tubo.' },
  { key: 'contrast', label: 'Contraste', min: 0.5, max: 2, default: CRT_ROYALE_DEFAULTS.contrast, description: 'Contraste alrededor del gris medio.' },
  { key: 'saturation', label: 'Saturación', min: 0, max: 2.5, default: CRT_ROYALE_DEFAULTS.saturation, description: 'Intensidad del fósforo; los CRT saturaban los colores de forma exagerada.' },
  { key: 'bloom', label: 'Resplandor (bloom)', min: 0, max: 1, default: CRT_ROYALE_DEFAULTS.bloom, description: 'Halo de luz de las zonas brillantes.' },
  { key: 'noise', label: 'Ruido de señal', min: 0, max: 0.3, default: CRT_ROYALE_DEFAULTS.noise, description: 'Grano y ruido de la señal analógica.' }
];

/** Vertex shader mínimo: un quad que cubre todo el canvas. */
export const CRT_ROYALE_VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

/**
 * Fragment shader CRT Royale (implementación original, GLSL ES 1.00 / WebGL 1).
 *
 * Pipeline por fragmento:
 *   1. Deformación del tubo (curvatura + overscan) y descarte fuera del área visible
 *   2. Error de convergencia (muestreo distinto por canal según el radio)
 *   3. Luminancia/saturación/contraste/brillo y tinte de fósforo
 *   4. Máscara de fósforo (rejilla de apertura o ranuras)
 *   5. Líneas de escaneo (fijas o entrelazadas animadas)
 *   6. Bloom barato por muestreo de vecinos brillantes
 *   7. Viñeta, redondeo de esquinas y ruido de señal
 */
export const CRT_ROYALE_FRAGMENT_SHADER = `
precision highp float;

varying vec2 v_uv;

uniform sampler2D u_source;
uniform vec2  u_resolution;
uniform float u_time;

uniform float u_curvature;
uniform float u_overscan;
uniform float u_maskMode;
uniform float u_maskStrength;
uniform float u_maskScale;
uniform float u_scanlineMode;
uniform float u_scanlineIntensity;
uniform float u_scanlineCount;
uniform float u_scanlineSharpness;
uniform float u_convergence;
uniform float u_vignette;
uniform float u_cornerRound;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;
uniform vec3  u_phosphorTint;
uniform float u_bloom;
uniform float u_noise;

const float PI = 3.141592653589793;

// ---------------------------------------------------------------- curvatura
// Mapea coordenadas de pantalla a coordenadas "en el tubo" (deformación de barril).
vec2 tube_uv(vec2 uv) {
  vec2 c = uv * 2.0 - 1.0;
  // El offset crece con la distancia al centro: el tubo se hincha en los bordes.
  float r2 = dot(c, c);
  c *= 1.0 + u_curvature * 0.22 * r2;
  return c * 0.5 + 0.5;
}

// Comprueba si el punto cae dentro del área visible del tubo (esquina redondeada).
bool inside_screen(vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return false;
  if (u_cornerRound <= 0.001) return true;
  vec2 d = abs(uv - 0.5) - (0.5 - u_cornerRound * 0.12);
  float radius = u_cornerRound * 0.12;
  float dist = length(max(d, 0.0)) - radius;
  return dist <= 0.0;
}

// ------------------------------------------------------- máscara de fósforo
// Devuelve los pesos RGB de una tríada. "t" avanza a lo largo del triángulo.
vec3 phosphor_triad(float t) {
  float i = mod(t, 3.0);
  vec3 w;
  w.r = clamp(1.0 - abs(i - 0.0), 0.0, 1.0);
  w.g = clamp(1.0 - abs(i - 1.0), 0.0, 1.0);
  w.b = clamp(1.0 - abs(i - 2.0), 0.0, 1.0);
  return w;
}

vec3 phosphor_mask(vec2 uv) {
  if (u_maskMode < 0.5) return vec3(1.0);

  float triads = u_maskScale > 0.5 ? u_maskScale : max(3.0, floor(u_resolution.x / 3.0));
  float t = uv.x * triads;

  if (u_maskMode < 1.5) {
    // Rejilla de apertura (Trinitron): columnas verticales fijas.
    return phosphor_triad(t);
  }

  // Máscara de ranuras: dos tríadas alternadas, desplazadas media tríada por fila.
  float rows = max(2.0, floor(triads * 0.5));
  float row = mod(floor(uv.y * rows), 2.0);
  return phosphor_triad(t + row * 0.5);
}

// ------------------------------------------------------------- luminance
float luminance(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 screen_uv = v_uv;

  // 1. Geometría del tubo.
  vec2 uv = tube_uv(screen_uv);
  uv = (uv - 0.5) / max(0.0001, 1.0 - u_overscan * 2.0) + 0.5;

  if (!inside_screen(uv)) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // 2. Error de convergencia: cada gun se desplaza un poco más lejos del centro.
  vec2 d = uv - 0.5;
  float r2 = dot(d, d);
  vec2 shift = d * r2 * u_convergence * 0.06;
  vec3 color;
  color.r = texture2D(u_source, clamp(uv + shift, 0.0, 1.0)).r;
  color.g = texture2D(u_source, uv).g;
  color.b = texture2D(u_source, clamp(uv - shift, 0.0, 1.0)).b;

  // 3. Ganancia, contraste, saturación y tinte de fósforo.
  color = (color - 0.5) * u_contrast + 0.5;
  float luma = luminance(color);
  color = mix(vec3(luma), color, u_saturation);
  color *= u_phosphorTint;
  color *= u_brightness;

  // 4. Máscara de fósforo, promediada para no perder brillo medio.
  if (u_maskMode > 0.5 && u_maskStrength > 0.001) {
    vec3 mask = phosphor_mask(uv);
    // Normalizar para que la suma de la tríada se mantenga en ~1.0.
    color *= mix(vec3(1.0), mask * 1.5, u_maskStrength);
  }

  // 5. Líneas de escaneo.
  if (u_scanlineMode > 0.5 && u_scanlineIntensity > 0.001) {
    float lines = u_scanlineCount > 0.5 ? u_scanlineCount : max(1.0, floor(u_resolution.y / 3.0));
    float phase = fract(uv.y * lines);
    // Perfil simétrico: 0 en el centro de la línea, 1 entre líneas.
    float beam = pow(1.0 - abs(phase * 2.0 - 1.0), max(0.25, u_scanlineSharpness));

    if (u_scanlineMode > 1.5) {
      // Entrelazado: alterna el campo entre líneas pares e impares.
      float field = mod(floor(uv.y * lines), 2.0);
      float t = mod(floor(u_time * 50.0), 2.0);
      beam *= (field == t) ? 1.0 : 0.45;
    }

    color *= 1.0 - u_scanlineIntensity * beam;
  }

  // 6. Bloom: halo de las zonas brillantes, muestreando una cruz de vecinos.
  if (u_bloom > 0.001) {
    vec2 px = 2.0 / u_resolution;
    vec3 glow = vec3(0.0);
    glow += max(texture2D(u_source, clamp(uv + vec2(px.x, 0.0), 0.0, 1.0)).rgb - 0.65, 0.0);
    glow += max(texture2D(u_source, clamp(uv - vec2(px.x, 0.0), 0.0, 1.0)).rgb - 0.65, 0.0);
    glow += max(texture2D(u_source, clamp(uv + vec2(0.0, px.y), 0.0, 1.0)).rgb - 0.65, 0.0);
    glow += max(texture2D(u_source, clamp(uv - vec2(0.0, px.y), 0.0, 1.0)).rgb - 0.65, 0.0);
    color += glow * u_bloom * 0.35;
  }

  // 7. Viñeta y borde del tubo.
  float vig = 1.0 - u_vignette * clamp(r2 * 1.6, 0.0, 1.0);
  color *= clamp(vig, 0.0, 1.0);

  // 8. Ruido de señal.
  if (u_noise > 0.001) {
    float grain = hash(floor(uv * u_resolution) + fract(u_time) * 91.7) - 0.5;
    color += grain * u_noise;
  }

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;
