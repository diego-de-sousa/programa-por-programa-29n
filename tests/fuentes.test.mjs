import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import roster from '../src/data/candidaturas.js';
import programs from '../src/data/programas.js';
import { validarDatos, validarFuentesElectorales, recogerEnlaces } from '../src/data/validacion.js';
import { comprobarEnlaces, formatearInforme, main } from '../scripts/comprobar-enlaces.mjs';
import { solicitarFuente } from '../scripts/solicitar-fuente.mjs';
import { EventEmitter } from 'node:events';

function fixture() {
  return {
    roster: { source: 'https://example.org/boe#uno', correction: 'https://example.org/correction', districts: [
      { id: 'uno', congress: [{ id: 'a', sigla: null }, { id: 'sin-programa' }] },
      { id: 'dos', congress: [{ id: 'a' }] },
    ] },
    programs: { parties: {
      a: { url: 'https://example.org/doc#p1', landing: 'https://example.org/landing', copy: 'https://example.org/copy' },
      'sin-programa': {},
    }, questions: [{ id: 'q', positions: { a: { stance: 'yes', locator: 'p. 1', url: 'https://example.org/doc#p2' } } }] },
  };
}

test('datos reales y excepciones legítimas son válidos sin red', () => {
  assert.deepEqual(validarDatos(roster, programs), []);
  const f = fixture();
  assert.deepEqual(validarDatos(f.roster, f.programs), []);
});

test('solo se publican posturas con respaldo documental electoral directo', () => {
  for (const id of ['fo', 'cha-fa', 'd-r-g', 'upc', 'rrb', 'escanos-en-blanco', 'eguzkilore']) {
    assert.ok(programs.parties[id], id);
    assert.equal(programs.parties[id].url, undefined, id);
    assert.ok(!programs.questions.some(q => Object.hasOwn(q.positions, id)), id);
  }
  assert.match(programs.parties.erc.url, /\.pdf$/);
  assert.deepEqual(validarFuentesElectorales(programs), []);
  const f = fixture();
  f.programs.parties.a.sourceStatus = 'electoral';
  const position = f.programs.questions[0].positions.a;
  position.evidence = 'Se compromete a adoptar la medida.';
  assert.deepEqual(validarFuentesElectorales(f.programs), []);
  position.url = 'https://example.org/landing';
  assert.deepEqual(validarFuentesElectorales(f.programs), ['Posición q/a: fuente electoral no admitida']);
});

test('identificadores duplicados, posiciones desconocidas y postura inválida se detectan', () => {
  const f = fixture();
  f.roster.districts.push({ id: 'uno', congress: [{ id: 'x' }, { id: 'x' }] });
  f.programs.questions.push({ id: 'q', positions: { desconocida: { stance: 'quizá', locator: 'p. 2', url: 'https://example.org/otro' } } });
  assert.deepEqual(validarDatos(f.roster, f.programs), [
    'Circunscripción duplicada: uno',
    'Candidatura duplicada en uno: x',
    'Pregunta duplicada: q',
    'Posición q/desconocida: candidatura desconocida',
    'Posición q/desconocida: postura inválida',
  ]);
});

test('un programa huérfano se detecta aunque no tenga posiciones', () => {
  const f = fixture();
  f.programs.parties.huerfano = {};
  assert.deepEqual(validarDatos(f.roster, f.programs), ['Programa huerfano: candidatura desconocida']);
});

test('fuentes y localizadores ausentes o inseguros se detectan sin ocultar errores', () => {
  const f = fixture();
  f.roster.source = 'file:///tmp/x';
  f.roster.correction = '';
  f.programs.parties.a.url = 'https://user:pass@example.org/doc';
  f.programs.parties.a.landing = 'javascript:alert(1)';
  f.programs.parties.a.copy = '';
  f.programs.questions[0].positions.a = { stance: 'no', locator: '  ', url: 'not a url' };
  assert.deepEqual(validarDatos(f.roster, f.programs), [
    'Candidaturas source: URL HTTP(S) inválida',
    'Candidaturas correction: URL HTTP(S) inválida',
    'Programa a url: URL HTTP(S) inválida',
    'Programa a landing: URL HTTP(S) inválida',
    'Programa a copy: URL HTTP(S) inválida',
    'Posición q/a: localizador ausente',
    'Posición q/a url: URL HTTP(S) inválida',
  ]);
  delete f.programs.questions[0].positions.a.url;
  delete f.programs.parties.a.url;
  assert.ok(validarDatos(f.roster, f.programs).includes('Posición q/a: fuente ausente o inválida'));
});

