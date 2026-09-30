# Filtros CRT de Analog Replay TV

El estilo **90s** ofrece un filtro CRT con dos shaders intercambiables desde el
control remoto (`SETTINGS` → `Filtro CRT` → `Shader CRT`).

> El filtro solo existe en el estilo 90s. En el estilo 00s las filas de CRT no
> aparecen en el panel y el filtro no se aplica.

## Los dos shaders

### CRT Analog Replay TV (`analog-replay`)

Es el filtro original del proyecto, sin cambios. Se aplica con `ctx.filter` de
**Canvas 2D** (que acepta la misma sintaxis que CSS `filter`) sobre un canvas de
resolución fija, y luego ese canvas se escala con `transform: scale()`.

```text
contrast(1.2) brightness(0.95) saturate(1.3) sepia(0.05) hue-rotate(5deg)
```

Es ligero y no necesita WebGL. Se mantiene como opción por compatibilidad y
porque es el aspecto con el que se diseñó la app.

- Backend: Canvas 2D
- Sin opciones ajustables
- Es el valor por defecto

### CRT Royale (`royale`)

Shader **WebGL** (GLSL ES 1.00 / WebGL 1) con un fragment shader propio, que
reproduce las características clásicas de un tubo de rayos catódicos: curvatura
de cristal, overscan, máscara de fósforo, líneas de escaneo, error de
convergencia, viñeta, resplandor y ruido de señal.

- Backend: WebGL 1
- 21 parámetros ajustables
- Si WebGL no está disponible, cae automáticamente al filtro CSS

## Pipeline del shader

El fragment shader (`electron/services/crtShaders.ts`) procesa cada fragmento
en este orden:

1. **Geometría del tubo** — deformación de barril + overscan; fuera del área
   visible se dibuja negro.
2. **Error de convergencia** — el gun rojo y el azul se muestrean con un
   desplazamiento proporcional al radio, así la desalineación solo se nota en
   los bordes.
3. **Imagen** — contraste, saturación, tinte de fósforo y brillo.
4. **Máscara de fósforo** — rejilla de apertura o máscara de ranuras.
5. **Líneas de escaneo** — fijas o entrelazadas y animadas.
6. **Bloom** — halo de las zonas brillantes por muestreo de vecinos.
7. **Viñeta, redondeo de esquinas y ruido de señal.**

## Opciones del shader

Los valores por defecto viven en `CRT_ROYALE_DEFAULTS` y el catálogo completo
(etiqueta, rango y descripción) en `CRT_ROYALE_OPTION_CATALOG`, ambos en
`electron/services/crtShaders.ts`.

| Opción | Rango | Por defecto | Qué hace |
| --- | --- | --- | --- |
| Curvatura del tubo | 0 – 1 | 0.32 | Cuánto se curva la imagen hacia los bordes. |
| Overscan | 0 – 0.2 | 0.045 | Recorte del borde físico; la imagen no llega al marco. |
| Tipo de máscara | 0 – 2 | 1 (rejilla) | `0` ninguna, `1` rejilla de apertura (Trinitron), `2` máscara de ranuras. |
| Intensidad de la máscara | 0 – 1 | 0.42 | Cuánto se nota la tríada de fósforo. |
| Escala de la máscara | 0 – 8 | 0 (auto) | Tríadas por ancho de pantalla. `0` = automático según resolución. |
| Modo de escaneo | 0 – 2 | 1 (fijas) | `0` desactivadas, `1` fijas, `2` entrelazadas animadas. |
| Intensidad de escaneo | 0 – 1 | 0.28 | Profundidad de las líneas de escaneo. |
| Número de líneas | 0 – 1200 | 0 (auto) | Líneas de escaneo del fósforo. `0` = una cada 3 píxeles del stage. |
| Nitidez de escaneo | 0.5 – 8 | 1.6 | Mayor valor = líneas más finas y definidas. |
| Error de convergencia | 0 – 2 | 0.35 | Desalineación de los guns RGB, visible en los bordes. |
| Viñeta | 0 – 1 | 0.32 | Oscurecimiento progresivo hacia las esquinas. |
| Redondeo de esquinas | 0 – 1 | 0.35 | Cuánto se redondean las esquinas del área de imagen. |
| Brillo | 0.5 – 1.6 | 1.02 | Ganancia de luminancia del tubo. |
| Contraste | 0.5 – 2 | 1.06 | Contraste alrededor del gris medio. |
| Saturación | 0 – 2.5 | 1.18 | Intensidad del fósforo. |
| Resplandor (bloom) | 0 – 1 | 0.18 | Halo de luz de las zonas brillantes. |
| Ruido de señal | 0 – 0.3 | 0.03 | Grano y ruido de la señal analógica. |

Los valores por defecto están calibrados para verse creíbles sin exagerar: si se
cambia alguno, conviene subir `curvature` y `maskStrength` **juntos** desde
valores bajos, porque es la combinación que más delata un filtro CRT falso.

## Rendimiento

El shader corre sobre un canvas de **resolución fija** (540 líneas de alto) que
luego se escala con `transform: scale()`, exactamente igual que el filtro
original. Esto es deliberado: si el filtro se calculara a la resolución de la
pantalla, Chromium lo re-rasterizaría en cada redimensionado y volvería el lag
que el filtro original resolvió. Por eso los uniforms `u_maskScale` y
`u_scanlineCount` trabajan en `0` = automático: el shader se adapta al tamaño del
stage, no al de la pantalla.

## Créditos y licencias

El filtro **CRT Royale** de este repositorio es una **implementación original**,
escrita para Analog Replay TV, que reproduce las *características* del shader
`crt-royale`. Se reconoce el trabajo de:

- **TroggleMonkey** — autor del shader original
  [crt-royale](https://github.com/libretro/glsl-shaders) (RetroArch / libretro)
- **akgunter** — [puerto a ReShade](https://github.com/akgunter/crt-royale-reshade)
- **libretro** — [glsl-shaders](https://github.com/libretro/glsl-shaders) y
  [slang-shaders](https://github.com/libretro/slang-shaders)
- **Matsilagi**, **Lord of Lunacy** y **Marty McFly** — optimizaciones y pruebas
  del puerto a ReShade

### Por qué no se incluye el código original

`crt-royale` y su puerto a ReShade están bajo **GPL-2.0**, una licencia copyleft.
Analog Replay TV no declara licencia (package.json `"private": true`, sin
archivo `LICENSE`), por lo que **no se ha copiado ni portado su código fuente**.

Si alguna vez se decide incluir el shader tal cual, hay dos salidas y ambas tienen
consecuencias:

1. **Relicenciar el proyecto entero bajo GPL-2.0**, o
2. **mantener el shader en un proceso aparte** con su propia licencia, aceptando
   la complejidad operativa.

La implementación actual evita ambas: es GLSL propio, sin obligaciones de
copyleft.

## Verificación

El shader se validó compilándolo y enlazándolo en el WebGL real de Chromium
(Electron), comprobando que los 21 uniforms se resuelven y que el resultado
tiene imagen real y no un rectángulo negro.
