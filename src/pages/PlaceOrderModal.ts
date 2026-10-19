import { Locator, Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export interface OrderData { name?: string; country?: string; city?: string; card?: string; month?: string; year?: string; }

export interface PurchaseConfirmation { id: string; amount: number; cardNumber: string; name: string; date: string; raw: string; }

export class PlaceOrderModal extends BasePage {
  readonly modal: Locator;
  readonly totalLabel: Locator;
  readonly purchaseButton: Locator;
  readonly closeButton: Locator;
  readonly confirmation: Locator;
  readonly confirmationTitle: Locator;
  readonly confirmationText: Locator;
  readonly confirmationOk: Locator;

  constructor(page: Page) {
    super(page);
    this.modal = page.locator('#orderModal');
    this.totalLabel = page.locator('#totalm');
    this.purchaseButton = this.modal.getByRole('button', { name: 'Purchase' });
    this.closeButton = this.modal.getByRole('button', { name: 'Close' });
    this.confirmation = page.locator('.sweet-alert');
    this.confirmationTitle = this.confirmation.locator('h2');
    this.confirmationText = this.confirmation.locator('p.lead');
    this.confirmationOk = this.confirmation.getByRole('button', { name: 'OK' });
  }

  async expectOpen(): Promise<void> {
    await expect(this.modal).toBeVisible();
    await expect(this.page.locator('#name')).toBeEditable();
  }

  async fill(data: OrderData): Promise<void> {
    const fields: (keyof OrderData)[] = ['name', 'country', 'city', 'card', 'month', 'year'];
    for (const f of fields) {
      if (data[f] !== undefined) await this.page.locator(`#${f}`).fill(data[f]!);
    }
  }

  /** Submits the order and returns the details from the SweetAlert confirmation. */
  async purchase(): Promise<PurchaseConfirmation> {
    await this.purchaseButton.click();
    await expect(this.confirmation).toBeVisible();
    const raw = await this.confirmationText.innerText();
    const pick = (label: string) => raw.match(new RegExp(`${label}:\\s*(.*)`))?.[1]?.trim() ?? '';
    return {
      id: pick('Id'),
      amount: Number(pick('Amount').replace(/\D/g, '')),
      cardNumber: pick('Card Number'),
      name: pick('Name'),
      date: pick('Date'),
      raw,
    };
  }

  /** Submits the order and returns the browser alert shown for invalid data. */
  async purchaseExpectingAlert(): Promise<string> {
    return this.acceptAlert(() => this.purchaseButton.click());
  }

  async confirmAndClose(): Promise<void> {
    await this.confirmationOk.click();
    // The redirect to index.html is unreliable, so check only that the confirmation closes.
    await expect(this.confirmation).toBeHidden();
  }
}