test('recoge enlaces únicos de todos los tipos y elimina fragmentos, sin perder consultas', () => {
  const f = fixture();
  assert.deepEqual(recogerEnlaces(f.roster, f.programs), [
    'https://example.org/boe', 'https://example.org/correction', 'https://example.org/doc',
    'https://example.org/landing', 'https://example.org/copy',
  ]);
  f.programs.questions[0].positions.a.url = 'https://example.org/doc?x=1#p3';
  assert.equal(recogerEnlaces(f.roster, f.programs).at(-1), 'https://example.org/doc?x=1');
});

test('auditoría secuencial clasifica resultados, cancela cuerpos y no envía credenciales', async () => {
  const calls = [];
  const cancelled = [];
  const statuses = [200, 404, 410, 403, 503];
  const fetch = async (url, options) => {
    calls.push([url, options]);
    if (url.endsWith('/timeout')) return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
    const status = statuses.shift();
    return { status, headers: new Headers(), body: { cancel: async () => { cancelled.push(url); } } };
  };
  const urls = ['ok', 'missing', 'gone', 'bot', 'server', 'timeout'].map(x => `https://example.org/${x}`);
  const results = await comprobarEnlaces(urls, { fetch, timeoutMs: 10, delayMs: 0 });
  assert.deepEqual(results.map(({ estado, detalle }) => [estado, detalle]), [
    ['correcto', 'HTTP 200'], ['ausente', 'HTTP 404'], ['ausente', 'HTTP 410'],
    ['inconcluso', 'HTTP 403'], ['inconcluso', 'HTTP 503'], ['inconcluso', 'tiempo de espera agotado'],
  ]);
  assert.equal(cancelled.length, 5);
  assert.deepEqual(calls.map(([url]) => url), urls);
  for (const [, options] of calls) {
    assert.equal(options.method, 'GET');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'manual');
    assert.ok(options.signal);
    assert.equal('cookie' in options.headers, false);
  }
  assert.equal(formatearInforme(results), `Correcto (HTTP 200): https://example.org/ok\nAusente confirmado (HTTP 404): https://example.org/missing\nAusente confirmado (HTTP 410): https://example.org/gone\nInconcluso (HTTP 403): https://example.org/bot\nInconcluso (HTTP 503): https://example.org/server\nInconcluso (tiempo de espera agotado): https://example.org/timeout\nResumen: 1 correctos, 2 ausentes confirmados, 3 inconclusos.`);
});

test('redirecciones tienen límite, se cancelan y no permiten destinos inseguros', async () => {
  const cancelled = [];
  const calls = [];
  const fetch = async (url) => {
    calls.push(url);
    return { status: 302, headers: new Headers({ location: url.endsWith('/unsafe') ? 'https://user:pass@example.org/' : '/loop' }), body: { cancel: async () => { cancelled.push(url); } } };
  };
  const results = await comprobarEnlaces(['https://example.org/unsafe', 'https://example.org/loop'], { fetch, timeoutMs: 100, delayMs: 0 });
  assert.deepEqual(results.map(r => [r.estado, r.detalle]), [['inconcluso', 'redirección inválida'], ['inconcluso', 'demasiadas redirecciones']]);
  assert.equal(calls.length, 5);
  assert.deepEqual(cancelled, calls);
});

