import { Locator, Page, expect } from '@playwright/test';
import { acceptNextDialog } from '../utils/dialog';

const SHOWN = /display:\s*block/;
const HIDDEN = /display:\s*none/;

/** Shared navigation and helpers for DemoBlaze pages. */
export abstract class BasePage {
  readonly navToggler: Locator;
  readonly navCollapse: Locator;
  readonly homeLink: Locator;
  readonly cartLink: Locator;
  readonly loginLink: Locator;
  readonly logoutLink: Locator;
  readonly signupLink: Locator;
  readonly welcomeUser: Locator;

  constructor(readonly page: Page) {
    this.navToggler = page.locator('.navbar-toggler');
    this.navCollapse = page.locator('#navbarExample');
    this.homeLink = page.locator('#navbarExample a.nav-link', { hasText: 'Home' });
    this.cartLink = page.locator('#cartur');
    this.loginLink = page.locator('#login2');
    this.logoutLink = page.locator('#logout2');
    this.signupLink = page.locator('#signin2');
    this.welcomeUser = page.locator('#nameofuser');
  }

  /** Expands the navigation menu if it is collapsed on a mobile viewport. */
  async openNavIfCollapsed(): Promise<void> {
    if (await this.navToggler.isVisible()) {
      if (!(await this.navCollapse.evaluate((el) => el.classList.contains('show')))) {
        await this.navToggler.click();
        await expect(this.navCollapse).toHaveClass(/show/);
      }
    }
  }

  async clickNav(link: Locator): Promise<void> {
    await this.openNavIfCollapsed();
    await link.click();
  }

  async goToCart(): Promise<void> {
    await this.clickNav(this.cartLink);
    await this.page.waitForURL(/cart\.html/);
  }

  async logout(): Promise<void> {
    await this.clickNav(this.logoutLink);
    await this.expectLoggedOut();
  }

  /*
   * Check the inline `display` styles that DemoBlaze updates with jQuery show/hide.
   * These styles reflect login state even when the mobile navigation menu is collapsed.
   */
  async expectLoggedInAs(username: string): Promise<void> {
    await expect(this.welcomeUser).toHaveText(`Welcome ${username}`);
    await expect(this.logoutLink).toHaveAttribute('style', SHOWN);
    await expect(this.loginLink).toHaveAttribute('style', HIDDEN);
    await expect(this.signupLink).toHaveAttribute('style', HIDDEN);
  }

  async expectLoggedOut(): Promise<void> {
    await expect(this.loginLink).toHaveAttribute('style', SHOWN);
    await expect(this.signupLink).toHaveAttribute('style', SHOWN);
    await expect(this.logoutLink).toHaveAttribute('style', HIDDEN);
    await expect(this.welcomeUser).toHaveAttribute('style', HIDDEN);
  }

  /** Runs an action, accepts the resulting browser alert, and returns its message. */
  acceptAlert(action: () => Promise<unknown>): Promise<string> {
    return acceptNextDialog(this.page, action);
  }
}
