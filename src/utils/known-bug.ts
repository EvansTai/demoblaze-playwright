import { test } from '@playwright/test';

/**
 * Marks the current test as an expected failure for a confirmed product bug.
 * A failure is treated as expected while this marker is present. If the test passes,
 * Playwright reports an unexpected pass; review the fix and remove the marker.
 */
export function knownBug(description: string): void {
  test.info().annotations.push({ type: 'known-bug', description });
  test.fail(true, description);
}
