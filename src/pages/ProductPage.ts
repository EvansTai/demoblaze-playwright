import { Locator, Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class ProductPage extends BasePage {
  readonly name: Locator;
  readonly price: Locator;
  readonly description: Locator;
  readonly addToCartButton: Locator;

  constructor(page: Page) {
    super(page);
    this.name = page.locator('#tbodyid .name');
    this.price = page.locator('#tbodyid .price-container');
    this.description = page.locator('#more-information');
    this.addToCartButton = page.getByRole('link', { name: 'Add to cart' });
  }

  async open(productId: number): Promise<void> {
    await this.page.goto(`/prod.html?idp_=${productId}`);
    await expect(this.name).not.toBeEmpty();
  }

  /** Extracts the numeric price from text such as "$360 *includes tax". */
  async getPrice(): Promise<number> {
    await expect(this.price).toContainText('$');
    const text = await this.price.innerText();
    return Number(text.match(/\$(\d+)/)?.[1]);
  }

  /** Adds the product to the cart and returns the alert message, including any trailing period. */
  async addToCart(): Promise<string> {
    await expect(this.name).not.toBeEmpty();
    return this.acceptAlert(() => this.addToCartButton.click());
  }
}
