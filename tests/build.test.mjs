import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const dist = new URL('../dist/', import.meta.url);

// Exercise the published artifact rather than Astro's source templates.
test('the static home page ships the questionnaire, privacy policy and social preview', async () => {
  const html = await readFile(new URL('index.html', dist), 'utf8');
  assert.match(html, /<html\b[^>]*\blang="es"/);
  assert.match(html, /<form\b[^>]*\bid="start-form"/);
  assert.match(html, /http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'"/);

  const modulePath = html.match(/<script\b[^>]*\btype="module"[^>]*\bsrc="(\/_astro\/[^"/]+\.js)"/)?.[1];
  assert.ok(modulePath, 'expected a bundled client module');
  assert.ok((await readFile(new URL(modulePath.slice(1), dist))).length > 0);

  const socialImage = html.match(/property="og:image" content="([^"]+)"/)?.[1];
  assert.ok(socialImage, 'expected an Open Graph image');
  assert.equal(socialImage, 'https://programa-por-programa-29n.vercel.app/og-programa-29n.png');
  assert.deepEqual(
    await readFile(new URL('og-programa-29n.png', dist)),
    await readFile(new URL('../public/og-programa-29n.png', import.meta.url)),
  );
});

test('the built page declares a valid local favicon', async () => {
  const html = await readFile(new URL('index.html', dist), 'utf8');
  assert.match(html, /<link rel="icon" href="\/favicon\.ico"(?: type="image\/x-icon")?>/);

  const icon = await readFile(new URL('favicon.ico', dist));
  assert.deepEqual(icon, await readFile(new URL('../public/favicon.ico', import.meta.url)));
  assert.equal(icon.readUInt16LE(0), 0, 'reserved ICO header');
  assert.equal(icon.readUInt16LE(2), 1, 'ICO image type');
  assert.equal(icon.readUInt16LE(4), 1, 'one icon image');
  const size = icon.readUInt32LE(14);
  const offset = icon.readUInt32LE(18);
  assert.equal(offset + size, icon.length, 'complete icon image data');
  assert.ok(size > 40, 'icon contains image data');
});

test('the canonical and Open Graph URLs agree with the README site link', async () => {
  const html = await readFile(new URL('index.html', dist), 'utf8');
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  const site = 'https://programa-por-programa-29n.vercel.app/';
  assert.ok(html.includes(`<link rel="canonical" href="${site}">`));
  assert.ok(html.includes(`<meta property="og:url" content="${site}">`));
  assert.ok(readme.includes(`<a href="${site}">Abrir el cuestionario</a>`));
});
