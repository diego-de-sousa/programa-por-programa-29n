import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as comparison from '../src/scripts/comparacion.js';
const { getComparison } = comparison;

const candidate = { id: 'candidate' };

function question(id, stance) {
  return { id, positions: stance ? { [candidate.id]: { stance } } : {} };
}

function questionIds(rows) {
  return rows.map(({ question }) => question.id);
}

test('ambiguous positions are excluded and remain available as evidence', () => {
  const questions = [question('clear', 'yes'), question('partial', 'ambiguous'), question('missing')];
  const result = getComparison(candidate, questions, new Map([['clear', 'yes'], ['partial', 'no'], ['missing', 'yes']]));
  assert.equal(result.ratio, 1);
  assert.deepEqual(questionIds(result.comparable), ['clear']);
  assert.deepEqual(questionIds(result.ambiguous), ['partial']);
  assert.deepEqual(questionIds(result.unpositioned), ['missing']);
});

test('common comparison enforces both thresholds and excludes nonbinary, skipped and missing positions', () => {
  assert.equal(typeof comparison.comparePair, 'function');
  const qs = Array.from({ length: 9 }, (_, i) => ({ id: String(i), topic: `T${i % 4}`, positions: { a: { stance: 'yes' }, b: { stance: 'no' } } }));
  const responses = new Map(qs.map(q => [q.id, 'yes']));
  qs[8].positions.b.stance = 'ambiguous';
  const result = comparison.comparePair({ id: 'a' }, { id: 'b' }, qs, responses);
  assert.equal(result.shared.length, 8);
  assert.equal(result.topics.length, 4);
  assert.equal(result.eligible, true);
  assert.deepEqual(result.scores, [1, 0]);
  assert.equal(result.sensitive, false);
  responses.set('0', 'skip');
  const insufficient = comparison.comparePair({ id: 'a' }, { id: 'b' }, qs, responses);
  assert.equal(insufficient.shared.length, 7);
  assert.equal(insufficient.eligible, false);
  assert.equal(insufficient.scores, null);
  responses.set('0', 'yes');
  qs[3].topic = 'T0'; qs[7].topic = 'T0';
  assert.equal(comparison.comparePair({ id: 'a' }, { id: 'b' }, qs, responses).eligible, false);
  assert.equal(comparison.comparePair({ id: 'a' }, { id: 'a' }, qs, responses).eligible, false);
});

test('topic removal detects both reversals and changes to or from a tie', () => {
  assert.equal(typeof comparison.comparePair, 'function');
  const qs = Array.from({ length: 8 }, (_, i) => ({ id: String(i), topic: `T${i % 4}`, positions: { a: { stance: 'yes' }, b: { stance: i < 2 ? 'no' : 'yes' } } }));
  const responses = new Map(qs.map(q => [q.id, 'yes']));
  const result = comparison.comparePair({ id: 'a' }, { id: 'b' }, qs, responses);
  assert.equal(result.eligible, true);
  assert.equal(result.sensitive, false);
  qs[1].topic = 'T0';
  assert.equal(comparison.comparePair({ id: 'a' }, { id: 'b' }, qs, responses).sensitive, true);
  qs[2].positions.a.stance = 'no'; qs[3].positions.a.stance = 'no';
  assert.equal(comparison.comparePair({ id: 'a' }, { id: 'b' }, qs, responses).sensitive, true);
});

test('three matches out of four comparable answers score 75%', () => {
  const questions = [question('a', 'yes'), question('b', 'no'), question('c', 'yes'), question('d', 'yes')];
  const responses = new Map([['a', 'yes'], ['b', 'no'], ['c', 'yes'], ['d', 'no']]);
  const result = getComparison(candidate, questions, responses);

  assert.equal(result.ratio, 0.75);
  assert.deepEqual(questionIds(result.comparable), ['a', 'b', 'c', 'd']);
  assert.deepEqual(questionIds(result.matching), ['a', 'b', 'c']);
  assert.deepEqual(questionIds(result.disagreements), ['d']);
  assert.deepEqual(result.omitted, []);
});

test('skipped, unanswered and unpositioned measures do not count toward the score', () => {
  const questions = [question('match', 'yes'), question('skipped', 'no'), question('unanswered', 'yes'), question('no-position')];
  const responses = new Map([['match', 'yes'], ['skipped', 'skip'], ['no-position', 'no']]);
  const result = getComparison(candidate, questions, responses);

  assert.equal(result.ratio, 1);
  assert.deepEqual(questionIds(result.comparable), ['match']);
  assert.deepEqual(questionIds(result.matching), ['match']);
  assert.deepEqual(result.disagreements, []);
  assert.deepEqual(questionIds(result.omitted), ['skipped', 'unanswered']);
});

test('no comparable answers give no score', () => {
  const result = getComparison(candidate, [question('skipped', 'yes')], new Map([['skipped', 'skip']]));

  assert.equal(result.ratio, null);
  assert.deepEqual(result.comparable, []);
  assert.deepEqual(result.matching, []);
  assert.deepEqual(result.disagreements, []);
  assert.deepEqual(questionIds(result.omitted), ['skipped']);
});

test('a comparable answer that disagrees gives a score of zero', () => {
  const result = getComparison(candidate, [question('disagreement', 'yes')], new Map([['disagreement', 'no']]));

  assert.equal(result.ratio, 0);
  assert.deepEqual(questionIds(result.comparable), ['disagreement']);
  assert.deepEqual(result.matching, []);
  assert.deepEqual(questionIds(result.disagreements), ['disagreement']);
  assert.deepEqual(result.omitted, []);
});
