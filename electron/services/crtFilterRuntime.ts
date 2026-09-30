import {
  CRT_ROYALE_DEFAULTS,
  CRT_ROYALE_FRAGMENT_SHADER,
  CRT_ROYALE_VERTEX_SHADER,
  type CRTFilterStyle
} from './crtShaders.js';

/**
 * Filtro del CRT original de Analog Replay TV ("CRT Analog Replay TV").
 *
 * Se mantiene exactamente la misma cadena que ya usaba la implementación
 * previa, para no cambiar el aspecto que el usuario ya conoce. Se aplica con
 * `ctx.filter` de Canvas 2D, que soporta la misma sintaxis que CSS filter.
 */
export const ANALOG_REPLAY_CANVAS_FILTER =
  'contrast(1.2) brightness(0.95) saturate(1.3) sepia(0.05) hue-rotate(5deg)';

/**
 * Genera el script que instala `window.VSMCrt` en el contexto de la página.
 *
 * Este runtime es el que permite cambiar de shader (o apagar el filtro) sin
 * reiniciar la reproducción: el reproductor lo invoca cada vez que cambia el
 * ajuste desde el control remoto.
 *
 * Notas de diseño:
 *  - Se reutiliza el `<video>` ya existente (`#vsm-main-video`) como fuente, de
 *    modo que el decodificador de hardware sigue igual de activo.
 *  - El canvas se dibuja al tamaño del "stage" de resolución fija (540 líneas),
 *    y luego el stage se escala con `transform: scale()`. Así el shader corre
 *    siempre a la misma resolución, sin importar si la ventana está en pantalla
 *    completa, que es lo que causaba el lag que reporta el usuario.
 *  - Si WebGL no está disponible, `apply()` devuelve `false` y quien llama puede
 *    caer al respaldo de filtro CSS.
 */
