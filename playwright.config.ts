import { defineConfig, devices } from '@playwright/test';
import { env } from './config/env';

const UI_TESTS = /(ui|e2e)\/.*\.spec\.ts/;

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: env.isCI,
  retries: env.isCI ? 2 : 1,
  workers: env.workers,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  use: {
    baseURL: env.baseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'api', testMatch: /api\/.*\.spec\.ts/ },
    { name: 'chromium', testMatch: UI_TESTS, use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', testMatch: UI_TESTS, use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', testMatch: UI_TESTS, use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', testMatch: /e2e\/.*\.spec\.ts/, grep: /@smoke/, use: { ...devices['Pixel 7'] } },
    { name: 'mobile-safari', testMatch: /e2e\/.*\.spec\.ts/, grep: /@smoke/, use: { ...devices['iPhone 13'] } },
    { name: 'perf', testMatch: /perf\/.*\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
  ],
});
