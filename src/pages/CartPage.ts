import { Locator, Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class CartPage extends BasePage {
  readonly rows: Locator;
  readonly total: Locator;
  readonly placeOrderButton: Locator;

  constructor(page: Page) {
    super(page);
    this.rows = page.locator('#tbodyid > tr');
    this.total = page.locator('#totalp');
    this.placeOrderButton = page.getByRole('button', { name: 'Place Order' });
  }

  async open(): Promise<void> {
    await Promise.all([
      this.page.waitForResponse((r) => r.url().includes('/viewcart') && r.ok()),
      this.page.goto('/cart.html'),
    ]);
  }

  row(productName: string): Locator {
    return this.rows.filter({ has: this.page.locator('td:nth-child(2)', { hasText: productName }) });
  }

  /** Waits for the cart to finish rendering the expected number of items. */
  async expectItemCount(count: number): Promise<void> {
    await expect(this.rows).toHaveCount(count);
  }

  async expectTotal(amount: number): Promise<void> {
    await expect(this.total).toHaveText(String(amount));
  }

  async getTitles(): Promise<string[]> {
    return this.rows.locator('td:nth-child(2)').allInnerTexts();
  }

  async getPrices(): Promise<number[]> {
    return (await this.rows.locator('td:nth-child(3)').allInnerTexts()).map(Number);
  }

  async deleteItem(productName: string): Promise<void> {
    const before = await this.rows.count();
    await Promise.all([
      this.page.waitForResponse((r) => r.url().includes('/deleteitem') && r.ok()),
      this.row(productName).first().getByRole('link', { name: 'Delete' }).click(),
    ]);
    await expect(this.rows).toHaveCount(before - 1);
  }

  async openPlaceOrder(): Promise<void> {
    await this.placeOrderButton.click();
  }
}