test('transporte conecta solo con IPv4 público comprobado en lookup y cancela el cuerpo', async () => {
  const calls = [];
  let destroyed = 0;
  const lookup = (host, options, done) => { calls.push(['dns', host, options]); done(null, '8.8.8.8', 4); };
  const request = (url, options, callback) => {
    calls.push(['request', url.href, options]);
    const req = new EventEmitter();
    req.end = () => options.lookup(url.hostname, { family: 4, all: false }, (error, address, family) => {
      assert.equal(error, null); assert.equal(address, '8.8.8.8'); assert.equal(family, 4);
      const res = new EventEmitter();
      res.statusCode = 200; res.headers = { location: '/other' }; res.destroy = () => { destroyed++; };
      callback(res);
    });
    req.destroy = () => {};
    return req;
  };
  const result = await solicitarFuente('https://example.org/doc', { signal: new AbortController().signal }, { lookup, request });
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('location'), '/other');
  await result.body.cancel();
  assert.equal(destroyed, 1);
  assert.equal(calls[0][1], 'https://example.org/doc');
  assert.equal(calls[0][2].agent, false);
  assert.equal(calls[0][2].family, 4);
  assert.equal(calls[0][2].servername, 'example.org');
  assert.equal(calls[0][2].headers.cookie, undefined);
  assert.equal(calls[0][2].headers.authorization, undefined);
  assert.equal(calls[1][1], 'example.org');
  assert.equal(calls[1][2].family, 4);
});

test('DNS y destinos no públicos se rechazan antes de conectar, incluso tras redirección', async () => {
  const denied = ['0.2.3.4', '10.2.3.4', '100.64.0.1', '127.2.3.4', '169.254.1.2', '172.16.0.1', '192.0.0.1', '192.0.2.1', '192.88.99.1', '192.168.1.1', '198.18.0.1', '198.51.100.1', '203.0.113.1', '224.0.0.1', '240.0.0.1', '::1'];
  for (const ip of denied) {
    let connected = false;
    const request = (url, options) => {
      const req = new EventEmitter();
      req.end = () => options.lookup(url.hostname, { family: 4, all: false }, error => {
        if (error) req.emit('error', error); else connected = true;
      });
      req.destroy = () => {};
      return req;
    };
    const lookup = (host, options, done) => done(null, ip, 4);
    await assert.rejects(solicitarFuente('https://example.org/', { signal: new AbortController().signal }, { request, lookup }));
    assert.equal(connected, false, ip);
  }
  const calls = [];
  const fetch = async url => { calls.push(url); return { status: 302, headers: new Headers({ location: 'http://127.0.0.1/' }), body: null }; };
  const result = await comprobarEnlaces(['https://example.org/'], { fetch, delayMs: 0 });
  assert.deepEqual(calls, ['https://example.org/']);
  assert.deepEqual(result.map(r => [r.estado, r.detalle]), [['inconcluso', 'destino no permitido']]);
  const blocked = await comprobarEnlaces(['http://127.1/', 'https://example.org:8443/'], { fetch, delayMs: 0 });
  assert.deepEqual(blocked.map(r => [r.estado, r.detalle]), [['inconcluso', 'destino no permitido'], ['inconcluso', 'destino no permitido']]);
  assert.equal(calls.length, 1);
});

test('DNS se verifica de nuevo al conectar a cada dominio redirigido', async () => {
  const requests = [], lookups = [], connected = [];
  let cancelled = 0;
  const lookup = (host, options, done) => {
    lookups.push(host);
    done(null, host === 'example.org' ? '8.8.8.8' : '10.0.0.1', 4);
  };
  const request = (url, options, callback) => {
    requests.push(url.hostname);
    const req = new EventEmitter();
    req.end = () => options.lookup(url.hostname, { family: 4, all: true }, (error, addresses) => {
      if (error) return req.emit('error', error);
      connected.push(addresses);
      const res = new EventEmitter();
      res.statusCode = 302; res.headers = { location: 'https://other.example/target' };
      res.destroy = () => { cancelled++; };
      callback(res);
    });
    req.destroy = () => {};
    return req;
  };
  const fetch = (url, options) => solicitarFuente(url, options, { lookup, request });
  const result = await comprobarEnlaces(['https://example.org/start'], { fetch, delayMs: 0 });
  assert.deepEqual(requests, ['example.org', 'other.example']);
  assert.deepEqual(lookups, requests);
  assert.deepEqual(connected, [[{ address: '8.8.8.8', family: 4 }]]);
  assert.equal(cancelled, 1);
  assert.deepEqual(result.map(r => [r.estado, r.detalle]), [['inconcluso', 'error de red']]);
});

