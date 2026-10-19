/**
 * Automated tests for the "Shopping Cart" sheet in DemoBlaze_TestCases_EN.xlsx.
 * Test titles keep the sheet’s case IDs (Case_xx) for traceability.
 * knownBug() marks tests for confirmed product bugs as expected failures.
 */
import { test, expect, authenticate, setAuthCookie } from '../../src/fixtures/test-fixtures';
import { DemoblazeApi } from '../../src/api/DemoblazeApi';
import { CartPage } from '../../src/pages/CartPage';
import { LoginModal } from '../../src/pages/LoginModal';
import { PlaceOrderModal } from '../../src/pages/PlaceOrderModal';
import { TestUser } from '../../src/utils/data';
import { acceptNextDialog, collectDialogs } from '../../src/utils/dialog';
import { knownBug } from '../../src/utils/known-bug';
import { MSG } from '../../test-data/messages';
import products from '../../test-data/products.json';
import order from '../../test-data/order.json';

const S6 = products.samsungS6; // Samsung Galaxy S6: product ID 1, priced at $360.
const NOKIA_ID = 2;
const NO_CONFIRMATION_TIMEOUT = 5_000;

/** Adds products to the user’s cart through the API and returns the session token. */
async function seedCart(api: DemoblazeApi, user: TestUser, productIds: number[]): Promise<string> {
  const token = await api.getToken(user.username, user.password);
  for (const id of productIds) expect((await api.addToCart(token, id)).ok()).toBeTruthy();
  return token;
}

/** Waits for the expected cart items, then opens the Place Order modal. */
async function openPlaceOrder(cartPage: CartPage, modal: PlaceOrderModal, items: number): Promise<void> {
  await cartPage.open();
  await cartPage.expectItemCount(items);
  await cartPage.openPlaceOrder();
  await modal.expectOpen();
}

