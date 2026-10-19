import { Locator, Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class SignupModal extends BasePage {
  readonly modal: Locator;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);
    this.modal = page.locator('#signInModal');
    this.usernameInput = page.locator('#sign-username');
    this.passwordInput = page.locator('#sign-password');
    this.submitButton = this.modal.getByRole('button', { name: 'Sign up' });
  }

  async open(): Promise<void> {
    await this.clickNav(this.signupLink);
    await expect(this.modal).toBeVisible();
    await expect(this.usernameInput).toBeEditable();
  }

  /** Creates an account through the UI and returns the alert message. */
  async signup(username: string, password: string): Promise<string> {
    await this.open();
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    return this.acceptAlert(() => this.submitButton.click());
  }
}
