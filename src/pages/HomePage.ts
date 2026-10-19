import { Locator, Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export type Category = 'Phones' | 'Laptops' | 'Monitors';

export class HomePage extends BasePage {
  readonly productCards: Locator;

  constructor(page: Page) {
    super(page);
    this.productCards = page.locator('#tbodyid .card');
  }

  async open(): Promise<void> {
    await this.page.goto('/');
    await expect(this.productCards.first()).toBeVisible();
  }

  async filterByCategory(category: Category): Promise<void> {
    await this.page.locator('#itemc', { hasText: category }).click();
    // The product list updates asynchronously. Callers still need to wait for their target product.
    await expect(this.productCards.first()).toBeVisible();
  }

  async openProduct(name: string): Promise<void> {
    await this.page.locator('#tbodyid .card-title a', { hasText: name }).first().click();
    await this.page.waitForURL(/prod\.html\?idp_=/);
  }
}