export const buildCrtRuntimeScript = (): string => `(() => {
  if (window.VSMCrt && window.VSMCrt.version === 2) return;

  var VERTEX_SRC = ${JSON.stringify(CRT_ROYALE_VERTEX_SHADER)};
  var FRAGMENT_SRC = ${JSON.stringify(CRT_ROYALE_FRAGMENT_SHADER)};
  var ANALOG_FILTER = ${JSON.stringify(ANALOG_REPLAY_CANVAS_FILTER)};
  var DEFAULTS = ${JSON.stringify(CRT_ROYALE_DEFAULTS)};

  var active = null; // funcion de limpieza del filtro activo

  function stopActive() {
    if (!active) return;
    try { active(); } catch (e) { /* limpiar siempre, sin romper */ }
    active = null;
  }

  function getParts() {
    var video = document.getElementById('vsm-main-video');
    var stage = document.getElementById('vsm-crt-stage');
    if (!video || !stage) return null;
    return { video: video, stage: stage };
  }

  function removeOldCanvas() {
    var old = document.getElementById('vsm-crt-canvas');
    if (old && old.parentNode) old.parentNode.removeChild(old);
  }

  function setVideoVisible(visible) {
    var video = document.getElementById('vsm-main-video');
    if (!video) return;
    video.style.opacity = visible ? '1' : '0';
    video.style.pointerEvents = visible ? '' : 'none';
  }

  function createCanvas(stage) {
    var canvas = document.createElement('canvas');
    canvas.id = 'vsm-crt-canvas';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.backgroundColor = '#000';
    canvas.classList.add('crt-filter-canvas');
    stage.appendChild(canvas);
    return canvas;
  }

  // ------------------------------------------------- CRT Analog Replay TV
  // Canvas 2D + ctx.filter: el mismo tratamiento que la implementación previa.
  function buildAnalogReplay(parts) {
    var canvas = createCanvas(parts.stage);
    canvas.width = parts.stage.clientWidth || 960;
    canvas.height = parts.stage.clientHeight || 540;

    var ctx = canvas.getContext('2d');
    if (!ctx) { removeOldCanvas(); setVideoVisible(true); return false; }

    var video = parts.video;
    var usesVFC = typeof video.requestVideoFrameCallback === 'function';
    var handle = null;

    function draw() {
      if (ctx && video.readyState >= 2 && video.videoWidth > 0) {
        ctx.filter = ANALOG_FILTER;
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        } catch (drawError) {
          // Ignorar frames fallidos puntuales (ej. durante un seek)
        }
      }
      schedule();
    }

    function schedule() {
      if (usesVFC) {
        handle = video.requestVideoFrameCallback(draw);
      } else {
        handle = requestAnimationFrame(draw);
      }
    }

    schedule();
    return true;
  }

  // --------------------------------------------------------- CRT Royale
  // WebGL 1 con un fragment shader propio (ver crtShaders.ts para los créditos).
  function buildRoyale(parts) {
    var canvas = createCanvas(parts.stage);
    canvas.width = parts.stage.clientWidth || 960;
    canvas.height = parts.stage.clientHeight || 540;

    var gl = null;
    try {
      gl = canvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: 'low-power'
      }) || canvas.getContext('experimental-webgl');
    } catch (glError) {
      gl = null;
    }
    if (!gl) { removeOldCanvas(); setVideoVisible(true); return false; }

    function compile(type, src) {
      var shader = gl.createShader(type);
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn('⚠️ [CRT Royale] Error de compilación:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    var vs = compile(gl.VERTEX_SHADER, VERTEX_SRC);
    var fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SRC);
    if (!vs || !fs) { removeOldCanvas(); setVideoVisible(true); return false; }

    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.bindAttribLocation(program, 0, 'a_position');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('⚠️ [CRT Royale] Error de enlazado:', gl.getProgramInfoLog(program));
      removeOldCanvas();
      setVideoVisible(true);
      return false;
    }
    gl.useProgram(program);

    // Quad de dos triángulos en strip.
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    var positionLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Textura fuente a partir del <video>.
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // El video llega boca abajo respecto a las coordenadas de textura.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

    var u = {};
    [
      'u_source', 'u_resolution', 'u_time', 'u_curvature', 'u_overscan',
      'u_maskMode', 'u_maskStrength', 'u_maskScale', 'u_scanlineMode',
      'u_scanlineIntensity', 'u_scanlineCount', 'u_scanlineSharpness',
      'u_convergence', 'u_vignette', 'u_cornerRound', 'u_brightness',
      'u_contrast', 'u_saturation', 'u_phosphorTint', 'u_bloom', 'u_noise'
    ].forEach(function (name) {
      u[name] = gl.getUniformLocation(program, name);
    });

    // Uniforms que no dependen del frame.
    gl.uniform1i(u.u_source, 0);
    gl.uniform1f(u.u_curvature, DEFAULTS.curvature);
    gl.uniform1f(u.u_overscan, DEFAULTS.overscan);
    gl.uniform1f(u.u_maskMode, DEFAULTS.maskMode);
    gl.uniform1f(u.u_maskStrength, DEFAULTS.maskStrength);
    gl.uniform1f(u.u_maskScale, DEFAULTS.maskScale);
    gl.uniform1f(u.u_scanlineMode, DEFAULTS.scanlineMode);
    gl.uniform1f(u.u_scanlineIntensity, DEFAULTS.scanlineIntensity);
    gl.uniform1f(u.u_scanlineCount, DEFAULTS.scanlineCount);
    gl.uniform1f(u.u_scanlineSharpness, DEFAULTS.scanlineSharpness);
    gl.uniform1f(u.u_convergence, DEFAULTS.convergence);
    gl.uniform1f(u.u_vignette, DEFAULTS.vignette);
    gl.uniform1f(u.u_cornerRound, DEFAULTS.cornerRound);
    gl.uniform1f(u.u_brightness, DEFAULTS.brightness);
    gl.uniform1f(u.u_contrast, DEFAULTS.contrast);
    gl.uniform1f(u.u_saturation, DEFAULTS.saturation);
    gl.uniform3f(
      u.u_phosphorTint,
      DEFAULTS.phosphorTint[0], DEFAULTS.phosphorTint[1], DEFAULTS.phosphorTint[2]
    );
    gl.uniform1f(u.u_bloom, DEFAULTS.bloom);
    gl.uniform1f(u.u_noise, DEFAULTS.noise);

    var video = parts.video;
    var usesVFC = typeof video.requestVideoFrameCallback === 'function';
    var handle = null;
    var uploadedWidth = 0;
    var uploadedHeight = 0;

    function syncResolution() {
      var width = parts.stage.clientWidth || canvas.width;
      var height = parts.stage.clientHeight || canvas.height;
      if (width > 0 && height > 0 && (width !== canvas.width || height !== canvas.height)) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(u.u_resolution, canvas.width, canvas.height);
    }

    function draw() {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        syncResolution();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        try {
          if (video.videoWidth !== uploadedWidth || video.videoHeight !== uploadedHeight) {
            // RGB es la combinación más compatible con fuentes de video.
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
            uploadedWidth = video.videoWidth;
            uploadedHeight = video.videoHeight;
          } else {
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGB, gl.UNSIGNED_BYTE, video);
          }
        } catch (uploadError) {
          // Frame no listo (p. ej. durante un seek): se dibuja el anterior.
        }
        gl.uniform1f(u.u_time, (window.performance ? performance.now() : Date.now()) / 1000);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      schedule();
    }

    function schedule() {
      if (usesVFC) {
        handle = video.requestVideoFrameCallback(draw);
      } else {
        handle = requestAnimationFrame(draw);
      }
    }

    // El stage cambia de tamaño al redimensionar la ventana (o al cambiar el
    // aspect ratio). Hay que reajustar el backing store del canvas.
    var resizeObserver = null;
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(function () {
        syncResolution();
        if (video.readyState >= 2) draw();
      });
      resizeObserver.observe(parts.stage);
    }

    schedule();

    active = function () {
      if (handle != null) {
        try {
          if (usesVFC && typeof video.cancelVideoFrameCallback === 'function') {
            video.cancelVideoFrameCallback(handle);
          } else {
            cancelAnimationFrame(handle);
          }
        } catch (cancelError) { /* ignorar */ }
        handle = null;
      }
      if (resizeObserver) {
        try { resizeObserver.disconnect(); } catch (obsError) { /* ignorar */ }
        resizeObserver = null;
      }
      try { gl.deleteTexture(texture); } catch (texError) { /* ignorar */ }
      try { gl.deleteBuffer(buffer); } catch (bufError) { /* ignorar */ }
      try { gl.deleteProgram(program); } catch (progError) { /* ignorar */ }
      try { gl.deleteShader(vs); gl.deleteShader(fs); } catch (shError) { /* ignorar */ }
      // Liberar el contexto para no agotar los contextos WebGL del navegador.
      try {
        var loseContext = gl.getExtension('WEBGL_lose_context');
        if (loseContext) loseContext.loseContext();
      } catch (ctxError) { /* ignorar */ }
    };

    return true;
  }

  window.VSMCrt = {
    version: 2,
    currentStyle: null,

    /**
     * Aplica (o cambia) el filtro CRT sobre el video en reproducción.
     * @param {string} style 'analog-replay' | 'royale'
     * @returns {boolean} true si el filtro quedó aplicado
     */
    apply: function (style) {
      var parts = getParts();
      if (!parts) return false;

      // Siempre se reconstruye: el stage pudo cambiar de tamaño (aspect ratio)
      // o el usuario pudo haber pedido un cambio de shader.
      stopActive();
      removeOldCanvas();

      var ok = false;
      try {
        if (style === 'royale') {
          ok = buildRoyale(parts);
        } else {
          ok = buildAnalogReplay(parts);
        }
      } catch (error) {
        console.warn('⚠️ [CRT] No se pudo aplicar el filtro', style, error);
        ok = false;
      }

      if (ok) {
        window.VSMCrt.currentStyle = style;
        setVideoVisible(false);
      } else {
        // Respaldo: sin canvas, se ve el video con el filtro CSS de siempre.
        window.VSMCrt.currentStyle = null;
        setVideoVisible(true);
        var video = document.getElementById('vsm-main-video');
        if (video) video.classList.add('crt-filter');
      }
      return ok;
    },

    /** Quita el filtro CRT y vuelve a mostrar el video sin tratar. */
    dispose: function () {
      stopActive();
      removeOldCanvas();
      window.VSMCrt.currentStyle = null;
      setVideoVisible(true);
      var video = document.getElementById('vsm-main-video');
      if (video) video.classList.remove('crt-filter');
    }
  };
})();`;

/**
 * Script que instala el runtime y aplica un filtro de entrada.
 * Se usa al empezar la reproducción, junto con el resto del script del player.
 */
export const buildCrtApplyScript = (style: CRTFilterStyle): string =>
  `(() => {
    ${buildCrtRuntimeScript()}
    var ok = window.VSMCrt.apply(${JSON.stringify(style)});
    console.log('🎨 [VideoStreamManager] Filtro CRT aplicado:', ${JSON.stringify(style)}, ok ? 'canvas' : 'css-fallback');
    return { applied: ok, style: window.VSMCrt.currentStyle };
  })()`;

/**
 * Script para cambiar el filtro en caliente, sin reiniciar la reproducción.
 */
export const buildCrtReconfigureScript = (enabled: boolean, style: CRTFilterStyle): string =>
  `(() => {
    if (!window.VSMCrt || window.VSMCrt.version !== 2) {
      ${buildCrtRuntimeScript()}
    }
    if (${enabled ? 'true' : 'false'}) {
      return { applied: window.VSMCrt.apply(${JSON.stringify(style)}), style: window.VSMCrt.currentStyle };
    }
    window.VSMCrt.dispose();
    return { applied: false, style: null };
  })()`;