test('redirecciones relativas se comprueban y usan la misma interfaz de fetch', async () => {
  const calls = [];
  const fetch = async url => { calls.push(url); return { status: calls.length === 1 ? 302 : 200, headers: new Headers({ location: '/final' }), body: null }; };
  const result = await comprobarEnlaces(['https://example.org/start'], { fetch, delayMs: 0 });
  assert.deepEqual(calls, ['https://example.org/start', 'https://example.org/final']);
  assert.deepEqual(result.map(r => [r.estado, r.detalle]), [['correcto', 'HTTP 200']]);
});

test('el comando bloquea datos inválidos antes de la red y solo falla por ausencias confirmadas', async () => {
  const f = fixture();
  const stdout = [], stderr = [];
  const salida = { log: value => stdout.push(value), error: value => stderr.push(value) };
  let calls = 0;
  const fetch = async () => { calls++; return { status: 403, headers: new Headers(), body: null }; };
  f.programs.questions[0].positions.a.locator = '';
  assert.equal(await main(['--enlaces'], { candidaturas: f.roster, programas: f.programs, salida, fetch, delayMs: 0 }), 1);
  assert.deepEqual(stdout, []);
  assert.deepEqual(stderr, ['Validación offline: 1 errores.\nPosición q/a: localizador ausente']);
  assert.equal(calls, 0);
  f.programs.questions[0].positions.a.locator = 'p. 1';
  stderr.length = 0;
  assert.equal(await main(['--enlaces'], { candidaturas: f.roster, programas: f.programs, salida, fetch, delayMs: 0 }), 0);
  assert.equal(calls, 5);
  assert.equal(stdout[0], 'Validación offline: sin errores.');
  assert.equal(stdout[1], 'Inconcluso (HTTP 403): https://example.org/boe\nInconcluso (HTTP 403): https://example.org/correction\nInconcluso (HTTP 403): https://example.org/doc\nInconcluso (HTTP 403): https://example.org/landing\nInconcluso (HTTP 403): https://example.org/copy\nResumen: 0 correctos, 0 ausentes confirmados, 5 inconclusos.');
  assert.deepEqual(stderr, []);
  stdout.length = 0;
  const missing = async () => ({ status: 404, headers: new Headers(), body: null });
  assert.equal(await main(['--enlaces'], { candidaturas: f.roster, programas: f.programs, salida, fetch: missing, delayMs: 0 }), 1);
  assert.equal(stdout[1], 'Ausente confirmado (HTTP 404): https://example.org/boe\nAusente confirmado (HTTP 404): https://example.org/correction\nAusente confirmado (HTTP 404): https://example.org/doc\nAusente confirmado (HTTP 404): https://example.org/landing\nAusente confirmado (HTTP 404): https://example.org/copy\nResumen: 0 correctos, 5 ausentes confirmados, 0 inconclusos.');
  assert.deepEqual(stderr, []);
});

test('CLI ofrece ayuda y validación offline con salida y códigos definidos', () => {
  const help = spawnSync(process.execPath, ['scripts/comprobar-enlaces.mjs', '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.equal(help.stderr, '');
  assert.equal(help.stdout, 'Uso: node scripts/comprobar-enlaces.mjs [--enlaces|--help]\nSin opciones valida los datos sin conexión; --enlaces también comprueba las fuentes públicas.\n');
  const offline = spawnSync(process.execPath, ['scripts/comprobar-enlaces.mjs'], { encoding: 'utf8' });
  assert.equal(offline.status, 0);
  assert.equal(offline.stderr, '');
  assert.equal(offline.stdout, 'Validación offline: sin errores.\n');
  const invalid = spawnSync(process.execPath, ['scripts/comprobar-enlaces.mjs', '--desconocida'], { encoding: 'utf8' });
  assert.equal(invalid.status, 2);
  assert.equal(invalid.stdout, '');
  assert.equal(invalid.stderr, 'Opción inválida. Usa --help.\n');
});
