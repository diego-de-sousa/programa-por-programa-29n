import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default defineConfig({
  testDir: './e2e',
  outputDir: join(tmpdir(), '29n-playwright-results'),
  use: { baseURL: 'http://127.0.0.1:43719', browserName: 'firefox' },
  webServer: {
    command: 'pnpm exec astro preview --ignore-lock --host 127.0.0.1 --port 43719',
    url: 'http://127.0.0.1:43719',
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe'
  }
});
