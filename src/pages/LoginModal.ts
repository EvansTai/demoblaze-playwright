import { Locator, Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginModal extends BasePage {
  readonly modal: Locator;
  readonly title: Locator;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly closeButton: Locator;
  readonly closeIcon: Locator;

  constructor(page: Page) {
    super(page);
    this.modal = page.locator('#logInModal');
    this.title = this.modal.locator('.modal-title');
    this.usernameInput = page.locator('#loginusername');
    this.passwordInput = page.locator('#loginpassword');
    this.submitButton = this.modal.getByRole('button', { name: 'Log in' });
    this.closeButton = this.modal.getByRole('button', { name: 'Close' });
    this.closeIcon = this.modal.locator('button.close');
  }

  async open(): Promise<void> {
    await this.clickNav(this.loginLink);
    await expect(this.modal).toBeVisible();
    await expect(this.usernameInput).toBeEditable();
  }

  async fill(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
  }

  /** Logs in through the UI and waits for the navigation to show the signed-in user. */
  async login(username: string, password: string): Promise<void> {
    await this.open();
    await this.fill(username, password);
    await Promise.all([
      this.page.waitForResponse((r) => r.url().includes('/login') && r.request().method() === 'POST'),
      this.submitButton.click(),
    ]);
    await this.expectLoggedInAs(username);
  }

  /** Attempts to log in and returns the validation or error alert message. */
  async loginExpectingAlert(username: string, password: string): Promise<string> {
    await this.open();
    await this.fill(username, password);
    return this.acceptAlert(() => this.submitButton.click());
  }

  async close(): Promise<void> {
    await this.closeButton.click();
    await expect(this.modal).toBeHidden();
  }
}
