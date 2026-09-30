/**
 * Pruebas unitarias del contrato canónico de bloques de emisión.
 *
 * Este módulo es la fuente de verdad compartida con la aplicación externa de
 * configuración, así que sus límites son parte del contrato: si cambia alguno,
 * hay que actualizar también `CHUCK's Tools Suite` (electron/analogBroadcastBlocks.cjs).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BROADCAST_BLOCKS,
  BROADCAST_BLOCK_LABELS,
  BROADCAST_BLOCK_VALUES,
  DEFAULT_BROADCAST_BLOCK,
  getBroadcastBlockAt,
  getBroadcastBlockDefinition,
  getBroadcastBlockEnd,
  getRemainingBlockSeconds,
  isBroadcastBlockAllowed,
  normalizeBroadcastBlock
} from '../electron/services/broadcastBlocks.js';
import type { BroadcastBlock, BroadcastBlockDefinition, ConcreteBroadcastBlock } from '../electron/services/broadcastBlocks.js';

const at = (h: number, m = 0) => new Date(2026, 0, 15, h, m, 0, 0);
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const dayOf = (d: Date) => d.getDate();

test('el contrato expone exactamente los cuatro valores esperados, en orden', () => {
  assert.deepEqual([...BROADCAST_BLOCK_VALUES], ['morning', 'afternoon', 'night', 'all']);
  assert.equal(DEFAULT_BROADCAST_BLOCK, 'all');
  for (const value of BROADCAST_BLOCK_VALUES) {
    assert.ok(BROADCAST_BLOCK_LABELS[value], `falta etiqueta para ${value}`);
  }
  assert.deepEqual(
    BROADCAST_BLOCKS.map((block) => block.id),
    ['morning', 'afternoon', 'night']
  );
});

test('los bloques-defined no se solapan y cubren las 24 horas', () => {
  const sorted = [...BROADCAST_BLOCKS].sort((a, b) => a.startMinutes - b.startMinutes);
  // morning, afternoon, night: la noche envuelve la medianoche.
  assert.equal(sorted[0].startMinutes, 6 * 60);
  assert.equal(sorted[1].startMinutes, 14 * 60);
  assert.equal(sorted[2].startMinutes, 22 * 60);
  assert.equal(sorted[2].endMinutes, 6 * 60, 'la noche debe cerrar a las 06:00');

  // Cada minuto del día pertenece a exactamente un bloque.
  for (let minute = 0; minute < 24 * 60; minute += 1) {
    const matching = BROADCAST_BLOCKS.filter((block) => {
      const inSameDay = block.startMinutes < block.endMinutes;
      return inSameDay
        ? minute >= block.startMinutes && minute < block.endMinutes
        : minute >= block.startMinutes || minute < block.endMinutes;
    });
    assert.equal(matching.length, 1, `el minuto ${minute} pertenece a ${matching.length} bloques`);
  }
});

test('getBroadcastBlockAt resuelve los límites exactos del contrato', () => {
  assert.equal(getBroadcastBlockAt(at(0, 0)), 'night');
  assert.equal(getBroadcastBlockAt(at(5, 59)), 'night');
  assert.equal(getBroadcastBlockAt(at(6, 0)), 'morning', '06:00 es inclusivo en morning');
  assert.equal(getBroadcastBlockAt(at(13, 59)), 'morning');
  assert.equal(getBroadcastBlockAt(at(14, 0)), 'afternoon');
  assert.equal(getBroadcastBlockAt(at(21, 59)), 'afternoon');
  assert.equal(getBroadcastBlockAt(at(22, 0)), 'night');
  assert.equal(getBroadcastBlockAt(at(23, 59)), 'night');

  for (let h = 0; h < 24; h += 1) {
    const block = getBroadcastBlockAt(at(h));
    assert.ok(['morning', 'afternoon', 'night'].includes(block), `hora ${h}:00 mal resuelta`);
  }
});

test('getBroadcastBlockEnd coincide con el inicio del bloque siguiente', () => {
  assert.equal(hhmm(getBroadcastBlockEnd(at(0, 0))), '06:00');
  assert.equal(dayOf(getBroadcastBlockEnd(at(0, 0))), 15, 'antes de medianoche el fin cae hoy');
  assert.equal(hhmm(getBroadcastBlockEnd(at(2, 0))), '06:00');
  assert.equal(dayOf(getBroadcastBlockEnd(at(2, 0))), 15);
  assert.equal(hhmm(getBroadcastBlockEnd(at(7, 0))), '14:00');
  assert.equal(dayOf(getBroadcastBlockEnd(at(7, 0))), 15);
  assert.equal(hhmm(getBroadcastBlockEnd(at(15, 0))), '22:00');
  assert.equal(dayOf(getBroadcastBlockEnd(at(15, 0))), 15);
  assert.equal(hhmm(getBroadcastBlockEnd(at(23, 0))), '06:00');
  assert.equal(dayOf(getBroadcastBlockEnd(at(23, 0))), 16, '23:00 debe cerrar al día siguiente');

  // El fin de bloque siempre es el inicio del bloque siguiente.
  for (let h = 0; h < 24; h += 1) {
    const end = getBroadcastBlockEnd(at(h));
    const next = getBroadcastBlockAt(new Date(end.getTime() - 1));
    assert.equal(next, getBroadcastBlockAt(at(h)), `discontinuidad de bloque a las ${h}:00`);
  }
});

test('getRemainingBlockSeconds nunca es negativo ni excede la duración del bloque', () => {
  assert.equal(getRemainingBlockSeconds(at(13, 30)), 30 * 60, '13:30 quedan 30 min');
  assert.equal(getRemainingBlockSeconds(at(6, 0)), 8 * 3600);
  assert.equal(getRemainingBlockSeconds(at(14, 0)), 8 * 3600);
  assert.equal(getRemainingBlockSeconds(at(22, 0)), 8 * 3600);
  assert.equal(getRemainingBlockSeconds(at(5, 59)), 60, 'justo antes del cambio de bloque');

  for (let h = 0; h < 24; h += 1) {
    const remaining = getRemainingBlockSeconds(at(h));
    assert.ok(remaining > 0 && remaining <= 8 * 3600, `restantes a las ${h}:00 fuera de rango: ${remaining}`);
  }
});

test('normalizeBroadcastBlock es retrocompatible: ausente o inválido cae en all', () => {
  assert.equal(normalizeBroadcastBlock(undefined), 'all');
  assert.equal(normalizeBroadcastBlock(null), 'all');
  assert.equal(normalizeBroadcastBlock(''), 'all');
  assert.equal(normalizeBroadcastBlock('bogus'), 'all');
  assert.equal(normalizeBroadcastBlock(42), 'all');
  assert.equal(normalizeBroadcastBlock({}), 'all');
  assert.equal(normalizeBroadcastBlock('MORNING'), 'morning', 'case-insensitive');
  assert.equal(normalizeBroadcastBlock('  Night  '), 'night', 'trim + case-insensitive');
  assert.equal(normalizeBroadcastBlock('all'), 'all');

  for (const value of BROADCAST_BLOCK_VALUES) {
    assert.equal(normalizeBroadcastBlock(value), value, `${value} debe ser idempotente`);
  }
});

test('isBroadcastBlockAllowed: all siempre, y cada bloque solo en su ventana', () => {
  for (let h = 0; h < 24; h += 1) {
    assert.equal(isBroadcastBlockAllowed('all', at(h)), true, `all debe ser elegible a las ${h}:00`);
  }
  assert.equal(isBroadcastBlockAllowed('morning', at(7)), true);
  assert.equal(isBroadcastBlockAllowed('morning', at(15)), false);
  assert.equal(isBroadcastBlockAllowed('afternoon', at(14)), true);
  assert.equal(isBroadcastBlockAllowed('afternoon', at(21, 59)), true);
  assert.equal(isBroadcastBlockAllowed('afternoon', at(22, 0)), false);
  assert.equal(isBroadcastBlockAllowed('night', at(2)), true);
  assert.equal(isBroadcastBlockAllowed('night', at(23)), true);
  assert.equal(isBroadcastBlockAllowed('night', at(6)), false);
});

test('un episodio cabe en su bloque solo si termina antes del límite', () => {
  // 30 min: entra en los tres bloques; 8 h + 1 min: no entra en ninguno.
  const fits = (block: ConcreteBroadcastBlock, durationSeconds: number, hour: number) => {
    const start = at(hour, 0);
    const end = new Date(start.getTime() + durationSeconds * 1000);
    return isBroadcastBlockAllowed(block, start) && end.getTime() <= getBroadcastBlockEnd(start).getTime();
  };

  assert.equal(fits('morning', 30 * 60, 6), true);
  assert.equal(fits('morning', 30 * 60, 13), true, '13:00 + 30 min termina 13:30, dentro del bloque');
  assert.equal(fits('morning', 75 * 60, 13), false, '13:00 + 1h15 cruza las 14:00');
  assert.equal(fits('morning', 8 * 3600, 6), true, '8 h exactas caben en el bloque de 8 h');
  assert.equal(fits('morning', 8 * 3600 + 60, 6), false, '8 h + 1 min no caben');
  assert.equal(fits('night', 30 * 60, 23), true);
  assert.equal(fits('night', 7 * 3600, 23), true, '23:00 + 7 h llega justo a las 06:00');
  assert.equal(fits('night', 7 * 3600 + 60, 23), false, '23:00 + 7h01 cruza las 06:00');
  assert.equal(fits('night', 8 * 3600, 23), false, 'un bloque de 8 h no cabe en las 7 h restantes');
  assert.equal(fits('night', 3 * 3600, 3), true, '03:00 + 3 h llega justo a las 06:00');
  assert.equal(fits('night', 3 * 3600 + 60, 3), false, '03:00 + 3h01 cruza las 06:00');
});

test('getBroadcastBlockDefinition lanza con un bloque desconocido', () => {
  assert.equal(getBroadcastBlockDefinition('night').endMinutes, 6 * 60);
  assert.throws(
    () => getBroadcastBlockDefinition('all' as ConcreteBroadcastBlock),
    /desconocido/i
  );
});

test('getBroadcastBlockAt cae en morning si la tabla de bloques quedara vacía', () => {
  // Rama defensiva: los tres bloques cubren las 24 h, así que solo se alcanza si
  // la tabla se corrompe. Se restaura en el `finally` para no afectar a otras pruebas.
  const original = [...BROADCAST_BLOCKS];
  const mutable = BROADCAST_BLOCKS as BroadcastBlockDefinition[];
  mutable.length = 0;
  try {
    assert.equal(getBroadcastBlockAt(at(3, 30)), 'morning');
  } finally {
    mutable.push(...original);
  }
  assert.equal(BROADCAST_BLOCKS.length, 3, 'la tabla debe quedar restaurada');
});

test('los helpers son inmutables frente a su entrada', () => {
  const show: BroadcastBlock = 'afternoon';
  const date = at(15);
  isBroadcastBlockAllowed(show, date);
  normalizeBroadcastBlock(show);
  assert.equal(show, 'afternoon');
  assert.equal(date.getTime(), at(15).getTime());
});
