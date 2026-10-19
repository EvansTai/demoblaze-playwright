import { Page } from '@playwright/test';

/**
 * Registers a handler before running `action`, accepts the next browser alert,
 * and returns its message. DemoBlaze uses window.alert() for validation and feedback.
 *
 * Accept the alert inside the handler: if an onclick handler opens it synchronously,
 * click() cannot finish until the alert closes.
 */
export async function acceptNextDialog(page: Page, action: () => Promise<unknown>, timeout = 15_000): Promise<string> {
  let onDialog!: (d: import('@playwright/test').Dialog) => Promise<void>;
  const message = new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      page.off('dialog', onDialog);
      reject(new Error(`No alert appeared within ${timeout}ms`));
    }, timeout);
    onDialog = async (dialog) => {
      clearTimeout(timer);
      const text = dialog.message();
      await dialog.accept().catch(() => undefined);
      resolve(text);
    };
    page.once('dialog', onDialog);
  });
  await action();
  return message;
}

/**
 * Accepts browser alerts and records their messages in the returned array as they arrive.
 * Use this when a page may show multiple alerts or when checking that no alert appears.
 */
export function collectDialogs(page: Page): string[] {
  const messages: string[] = [];
  page.on('dialog', async (dialog) => {
    messages.push(dialog.message());
    await dialog.accept().catch(() => undefined);
  });
  return messages;
}
