import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parse } from 'acorn';

function duplicados(source) {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const errors = [];
  function properties(node, label) {
    if (node?.type !== 'ObjectExpression') throw new Error(`estructura inválida: ${label}`);
    const keys = new Map();
    for (const property of node.properties) {
      if (property.type !== 'Property' || property.computed || property.kind !== 'init' || property.method) throw new Error(`estructura inválida: ${label}`);
      const key = property.key.type === 'Identifier' ? property.key.name : property.key.value;
      if (typeof key !== 'string' && typeof key !== 'number') throw new Error(`estructura inválida: ${label}`);
      const name = String(key);
      if (keys.has(name)) errors.push(`${label}: clave duplicada ${name}`);
      keys.set(name, property.value);
    }
    return keys;
  }
  const exports = ast.body.filter(node => node.type === 'ExportDefaultDeclaration');
  if (exports.length !== 1) throw new Error('estructura inválida: export');
  const root = properties(exports[0].declaration, 'raíz');
  properties(root.get('parties'), 'parties');
  const questions = root.get('questions');
  if (questions?.type !== 'ArrayExpression') throw new Error('estructura inválida: questions');
  questions.elements.forEach((question, index) => {
    const entries = properties(question, `questions[${index}]`);
    properties(entries.get('positions'), `questions[${index}].positions`);
  });
  return errors;
}

test('detecta claves duplicadas antes de que JavaScript las sobrescriba', () => {
  const source = `export default { parties: { a: {}, 'a': {}, b: {} }, questions: [
    { id: 'q', positions: { a: {}, 'a': {}, b: {} } },
    { id: 'q2', positions: { a: {}, b: {} } }
  ] };`;
  assert.deepEqual(duplicados(source), ['parties: clave duplicada a', 'questions[0].positions: clave duplicada a']);
});

test('rechaza estructuras dinámicas que podrían ocultar claves', () => {
  assert.throws(() => duplicados('export default { parties: { ...otros }, questions: [] };'), /estructura/);
  assert.throws(() => duplicados('export default { parties: {}, questions: [{ positions: { [id]: {} } }] };'), /estructura/);
});

test('los datos reales no contienen claves de candidatura duplicadas', async () => {
  const source = await readFile(new URL('../src/data/programas.js', import.meta.url), 'utf8');
  assert.deepEqual(duplicados(source), []);
});
