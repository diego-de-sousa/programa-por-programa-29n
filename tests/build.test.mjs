import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const dist = new URL('../dist/', import.meta.url);

// Exercise the published artifact rather than Astro's source templates.
test('the static home page ships the questionnaire, privacy policy and social preview', async () => {
  const html = await readFile(new URL('index.html', dist), 'utf8');
  assert.match(html, /<html\b[^>]*\blang="es"/);
  assert.match(html, /<form\b[^>]*\bid="start-form"/);
  assert.match(html, /http-equiv="Content-Security-Policy"[^>]*connect-src 'none'; form-action 'none'; base-uri 'none'/);

  const modulePath = html.match(/<script\b[^>]*\btype="module"[^>]*\bsrc="(\/_astro\/[^"/]+\.js)"/)?.[1];
  assert.ok(modulePath, 'expected a bundled client module');
  assert.ok((await readFile(new URL(modulePath.slice(1), dist))).length > 0);

  const socialImage = html.match(/property="og:image" content="([^"]+)"/)?.[1];
  assert.ok(socialImage, 'expected an Open Graph image');
  assert.equal(new URL(socialImage).pathname, '/og-programa-29n.png');
  assert.deepEqual(
    await readFile(new URL('og-programa-29n.png', dist)),
    await readFile(new URL('../public/og-programa-29n.png', import.meta.url)),
  );
});
