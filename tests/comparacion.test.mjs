import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getComparison } from '../src/scripts/comparacion.js';

const candidate = { id: 'candidate' };

function question(id, stance) {
  return { id, positions: stance ? { [candidate.id]: { stance } } : {} };
}

function questionIds(rows) {
  return rows.map(({ question }) => question.id);
}

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
