import { test, expect } from '@playwright/test';

const startMadrid = async page => {
  await page.goto('/');
  await page.getByLabel('Circunscripción').selectOption('madrid');
  await page.getByRole('button', { name: 'Empezar cuestionario' }).click();
};

const answerAndNext = async (page, answer) => {
  await page.getByLabel(answer, { exact: true }).check();
  await page.getByRole('button', { name: 'Siguiente' }).click();
};

test('Firefox decodifica el favicon local bajo la política CSP', async ({ page }) => {
  await page.goto('/');
  const icon = page.locator('link[rel="icon"]');
  await expect(icon).toHaveAttribute('href', '/favicon.ico');
  const result = await icon.evaluate(async link => {
    const image = new Image();
    image.src = link.href;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  });
  expect(result.width).toBeGreaterThan(0);
  expect(result.height).toBeGreaterThan(0);
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute('content', /default-src 'none'.*img-src 'self'/);
});

test('recorrido de Madrid conserva respuestas, omite y abre la fuente sin tráfico externo', async ({ page, context }) => {
  await startMadrid(page);
  await expect(page.getByRole('heading', { name: /límite legal al precio del alquiler/ })).toBeVisible();
  await answerAndNext(page, 'A favor');
  await page.getByRole('button', { name: 'Anterior' }).click();
  await expect(page.getByLabel('A favor', { exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await answerAndNext(page, 'Sin opinión / prefiero pasar');
  await page.getByRole('button', { name: 'Ver resultados con mis respuestas actuales' }).click();
  await expect(page.getByRole('heading', { name: 'Tus coincidencias' })).toBeFocused();
  const pp = page.locator('.result-card').filter({ has: page.getByRole('heading', { name: 'Partido Popular', exact: true }) });
  await expect(pp.locator('.score')).toHaveText(/0\s*%\s*·\s*0 de 1/);
  await pp.locator('details.is-disagreement > summary').click();
  await expect(pp.getByText(/límite legal al precio del alquiler/)).toBeVisible();
  const evidence = pp.locator('.evidence-source a').first();
  await expect(evidence).toHaveAttribute('href', /^https:\/\//);
  await expect(evidence).toHaveAttribute('target', '_blank');
  await expect(evidence).toHaveAttribute('rel', 'noopener noreferrer');
  const destination = new URL(await evidence.getAttribute('href'));
  await context.route(url => url.origin === destination.origin, route =>
    route.fulfill({ contentType: 'text/plain', body: 'Fuente de prueba' }));
  const [source] = await Promise.all([context.waitForEvent('page'), evidence.click()]);
  await expect(source).toHaveURL(destination.href);
  await expect(source.getByText('Fuente de prueba')).toBeVisible();
});

test('la fracción refleja coincidencias comparables y no aparece sin puntuación', async ({ page }) => {
  await startMadrid(page);
  await answerAndNext(page, 'A favor');
  await answerAndNext(page, 'Sin opinión / prefiero pasar');
  await answerAndNext(page, 'A favor');
  await answerAndNext(page, 'A favor');
  await page.getByLabel('En contra', { exact: true }).check();
  await page.getByRole('button', { name: 'Ver resultados con mis respuestas actuales' }).click();
  await page.getByLabel('Orden').selectOption('alphabet');
  const psoe = page.locator('.result-card').filter({ has: page.getByRole('heading', { name: 'PSOE', exact: true }) });
  await expect(psoe.locator('.score')).toHaveText(/75\s*%\s*·\s*3 de 4/);
  const unscored = page.locator('.score.small');
  expect(await unscored.count()).toBeGreaterThan(0);
  for (const score of await unscored.all()) await expect(score).toHaveText('Sin puntuación');
});

test('búsqueda nacional por alias y alcance por distrito, sin perder enlaces ni foco', async ({ page }) => {
  await page.goto('/');
  const catalogue = page.locator('#catalogue');
  const disclosure = catalogue.locator('details');
  const summary = disclosure.locator('summary');
  const total = await summary.textContent();
  await summary.click();
  const search = page.getByRole('searchbox', { name: 'Buscar candidaturas' });
  await search.fill('pSc');
  await expect(search).toBeFocused();
  await expect(disclosure).toHaveAttribute('open', '');
  await expect(summary).toHaveText(total);
  await expect(catalogue.locator('.catalogue-list li')).toHaveCount(1);
  await expect(catalogue.locator('.catalogue-list li')).toContainText('PSOE');
  await expect(catalogue.locator('.catalogue-list li a').first()).toHaveAttribute('href', /^https:\/\//);
  await expect(catalogue.getByRole('link', { name: 'BOE del 3 de noviembre' })).toHaveAttribute('href', /^https:\/\//);
  await page.getByLabel('Circunscripción').selectOption('madrid');
  await expect(search).toHaveValue('pSc');
  await expect(catalogue.getByRole('status')).toContainText('Sin resultados');
  await expect(catalogue.locator('.catalogue-list li')).toHaveCount(0);
  await catalogue.getByRole('button', { name: 'Limpiar búsqueda' }).click();
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('');
  expect(await catalogue.locator('.catalogue-list li').count()).toBeGreaterThan(1);
  await search.fill('socialista obrero espanol');
  await expect(catalogue.locator('.catalogue-list li')).toHaveCount(1);
  await expect(catalogue.locator('.catalogue-list li')).toContainText('PSOE');
  await search.fill('zzzz-no-existe');
  await expect(catalogue.getByRole('status')).toContainText('Sin resultados');
  await catalogue.getByRole('button', { name: 'Limpiar búsqueda' }).click();
  await expect(catalogue.getByRole('status')).not.toContainText('Sin resultados');
});
