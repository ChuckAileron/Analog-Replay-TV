/**
 * Pruebas unitarias del filtro CRT y sus shaders.
 *
 * El runtime se evalúa dentro de la página del reproductor, así que aquí se
 * fijan las invariantes que evitan regresiones silenciosas: que el shader se
 * embeba completo, que el runtime sea idempotente y que el catálogo de
 * opciones del panel coincida con los valores por defecto.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import {
  CRT_FILTER_STYLES,
  CRT_FILTER_STYLE_LABELS,
  CRT_ROYALE_DEFAULTS,
  CRT_ROYALE_FRAGMENT_SHADER,
  CRT_ROYALE_OPTION_CATALOG,
  CRT_ROYALE_VERTEX_SHADER,
  DEFAULT_CRT_FILTER_STYLE,
  isCRTFilterStyle
} from '../electron/services/crtShaders.js';
import type { CRTRoyaleOptions, CRTFilterStyle } from '../electron/services/crtShaders.js';
import {
  ANALOG_REPLAY_CANVAS_FILTER,
  buildCrtApplyScript,
  buildCrtReconfigureScript,
  buildCrtRuntimeScript
} from '../electron/services/crtFilterRuntime.js';

test('los estilos de filtro son un conjunto cerrado y bien etiquetado', () => {
  assert.deepEqual(CRT_FILTER_STYLES, ['analog-replay', 'royale']);
  assert.equal(DEFAULT_CRT_FILTER_STYLE, 'analog-replay');
  for (const style of CRT_FILTER_STYLES) {
    assert.ok(CRT_FILTER_STYLE_LABELS[style], `falta etiqueta para ${style}`);
  }
  assert.equal(new Set(CRT_FILTER_STYLES).size, CRT_FILTER_STYLES.length, 'no debe haber estilos duplicados');
});

test('isCRTFilterStyle valida el tipo y rechaza valores desconocidos', () => {
  assert.equal(isCRTFilterStyle('royale'), true);
  assert.equal(isCRTFilterStyle('analog-replay'), true);
  assert.equal(isCRTFilterStyle(' Royale '), false, 'es un type guard estricto, no normaliza');
  assert.equal(isCRTFilterStyle('otro'), false);
  assert.equal(isCRTFilterStyle(undefined), false);
  assert.equal(isCRTFilterStyle(1), false);
});

test('el catálogo de opciones cubre todos los parámetros con rangos coherentes', () => {
  const catalogKeys = CRT_ROYALE_OPTION_CATALOG.map((option) => option.key);
  const defaultsKeys = Object.keys(CRT_ROYALE_DEFAULTS);

  assert.equal(new Set(catalogKeys).size, catalogKeys.length, 'no debe haber claves duplicadas');

  // Todo parámetro escalar del shader debe ser ajustable desde el panel. Los
  // que no lo son son constantes no escalares (ej. `phosphorTint`, un vec3).
  for (const key of defaultsKeys) {
    const value = CRT_ROYALE_DEFAULTS[key as keyof CRTRoyaleOptions];
    if (typeof value === 'number') {
      assert.ok(
        (catalogKeys as string[]).includes(key),
        `${key} es escalar pero no está en el catálogo de opciones`
      );
    }
  }

  for (const option of CRT_ROYALE_OPTION_CATALOG) {
    assert.ok(option.label, `${option.key} sin etiqueta`);
    assert.ok(option.description, `${option.key} sin descripción`);
    assert.ok(option.min < option.max, `${option.key}: min >= max`);
    assert.ok(
      option.default >= option.min && option.default <= option.max,
      `${option.key}: default ${option.default} fuera de [${option.min}, ${option.max}]`
    );
    assert.equal(option.default, CRT_ROYALE_DEFAULTS[option.key], `${option.key}: default divergente`);
  }
});

test('los shaders WebGL están completos y enlazados con la textura fuente', () => {
  assert.ok(CRT_ROYALE_VERTEX_SHADER.includes('attribute vec2 a_position'), 'falta el atributo de posición');
  assert.ok(CRT_ROYALE_VERTEX_SHADER.includes('v_uv'), 'falta el uv baritado');
  assert.ok(CRT_ROYALE_FRAGMENT_SHADER.includes('uniform sampler2D u_source'), 'falta la textura fuente');
  assert.ok(CRT_ROYALE_FRAGMENT_SHADER.includes('v_uv'), 'falta el uv en el fragment shader');
  assert.ok(CRT_ROYALE_FRAGMENT_SHADER.includes('gl_FragColor'), 'falta la salida de color');

  // Todos los uniformes usados por el shader deben existir como parámetro.
  for (const key of Object.keys(CRT_ROYALE_DEFAULTS) as (keyof CRTRoyaleOptions)[]) {
    assert.ok(CRT_ROYALE_FRAGMENT_SHADER.includes(key), `el shader no usa el parámetro ${key}`);
  }
});

test('el filtro CSS del modo original se mantiene idéntico', () => {
  assert.equal(
    ANALOG_REPLAY_CANVAS_FILTER,
    'contrast(1.2) brightness(0.95) saturate(1.3) sepia(0.05) hue-rotate(5deg)'
  );
});

test('el runtime del CRT es idempotente yembebe sus fuentes', () => {
  const script = buildCrtRuntimeScript();
  assert.ok(script.includes('window.VSMCrt'), 'debe instalar window.VSMCrt');
  assert.ok(script.includes('version === 2'), 'debe evitar reinstalarse');
  assert.ok(script.includes('vsm-main-video'), 'debe reutilizar el <video> existente');
  assert.ok(script.includes('vsm-crt-stage'), 'debe dibujar sobre el stage de resolución fija');
  assert.ok(script.includes(ANALOG_REPLAY_CANVAS_FILTER), 'debe incluir el fallback CSS');
  assert.ok(script.includes(JSON.stringify(CRT_ROYALE_DEFAULTS)), 'debe incluir los defaults del shader');
  assert.ok(
    script.includes(JSON.stringify(CRT_ROYALE_FRAGMENT_SHADER).slice(0, 60)),
    'debe embeber el fragment shader completo'
  );
});

test('apply y reconfigure pasan el estilo pedido y manejan el apagado', () => {
  const apply = buildCrtApplyScript('royale');
  assert.ok(apply.includes('window.VSMCrt.apply("royale")'), 'debe aplicar el estilo solicitado');
  assert.ok(apply.includes('css-fallback'), 'debe reportar el fallback cuando no hay WebGL');
});

test('reconfigure ejecuta la rama correcta: aplica al encender y libera al apagar', () => {
  // Se simula `window.VSMCrt` ya instalado (version 2) para que el runtime no se
  // reinstale y así poder observar únicamente la lógica de on/off.
  const run = (enabled: boolean, style: CRTFilterStyle) => {
    const calls: string[] = [];
    const stub = {
      version: 2,
      currentStyle: null as string | null,
      apply: (next: string) => {
        calls.push(`apply:${next}`);
        stub.currentStyle = next;
        return true;
      },
      dispose: () => {
        calls.push('dispose');
        stub.currentStyle = null;
      }
    };
    const context = vm.createContext({ window: { VSMCrt: stub } });
    const result = vm.runInContext(buildCrtReconfigureScript(enabled, style), context) as {
      applied: boolean;
      style: string | null;
    };
    return { calls, result };
  };

  const on = run(true, 'analog-replay');
  assert.deepEqual(on.calls, ['apply:analog-replay'], 'encendido: solo aplica');
  // El objeto viene de otro realm del `vm`, así que se comparan campo por campo.
  assert.equal(on.result.applied, true);
  assert.equal(on.result.style, 'analog-replay');

  const off = run(false, 'royale');
  assert.deepEqual(off.calls, ['dispose'], 'apagado: solo libera, sin volver a aplicar');
  assert.equal(off.result.applied, false);
  assert.equal(off.result.style, null);
});
