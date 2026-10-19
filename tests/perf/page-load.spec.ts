import { test, expect } from '@playwright/test';
import { env } from '../../config/env';

/**
 * Checks page load times against a budget using the browser Navigation Timing API.
 * This catches large timing regressions. Use a load-testing tool to measure behavior under traffic.
 */
const pages = [
  { name: 'Home', path: '/' },
  { name: 'Product detail', path: '/prod.html?idp_=1' },
  { name: 'Cart', path: '/cart.html' },
];

for (const p of pages) {
  test(`${p.name} page loads within budget`, { tag: '@perf' }, async ({ page }, testInfo) => {
    await page.goto(p.path, { waitUntil: 'load' });
    const timing = await page.evaluate(() => {
      const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      return {
        ttfb: Math.round(nav.responseStart - nav.requestStart),
        domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
        load: Math.round(nav.loadEventEnd),
      };
    });
    await testInfo.attach('timing.json', { body: JSON.stringify(timing, null, 2), contentType: 'application/json' });
    console.log(`[perf] ${p.name}:`, timing);
    expect(timing.load, `load time ${timing.load}ms > budget ${env.perfMaxLoadMs}ms`).toBeLessThan(env.perfMaxLoadMs);
  });
}
