import assert from 'node:assert/strict';
import { test } from 'node:test';
import roster from '../src/data/candidaturas.js';
import programas from '../src/data/programas.js';
import * as ambito from '../src/scripts/comparacion.js';

test('las medidas locales requieren coincidencia de territorio y candidatura', () => {
  const bardenas = programas.questions.find(q => q.id === 'bardenasRange');
  assert.deepEqual(bardenas.districts, ['navarra']);
  const candidates = [{ id: 'eh-bildu' }];
  const filter = (district, includeLocal, lists = candidates) =>
    ambito.questionsForScope(programas.questions, lists, district, includeLocal).map(q => q.id);
  assert.ok(filter('navarra', false).includes('bardenasRange'));
  assert.ok(!filter('bizkaia', true).includes('bardenasRange'));
  assert.ok(!filter('navarra', false, []).includes('bardenasRange'));
  assert.ok(!filter(undefined, false).includes('bardenasRange'));
  assert.ok(filter(undefined, true).includes('bardenasRange'));
  assert.ok(filter(undefined, false).includes('rentCaps'));
});

test('todas las medidas locales y solo ellas declaran distritos del BOE', () => {
  const known = new Set(roster.districts.map(d => d.id));
  for (const q of programas.questions) {
    if (q.local) {
      assert.ok(q.districts?.length, q.id);
      assert.ok(q.districts.every(id => known.has(id)), q.id);
    } else assert.equal(q.districts, undefined, q.id);
  }
});