test.describe('Shopping Cart', { tag: '@cart' }, () => {
  // Critical-priority cases.
  test('Case_01: Guest adds a product to cart successfully', { tag: ['@smoke', '@regression'] }, async ({ productPage, cartPage }) => {
    await productPage.open(S6.id);
    expect(await productPage.addToCart()).toBe('Product added');
    await cartPage.open();
    await cartPage.expectItemCount(1);
    const row = cartPage.row(S6.name);
    await expect(row.locator('td:nth-child(3)')).toHaveText(String(S6.price));
    await expect(row.locator('img')).toBeVisible();
    await expect(row.getByRole('link', { name: 'Delete' })).toBeVisible();
    await cartPage.expectTotal(S6.price);
  });

  test('Case_02: Logged-in user adds a product to cart successfully', { tag: ['@smoke', '@regression'] }, async ({ loggedInPage, productPage, cartPage }) => {
    void loggedInPage;
    await productPage.open(S6.id);
    expect(await productPage.addToCart()).toBe('Product added.');
    await cartPage.open();
    await cartPage.expectItemCount(1);
    await expect(cartPage.row(S6.name)).toContainText(String(S6.price));
    await cartPage.expectTotal(S6.price);
  });

  test('Case_03: Cart total equals the sum of all item prices', { tag: ['@smoke', '@regression'] }, async ({ loggedInPage, api, productPage, cartPage }) => {
    void loggedInPage;
    const nokia = await api.getProduct(NOKIA_ID);
    await productPage.open(S6.id);
    await productPage.addToCart();
    await productPage.open(NOKIA_ID);
    await productPage.addToCart();
    await cartPage.open();
    await cartPage.expectItemCount(2);
    expect((await cartPage.getTitles()).sort()).toEqual([S6.name, nokia.title].sort());
    await cartPage.expectTotal(S6.price + nokia.price);
  });

  test('Case_04: Delete an item from the cart', { tag: ['@smoke', '@regression'] }, async ({ loggedInPage, api, user, cartPage }) => {
    void loggedInPage;
    const nokia = await api.getProduct(NOKIA_ID);
    await seedCart(api, user, [S6.id, NOKIA_ID]);
    await cartPage.open();
    await cartPage.expectItemCount(2);
    await cartPage.deleteItem(S6.name);
    await expect(cartPage.row(S6.name)).toHaveCount(0);
    await cartPage.expectTotal(nokia.price);
  });

  test('Case_05: Place an order successfully with valid data', { tag: ['@smoke', '@regression'] }, async ({ loggedInPage, api, user, cartPage, placeOrderModal }) => {
    void loggedInPage;
    await seedCart(api, user, [S6.id]);
    await openPlaceOrder(cartPage, placeOrderModal, 1);
    await placeOrderModal.fill(order.valid);
    const c = await placeOrderModal.purchase();
    await expect(placeOrderModal.confirmationTitle).toHaveText(MSG.purchaseTitle);
    expect(c.id).toMatch(/^\d+$/);
    expect(c.amount).toBe(S6.price);
    expect(c.cardNumber).toBe(order.valid.card);
    expect(c.name).toBe(order.valid.name);
    expect(c.date).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
    await placeOrderModal.confirmAndClose();
  });

  test('Case_06: Cannot place an order when Name and Credit card are empty', { tag: ['@smoke', '@regression'] }, async ({ loggedInPage, api, user, cartPage, placeOrderModal }) => {
    void loggedInPage;
    await seedCart(api, user, [S6.id]);
    await openPlaceOrder(cartPage, placeOrderModal, 1);
    expect(await placeOrderModal.purchaseExpectingAlert()).toBe(MSG.fillNameCard);
    await expect(placeOrderModal.confirmation).toBeHidden();
    await cartPage.open();
    await cartPage.expectItemCount(1);
  });

  // High-priority cases.
  test('Case_07: Verify product detail page content', { tag: '@regression' }, async ({ productPage }) => {
    await productPage.open(S6.id);
    await expect(productPage.name).toHaveText(S6.name);
    await expect(productPage.price).toContainText(`$${S6.price}`);
    await expect(productPage.price).toContainText('includes tax');
    await expect(productPage.description).not.toBeEmpty();
    await expect(productPage.page.locator('#imgp img').first()).toBeVisible();
    await expect(productPage.addToCartButton).toBeVisible();
  });

  test('Case_08: Cart is emptied after a successful order', { tag: '@regression' }, async ({ loggedInPage, api, user, cartPage, placeOrderModal }) => {
    void loggedInPage;
    const token = await seedCart(api, user, [S6.id]);
    await openPlaceOrder(cartPage, placeOrderModal, 1);
    await placeOrderModal.fill(order.valid);
    await placeOrderModal.purchase();
    await placeOrderModal.confirmAndClose();
    await expect.poll(async () => (await api.getCartItems(token)).length).toBe(0);
    await cartPage.open();
    await cartPage.expectItemCount(0);
  });

  test('Case_09: Guest can place an order and the guest cart is emptied', { tag: '@regression' }, async ({ productPage, cartPage, placeOrderModal }) => {
    await productPage.open(S6.id);
    await productPage.addToCart();
    await openPlaceOrder(cartPage, placeOrderModal, 1);
    await placeOrderModal.fill(order.valid);
    expect((await placeOrderModal.purchase()).amount).toBe(S6.price);
    await placeOrderModal.confirmAndClose();
    await expect(async () => {
      await cartPage.open();
      await cartPage.expectItemCount(0);
    }).toPass({ timeout: 20_000 });
  });

  test('Case_10: Place Order modal shows correct total and fields', { tag: '@regression' }, async ({ loggedInPage, api, user, cartPage, placeOrderModal }) => {
    void loggedInPage;
    const nokia = await api.getProduct(NOKIA_ID);
    await seedCart(api, user, [S6.id, NOKIA_ID]);
    await openPlaceOrder(cartPage, placeOrderModal, 2);
    await expect(placeOrderModal.modal.locator('.modal-title')).toHaveText('Place order');
    await expect(placeOrderModal.totalLabel).toHaveText(`Total: ${S6.price + nokia.price}`);
    for (const id of ['name', 'country', 'city', 'card', 'month', 'year']) {
      await expect(placeOrderModal.modal.locator(`#${id}`)).toBeVisible();
    }
    await expect(placeOrderModal.closeButton).toBeVisible();
    await expect(placeOrderModal.purchaseButton).toBeVisible();
  });

  const requiredCases = [
    { id: 'Case_11', title: 'Cannot place an order when only Name is empty', data: { ...order.valid, name: '' } },
    { id: 'Case_12', title: 'Cannot place an order when only Credit card is empty', data: { ...order.valid, card: '' } },
  ];
  for (const c of requiredCases) {
    test(`${c.id}: ${c.title}`, { tag: '@regression' }, async ({ loggedInPage, api, user, cartPage, placeOrderModal }) => {
      void loggedInPage;
      await seedCart(api, user, [S6.id]);
      await openPlaceOrder(cartPage, placeOrderModal, 1);
      await placeOrderModal.fill(c.data);
      expect(await placeOrderModal.purchaseExpectingAlert()).toBe(MSG.fillNameCard);
      await expect(placeOrderModal.confirmation).toBeHidden();
    });
  }

  test('Case_13: Cannot place an order with an empty cart', { tag: '@regression' }, async ({ loggedInPage, cartPage, placeOrderModal }) => {
    knownBug('Place Order is allowed with an empty cart (confirmation with Amount 0)');
    void loggedInPage;
    await openPlaceOrder(cartPage, placeOrderModal, 0);
    await placeOrderModal.fill(order.valid);
    await placeOrderModal.purchaseButton.click();
    await expect(placeOrderModal.confirmation).toBeHidden({ timeout: NO_CONFIRMATION_TIMEOUT });
  });

  test('Case_14: Adding the same product twice is reflected correctly', { tag: '@regression' }, async ({ loggedInPage, productPage, cartPage }) => {
    void loggedInPage;
    await productPage.open(S6.id);
    await productPage.addToCart();
    await productPage.addToCart();
    await cartPage.open();
    await cartPage.expectItemCount(2);
    await cartPage.expectTotal(S6.price * 2);
  });

  test('Case_15: Add products from different categories', { tag: '@regression' }, async ({ loggedInPage, homePage, productPage, cartPage }) => {
    void loggedInPage;
    const picks = [products.samsungS6, products.sonyVaioI5, products.appleMonitor];
    let expectedTotal = 0;
    for (const p of picks) {
      await homePage.open();
      await homePage.filterByCategory(p.category as 'Phones' | 'Laptops' | 'Monitors');
      await homePage.openProduct(p.name);
      expectedTotal += await productPage.getPrice();
      await productPage.addToCart();
    }
    await cartPage.open();
    await cartPage.expectItemCount(picks.length);
    expect((await cartPage.getTitles()).sort()).toEqual(picks.map((p) => p.name).sort());
    await cartPage.expectTotal(expectedTotal);
  });

  test("Case_16: Logged-in user's cart is kept after logout and login again", { tag: '@regression' }, async ({ loggedInPage, api, user, cartPage, loginModal }) => {
    void loggedInPage;
    await seedCart(api, user, [S6.id]);
    await cartPage.open();
    await cartPage.expectItemCount(1);
    await cartPage.logout();
    await loginModal.login(user.username, user.password);
    await cartPage.open();
    await cartPage.expectItemCount(1);
    await cartPage.expectTotal(S6.price);
  });

  test('Case_17: Guest cart is kept after reloading the page', { tag: '@regression' }, async ({ page, productPage, cartPage }) => {
    await productPage.open(S6.id);
    await productPage.addToCart();
    await cartPage.open();
    await cartPage.expectItemCount(1);
    await page.reload();
    await cartPage.expectItemCount(1);
    await cartPage.expectTotal(S6.price);
  });

  test('Case_18: Cart of one user is not visible to another user or a guest', { tag: ['@regression', '@security'] }, async ({ page, api, user, userB, cartPage }) => {
    const tokenA = await seedCart(api, user, [S6.id]);
    expect(await api.getCartItems(tokenA)).toHaveLength(1);

    await cartPage.open(); // Open the cart as a guest.
    await cartPage.expectItemCount(0);

    await authenticate(page.context(), api, userB);
    await cartPage.open();
    await cartPage.expectLoggedInAs(userB.username);
    await cartPage.expectItemCount(0);
  });

  test('Case_19: Purchase is not confirmed when the network is offline', { tag: '@regression' }, async ({ page, loggedInPage, api, user, cartPage, placeOrderModal }) => {
    knownBug('Purchase confirmation is shown without any server call, even when offline');
    void loggedInPage;
    await seedCart(api, user, [S6.id]);
    await openPlaceOrder(cartPage, placeOrderModal, 1);
    await placeOrderModal.fill(order.valid);
    await page.context().setOffline(true);
    await placeOrderModal.purchaseButton.click();
    await expect(placeOrderModal.confirmation).toBeHidden({ timeout: NO_CONFIRMATION_TIMEOUT });
  });

  // Medium-priority cases.
  test('Case_20: Deleting the last item leaves an empty cart with total 0', { tag: '@regression' }, async ({ loggedInPage, api, user, cartPage }) => {
    knownBug('Total is blank instead of 0 when the cart becomes empty');
    void loggedInPage;
    await seedCart(api, user, [S6.id]);
    await cartPage.open();
    await cartPage.deleteItem(S6.name);
    await cartPage.expectItemCount(0);
    await expect(cartPage.total).toHaveText('0', { timeout: NO_CONFIRMATION_TIMEOUT });
  });

  test('Case_21: Guest cart items are handled when guest logs in', { tag: '@regression' }, async ({ productPage, cartPage, loginModal, user }) => {
    knownBug('Guest cart items are silently lost after logging in (no merge)');
    await productPage.open(S6.id);
    await productPage.addToCart();
    await loginModal.login(user.username, user.password);
    await cartPage.open();
    await expect(cartPage.rows).toHaveCount(1, { timeout: NO_CONFIRMATION_TIMEOUT });
  });

  const invalidFieldCases = [
    { id: 'Case_22', title: 'Credit card field rejects non-numeric values', data: { ...order.valid, card: 'abcd-efgh' }, bug: 'No format validation on Credit card' },
    { id: 'Case_23', title: 'Month field rejects invalid values', data: { ...order.valid, month: '13' }, bug: 'No validation on Month (accepts 13)' },
    { id: 'Case_24', title: 'Year field rejects invalid or expired values', data: { ...order.valid, year: '2000' }, bug: 'No validation on Year (accepts expired year)' },
  ];
  for (const c of invalidFieldCases) {
    test(`${c.id}: ${c.title}`, { tag: '@regression' }, async ({ loggedInPage, api, user, cartPage, placeOrderModal }) => {
      knownBug(c.bug);
      void loggedInPage;
      await seedCart(api, user, [S6.id]);
      await openPlaceOrder(cartPage, placeOrderModal, 1);
      await placeOrderModal.fill(c.data);
      await placeOrderModal.purchaseButton.click();
      await expect(placeOrderModal.confirmation).toBeHidden({ timeout: NO_CONFIRMATION_TIMEOUT });
    });
  }

  test('Case_25: Name and Credit card containing only spaces are treated as empty', { tag: '@regression' }, async ({ page, loggedInPage, api, user, cartPage, placeOrderModal }) => {
    knownBug('Spaces-only Name / Credit card pass the required-field check');
    void loggedInPage;
    await seedCart(api, user, [S6.id]);
    await openPlaceOrder(cartPage, placeOrderModal, 1);
    await placeOrderModal.fill({ name: '   ', card: '   ' });
    const msg = acceptNextDialog(page, () => placeOrderModal.purchaseButton.click(), NO_CONFIRMATION_TIMEOUT);
    await expect(msg).resolves.toBe(MSG.fillNameCard);
  });

  test('Case_26: Confirmation popup shows the correct date', { tag: '@regression' }, async ({ loggedInPage, api, user, cartPage, placeOrderModal }) => {
    knownBug('Date uses getMonth() (0-based) so the month is off by one');
    void loggedInPage;
    await seedCart(api, user, [S6.id]);
    await openPlaceOrder(cartPage, placeOrderModal, 1);
    await placeOrderModal.fill(order.valid);
    const c = await placeOrderModal.purchase();
    const now = new Date();
    expect(c.date).toBe(`${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`);
  });

  test('Case_27: Confirmation Amount matches the cart total', { tag: '@regression' }, async ({ loggedInPage, api, user, cartPage, placeOrderModal }) => {
    void loggedInPage;
    await seedCart(api, user, [S6.id, NOKIA_ID]);
    await cartPage.open();
    await cartPage.expectItemCount(2);
    const cartTotal = Number(await cartPage.total.innerText());
    await cartPage.openPlaceOrder();
    await placeOrderModal.expectOpen();
    await placeOrderModal.fill(order.valid);
    expect((await placeOrderModal.purchase()).amount).toBe(cartTotal);
  });

  test('Case_28: Close the Place Order modal without purchasing', { tag: '@regression' }, async ({ loggedInPage, api, user, cartPage, placeOrderModal }) => {
    void loggedInPage;
    const token = await seedCart(api, user, [S6.id]);
    await openPlaceOrder(cartPage, placeOrderModal, 1);
    await placeOrderModal.fill(order.valid);
    await placeOrderModal.closeButton.click();
    await expect(placeOrderModal.modal).toBeHidden();

    await cartPage.openPlaceOrder();
    await placeOrderModal.expectOpen();
    await placeOrderModal.modal.locator('button.close').click();
    await expect(placeOrderModal.modal).toBeHidden();

    await expect(placeOrderModal.confirmation).toBeHidden();
    expect(await api.getCartItems(token)).toHaveLength(1);
  });

  test('Case_29: Clicking "Purchase" repeatedly creates only one order', { tag: '@regression' }, async ({ loggedInPage, api, user, cartPage, placeOrderModal }) => {
    void loggedInPage;
    await seedCart(api, user, [S6.id]);
    await openPlaceOrder(cartPage, placeOrderModal, 1);
    await placeOrderModal.fill(order.valid);
    await placeOrderModal.purchaseButton.dblclick();
    await expect(placeOrderModal.confirmation).toBeVisible();
    await expect(placeOrderModal.page.locator('.sweet-alert')).toHaveCount(1);
    expect((await placeOrderModal.confirmationText.innerText()).match(/Id:/g)).toHaveLength(1);
  });

  test('Case_30: Clicking "Add to cart" quickly several times adds the correct number of items', { tag: '@regression' }, async ({ page, loggedInPage, productPage, cartPage }) => {
    void loggedInPage;
    const dialogs = collectDialogs(page);
    await productPage.open(S6.id);
    for (let i = 0; i < 3; i++) await productPage.addToCartButton.click();
    await expect.poll(() => dialogs.length).toBe(3);
    expect(dialogs.every((m) => MSG.productAdded.test(m))).toBeTruthy();
    await cartPage.open();
    await cartPage.expectItemCount(3);
    await cartPage.expectTotal(S6.price * 3);
  });

  test('Case_31: Add to cart with a malformed auth token is rejected', { tag: ['@regression', '@security'] }, async ({ page, productPage }) => {
    await setAuthCookie(page.context(), 'abc123');
    const dialogs = collectDialogs(page); // Also capture the alert shown on page load for the invalid token.
    await productPage.open(S6.id);
    const before = dialogs.length;
    await productPage.addToCartButton.click();
    await expect.poll(() => dialogs.length).toBeGreaterThan(before);
    expect(dialogs.slice(before)).toContain(MSG.tokenMalformed);
    expect(dialogs.some((m) => MSG.productAdded.test(m))).toBeFalsy();
  });

  test('Case_32: Opening a non-existent product id is handled', { tag: '@regression' }, async ({ page }) => {
    knownBug('No "product not found" handling for an invalid product id');
    await page.goto('/prod.html?idp_=99999');
    await expect(page.getByText(/not found|does not exist|no product/i)).toBeVisible({ timeout: NO_CONFIRMATION_TIMEOUT });
  });

  test('Case_33: viewcart API returns items consistent with the UI', { tag: ['@regression', '@api'] }, async ({ loggedInPage, api, user, productPage, cartPage }) => {
    void loggedInPage;
    await productPage.open(S6.id);
    await productPage.addToCart();
    await productPage.open(NOKIA_ID);
    await productPage.addToCart();
    await cartPage.open();
    await cartPage.expectItemCount(2);
    const token = await api.getToken(user.username, user.password);
    const res = await api.viewCart(token);
    expect(res.status()).toBe(200);
    const items = (await res.json()).Items as { prod_id: number }[];
    expect(items.map((i) => i.prod_id).sort()).toEqual([S6.id, NOKIA_ID]);
  });

  test('Case_34: Add to cart and Place order work on all supported browsers', { tag: ['@regression', '@cross-browser'] }, async ({ loggedInPage, productPage, cartPage, placeOrderModal }) => {
    // Runs on Chromium, Firefox, and WebKit through the projects in playwright.config.ts.
    void loggedInPage;
    await productPage.open(S6.id);
    await productPage.addToCart();
    await openPlaceOrder(cartPage, placeOrderModal, 1);
    await placeOrderModal.fill(order.valid);
    expect((await placeOrderModal.purchase()).amount).toBe(S6.price);
  });

  test('Case_35: Order amount reflects cart changes made in another tab', { tag: '@regression' }, async ({ page, loggedInPage, api, user, cartPage, placeOrderModal }) => {
    knownBug('Order total is calculated once on page load; changes from another tab are ignored');
    void loggedInPage;
    const nokia = await api.getProduct(NOKIA_ID);
    await seedCart(api, user, [S6.id]);
    await cartPage.open();
    await cartPage.expectItemCount(1);

    const tab2 = await page.context().newPage(); // Use a second tab to add another product.
    await tab2.goto(`/prod.html?idp_=${NOKIA_ID}`);
    await acceptNextDialog(tab2, () => tab2.getByRole('link', { name: 'Add to cart' }).click());

    await cartPage.openPlaceOrder(); // Open checkout in the first tab without reloading it.
    await placeOrderModal.expectOpen();
    await placeOrderModal.fill(order.valid);
    expect((await placeOrderModal.purchase()).amount).toBe(S6.price + nokia.price);
  });

  test('Case_36: Purchase after logging out in another tab', { tag: ['@regression', '@security'] }, async ({ page, loggedInPage, api, user, cartPage, placeOrderModal }) => {
    knownBug('Order is confirmed even though the session was ended in another tab');
    void loggedInPage;
    await seedCart(api, user, [S6.id]);
    await cartPage.open();
    await cartPage.expectItemCount(1);

    const tab2 = await page.context().newPage();
    await tab2.goto('/');
    await new LoginModal(tab2).logout();

    await cartPage.openPlaceOrder();
    await placeOrderModal.expectOpen();
    await placeOrderModal.fill(order.valid);
    await placeOrderModal.purchaseButton.click();
    await expect(placeOrderModal.confirmation).toBeHidden({ timeout: NO_CONFIRMATION_TIMEOUT });
  });

  test('Case_37: Browser Back after a successful purchase does not re-submit the order', { tag: '@regression' }, async ({ page, loggedInPage, api, user, cartPage, placeOrderModal }) => {
    void loggedInPage;
    const token = await seedCart(api, user, [S6.id]);
    await openPlaceOrder(cartPage, placeOrderModal, 1);
    await placeOrderModal.fill(order.valid);
    await placeOrderModal.purchase();
    await placeOrderModal.confirmAndClose();
    await page.goBack();
    await expect(placeOrderModal.confirmation).toBeHidden();
    await expect.poll(async () => (await api.getCartItems(token)).length).toBe(0);
    await cartPage.open();
    await cartPage.expectItemCount(0);
  });

  // Low-priority cases.
  test('Case_38: Success message is consistent for guest and logged-in user', { tag: '@regression' }, async ({ page, api, user, productPage }) => {
    knownBug('Guest sees "Product added", logged-in user sees "Product added."');
    await productPage.open(S6.id);
    const guestMsg = await productPage.addToCart();
    await authenticate(page.context(), api, user);
    await productPage.open(S6.id);
    const userMsg = await productPage.addToCart();
    expect(guestMsg).toBe(userMsg);
  });

  test('Case_39: Credit card number is masked in the confirmation', { tag: ['@regression', '@security'] }, async ({ loggedInPage, api, user, cartPage, placeOrderModal }) => {
    knownBug('Full credit card number is displayed in the confirmation');
    void loggedInPage;
    await seedCart(api, user, [S6.id]);
    await openPlaceOrder(cartPage, placeOrderModal, 1);
    await placeOrderModal.fill(order.valid);
    const c = await placeOrderModal.purchase();
    expect(c.cardNumber).not.toBe(order.valid.card);
    expect(c.cardNumber).toMatch(/\*+\s?1111$/);
  });

  test('Case_40: Credit card length boundaries', { tag: '@regression' }, async ({ loggedInPage, api, user, cartPage, placeOrderModal }) => {
    knownBug('No length validation on Credit card (12 / 20 digits accepted)');
    void loggedInPage;
    await seedCart(api, user, [S6.id]);
    for (const card of ['411111111111', '41111111111111111111']) { // Both 12-digit and 20-digit card numbers should be rejected.
      await openPlaceOrder(cartPage, placeOrderModal, 1);
      await placeOrderModal.fill({ ...order.valid, card });
      await placeOrderModal.purchaseButton.click();
      await expect(placeOrderModal.confirmation, `card with ${card.length} digits`).toBeHidden({ timeout: NO_CONFIRMATION_TIMEOUT });
    }
  });

  test('Case_41: Very long Name (500 characters) is handled', { tag: '@regression' }, async ({ page, loggedInPage, api, user, cartPage, placeOrderModal }) => {
    void loggedInPage;
    await seedCart(api, user, [S6.id]);
    await openPlaceOrder(cartPage, placeOrderModal, 1);
    const longName = 'N'.repeat(500);
    await placeOrderModal.fill({ ...order.valid, name: longName });
    const c = await placeOrderModal.purchase();
    expect(c.name).toBe(longName);
    const box = await placeOrderModal.confirmation.boundingBox();
    expect(box!.x + box!.width, 'popup must stay inside the viewport').toBeLessThanOrEqual(page.viewportSize()!.width);
    await expect(placeOrderModal.confirmationOk).toBeVisible();
  });

  test('Case_42: XSS payload in Name is not executed', { tag: ['@regression', '@security'] }, async ({ page, loggedInPage, api, user, cartPage, placeOrderModal }) => {
    void loggedInPage;
    await seedCart(api, user, [S6.id]);
    await openPlaceOrder(cartPage, placeOrderModal, 1);
    const payload = '<img src=x onerror=alert(1)>';
    await placeOrderModal.fill({ ...order.valid, name: payload });
    const dialogs = collectDialogs(page);
    const c = await placeOrderModal.purchase();
    await page.waitForTimeout(1_000); // Allow time for the injected event handler to run before checking the alerts.
    expect(dialogs, 'no script must run').toEqual([]);
    expect(c.name).toBe(payload); // The payload should appear as plain text.
  });

  test('Case_43: Cart handles a large number of items', { tag: '@regression' }, async ({ loggedInPage, api, user, cartPage }) => {
    test.slow();
    void loggedInPage;
    await seedCart(api, user, Array(20).fill(S6.id));
    await cartPage.open();
    await cartPage.expectItemCount(20);
    await cartPage.expectTotal(S6.price * 20);
  });

  test.describe('Mobile viewport', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('Case_44: Cart page and Place Order modal are usable on mobile', { tag: ['@regression', '@mobile'] }, async ({ page, loggedInPage, api, user, cartPage, placeOrderModal }) => {
      void loggedInPage;
      await seedCart(api, user, [S6.id]);
      await cartPage.open();
      await cartPage.expectItemCount(1);
      await expect(cartPage.row(S6.name).getByRole('link', { name: 'Delete' })).toBeVisible();
      await cartPage.placeOrderButton.scrollIntoViewIfNeeded();
      await expect(cartPage.placeOrderButton).toBeInViewport();
      await cartPage.openPlaceOrder();
      await placeOrderModal.expectOpen();
      for (const id of ['name', 'card']) {
        const box = await placeOrderModal.modal.locator(`#${id}`).boundingBox();
        expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      }
      await placeOrderModal.fill(order.valid);
      expect((await placeOrderModal.purchase()).amount).toBe(S6.price);
    });
  });

  test('Case_45: Deleting an item already deleted in another tab is handled', { tag: '@regression' }, async ({ page, loggedInPage, api, user, cartPage }) => {
    void loggedInPage;
    const pageErrors: string[] = [];
    await seedCart(api, user, [S6.id]);
    await cartPage.open();
    await cartPage.expectItemCount(1);

    const tab2 = await page.context().newPage();
    tab2.on('pageerror', (e) => pageErrors.push(e.message));
    const cart2 = new CartPage(tab2);
    const dialogs = collectDialogs(tab2);
    await cart2.open();
    await cart2.expectItemCount(1);

    await cartPage.deleteItem(S6.name); // Delete the item in the first tab.
    await cart2.deleteItem(S6.name); // Try deleting the same item from the second tab’s stale cart.
    await cart2.expectItemCount(0);
    expect(dialogs).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Case_46: User gets feedback when Add to cart fails due to network loss', { tag: '@regression' }, async ({ page, loggedInPage, api, user, productPage }) => {
    knownBug('No error message when Add to cart fails (request errors are ignored)');
    void loggedInPage;
    await productPage.open(S6.id);
    await page.context().setOffline(true);
    const msg = acceptNextDialog(page, () => productPage.addToCartButton.click(), NO_CONFIRMATION_TIMEOUT);
    await expect(msg).resolves.not.toMatch(MSG.productAdded);
    await page.context().setOffline(false);
    const token = await api.getToken(user.username, user.password);
    expect(await api.getCartItems(token)).toHaveLength(0);
  });
});
