/**
 * Pruebas unitarias de las utilidades de episodios multi-parte.
 *
 * Estos helpers son puros (sin DOM ni Node) y se usan tanto al generar la
 * programación como al pintar la guía, así que fijan el comportamiento que el
 * usuario ve en pantalla.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  groupEpisodesIntoBlocks,
  parseDurationToSeconds,
  parseEpisodeBlockInfo,
  stripEpisodeBlockCode
} from '../src/utils/episodeBlocks.js';

test('parseEpisodeBlockInfo detecta el patrón "<número><letra?>"', () => {
  assert.deepEqual(parseEpisodeBlockInfo('01a: Se Busca Ayuda'), { group: 1, part: 'a' });
  assert.deepEqual(parseEpisodeBlockInfo('01b - La Aspiradora'), { group: 1, part: 'b' });
  assert.deepEqual(parseEpisodeBlockInfo('51 La Fiesta'), { group: 51, part: null });
  assert.deepEqual(parseEpisodeBlockInfo('12c. Final'), { group: 12, part: 'c' });
  assert.deepEqual(parseEpisodeBlockInfo('  07B: Con espacio  '), { group: 7, part: 'b' }, 'trim + minúscula');
});

test('parseEpisodeBlockInfo devuelve null cuando no hay número reconocible', () => {
  assert.equal(parseEpisodeBlockInfo(undefined), null);
  assert.equal(parseEpisodeBlockInfo(null), null);
  assert.equal(parseEpisodeBlockInfo(''), null);
  assert.equal(parseEpisodeBlockInfo('Sin número'), null);
  assert.equal(parseEpisodeBlockInfo('a01: invertido'), null);
});

test('stripEpisodeBlockCode deja solo el título descriptivo', () => {
  assert.equal(stripEpisodeBlockCode('01a: Se Busca Ayuda'), 'Se Busca Ayuda');
  assert.equal(stripEpisodeBlockCode('01b - La Aspiradora'), 'La Aspiradora');
  assert.equal(stripEpisodeBlockCode('51 La Fiesta'), 'La Fiesta');
});

test('stripEpisodeBlockCode no destruye títulos sin código', () => {
  assert.equal(stripEpisodeBlockCode('Sin número'), 'Sin número');
  assert.equal(stripEpisodeBlockCode('12'), '12', 'si no queda texto, devuelve el original');
});

test('groupEpisodesIntoBlocks agrupa segmentos consecutivos del mismo episodio', () => {
  const episodes = [
    { episode: 1, title: '01a: Se Busca Ayuda' },
    { episode: 2, title: '01b: La Aspiradora' },
    { episode: 3, title: '01c: Regreso' },
    { episode: 4, title: '02a: Otro Episodio' }
  ];
  const blocks = groupEpisodesIntoBlocks(episodes);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].groupNumber, 1);
  assert.deepEqual(blocks[0].parts.map((p) => p.episode), [1, 2, 3]);
  assert.equal(blocks[1].groupNumber, 2);
  assert.equal(blocks[1].parts.length, 1);
});

test('groupEpisodesIntoBlocks deja un bloque propio para cada episodio sin letra', () => {
  const episodes = [
    { episode: 1, title: '01a: Parte A' },
    { episode: 2, title: '02: Episodio Completo' },
    { episode: 3, title: '03a: Parte A' }
  ];
  const blocks = groupEpisodesIntoBlocks(episodes);
  assert.deepEqual(blocks.map((b) => b.parts.length), [1, 1, 1]);
  assert.deepEqual(blocks.map((b) => b.groupNumber), [1, 2, 3]);
});

test('groupEpisodesIntoBlocks no mezcla grupos distintos ni partes no consecutivas', () => {
  const separated = groupEpisodesIntoBlocks([
    { episode: 1, title: '01a: A' },
    { episode: 2, title: '02a: B' },
    { episode: 3, title: '01b: A2' }
  ]);
  assert.deepEqual(separated.map((b) => b.parts.length), [1, 1, 1], 'grupos alternos no se unen');

  const independent = groupEpisodesIntoBlocks([{ episode: 7, title: 'Sin patrón' }]);
  assert.equal(independent[0].groupNumber, 7, 'sin patrón usa el número de secuencia');
});

test('groupEpisodesIntoBlocks devuelve lista vacía para entrada vacía', () => {
  assert.deepEqual(groupEpisodesIntoBlocks([]), []);
});

test('parseDurationToSeconds convierte mm:ss y hh:mm:ss', () => {
  assert.equal(parseDurationToSeconds('05:00'), 300);
  assert.equal(parseDurationToSeconds('22:45'), 1365);
  assert.equal(parseDurationToSeconds('01:30:00'), 5400);
  assert.equal(parseDurationToSeconds('00:00:30'), 30);
});

test('parseDurationToSeconds usa el default de 5 min ante datos inválidos', () => {
  assert.equal(parseDurationToSeconds(undefined), 300);
  assert.equal(parseDurationToSeconds(''), 300);
  assert.equal(parseDurationToSeconds('abc'), 300);
  assert.equal(parseDurationToSeconds('10'), 300, 'una sola parte no es un formato válido');
  assert.equal(parseDurationToSeconds('1:2:3:4'), 300);
});
