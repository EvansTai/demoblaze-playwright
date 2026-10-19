/**
 * Automated tests for the "E2E" sheet in DemoBlaze_TestCases_EN.xlsx.
 * Test titles keep the sheet’s case IDs (Case_xx) for traceability.
 * Case_10 is covered by running Case_01 across the desktop and mobile browser projects.
 */
import { test, expect, setAuthCookie } from '../../src/fixtures/test-fixtures';
import { HomePage } from '../../src/pages/HomePage';
import { LoginModal } from '../../src/pages/LoginModal';
import { CartPage } from '../../src/pages/CartPage';
import { PlaceOrderModal } from '../../src/pages/PlaceOrderModal';
import { collectDialogs } from '../../src/utils/dialog';
import { uniqueUsername } from '../../src/utils/data';
import { knownBug } from '../../src/utils/known-bug';
import { MSG } from '../../test-data/messages';
import { env } from '../../config/env';
import products from '../../test-data/products.json';
import order from '../../test-data/order.json';

const S6 = products.samsungS6;
const NOKIA_ID = 2;

test.describe('E2E - Purchase flow', { tag: '@e2e' }, () => {
  test('Case_01 / Case_10: Logged-in user completes a purchase end to end (happy path)', { tag: ['@smoke', '@regression', '@cross-browser'] }, async ({
    homePage, loginModal, productPage, cartPage, placeOrderModal, user, api,
  }) => {
    await test.step('Log in with valid credentials', async () => {
      await homePage.open();
      await loginModal.login(user.username, user.password);
    });

    await test.step('Add product to cart', async () => {
      await homePage.openProduct(S6.name);
      await expect(productPage.name).toHaveText(S6.name);
      expect(await productPage.addToCart()).toMatch(MSG.productAdded);
    });

    await test.step('Verify cart', async () => {
      await cartPage.goToCart();
      await cartPage.expectItemCount(1);
      await expect(cartPage.row(S6.name)).toContainText(String(S6.price));
      await cartPage.expectTotal(S6.price);
    });

    const confirmation = await test.step('Place order', async () => {
      await cartPage.openPlaceOrder();
      await placeOrderModal.expectOpen();
      await expect(placeOrderModal.totalLabel).toHaveText(`Total: ${S6.price}`);
      await placeOrderModal.fill(order.valid);
      return placeOrderModal.purchase();
    });

    await test.step('Verify purchase confirmation', async () => {
      await expect(placeOrderModal.confirmationTitle).toHaveText(MSG.purchaseTitle);
      expect(confirmation.id).toMatch(/^\d+$/);
      expect(confirmation.amount).toBe(S6.price);
      expect(confirmation.name).toBe(order.valid.name);
      expect(confirmation.cardNumber).toBe(order.valid.card);
      await placeOrderModal.confirmAndClose();
    });

    await test.step('Cart is empty after purchase', async () => {
      const token = await api.getToken(user.username, user.password);
      await expect.poll(async () => (await api.getCartItems(token)).length).toBe(0);
      await cartPage.open();
      await cartPage.expectItemCount(0);
    });

    await test.step('Log out', async () => {
      await cartPage.logout();
    });
  });

  test('Case_02: Purchase multiple products after removing one', { tag: ['@smoke', '@regression'] }, async ({
    loggedInPage, homePage, productPage, cartPage, placeOrderModal,
  }) => {
    void loggedInPage;
    const picks = [products.samsungS6, products.sonyVaioI5, products.appleMonitor];
    const prices: Record<string, number> = {};
    for (const p of picks) {
      await homePage.open();
      await homePage.filterByCategory(p.category as 'Phones' | 'Laptops' | 'Monitors');
      await homePage.openProduct(p.name);
      prices[p.name] = await productPage.getPrice();
      await productPage.addToCart();
    }
    await cartPage.open();
    await cartPage.expectItemCount(3);
    await cartPage.expectTotal(Object.values(prices).reduce((a, b) => a + b, 0));

    await cartPage.deleteItem(products.sonyVaioI5.name);
    const expected = prices[products.samsungS6.name] + prices[products.appleMonitor.name];
    await cartPage.expectTotal(expected);

    await cartPage.openPlaceOrder();
    await placeOrderModal.expectOpen();
    await expect(placeOrderModal.totalLabel).toHaveText(`Total: ${expected}`);
    await placeOrderModal.fill(order.valid);
    expect((await placeOrderModal.purchase()).amount).toBe(expected);
  });

  test('Case_03: Recover from missing order fields and complete the purchase', { tag: '@regression' }, async ({
    loggedInPage, productPage, cartPage, placeOrderModal,
  }) => {
    void loggedInPage;
    await productPage.open(S6.id);
    await productPage.addToCart();
    await cartPage.open();
    await cartPage.expectItemCount(1);
    await cartPage.openPlaceOrder();
    await placeOrderModal.expectOpen();

    expect(await placeOrderModal.purchaseExpectingAlert()).toBe(MSG.fillNameCard);
    await placeOrderModal.fill({ name: order.valid.name });
    expect(await placeOrderModal.purchaseExpectingAlert()).toBe(MSG.fillNameCard);
    await placeOrderModal.fill(order.valid);
    expect((await placeOrderModal.purchase()).amount).toBe(S6.price);
  });

  test('Case_04: Guest adds products and completes a purchase without logging in', { tag: '@regression' }, async ({
    api, productPage, cartPage, placeOrderModal,
  }) => {
    const nokia = await api.getProduct(NOKIA_ID);
    await productPage.open(S6.id);
    expect(await productPage.addToCart()).toMatch(MSG.productAdded);
    await productPage.open(NOKIA_ID);
    await productPage.addToCart();
    await cartPage.open();
    await cartPage.expectItemCount(2);
    await cartPage.expectTotal(S6.price + nokia.price);
    await cartPage.expectLoggedOut();

    await cartPage.openPlaceOrder();
    await placeOrderModal.expectOpen();
    await placeOrderModal.fill(order.valid);
    expect((await placeOrderModal.purchase()).amount).toBe(S6.price + nokia.price);
    await placeOrderModal.confirmAndClose();
    await expect(async () => {
      await cartPage.open();
      await cartPage.expectItemCount(0);
    }).toPass({ timeout: 20_000 });
  });

  test('Case_05: New user signs up, logs in and buys a product', { tag: '@regression' }, async ({
    homePage, signupModal, loginModal, productPage, cartPage, placeOrderModal, api,
  }) => {
    const username = uniqueUsername('qa_e2e');
    await homePage.open();
    expect(await signupModal.signup(username, env.testPassword)).toBe(MSG.signupSuccess);
    await loginModal.login(username, env.testPassword);

    await productPage.open(S6.id);
    await productPage.addToCart();
    await cartPage.open();
    await cartPage.expectItemCount(1);
    await cartPage.openPlaceOrder();
    await placeOrderModal.expectOpen();
    await placeOrderModal.fill(order.valid);
    expect((await placeOrderModal.purchase()).amount).toBe(S6.price);
    await placeOrderModal.confirmAndClose();

    const token = await api.getToken(username, env.testPassword);
    await expect.poll(async () => (await api.getCartItems(token)).length).toBe(0);
    await cartPage.logout();
    await loginModal.login(username, env.testPassword);
    await cartPage.open();
    await cartPage.expectItemCount(0);
    await api.deleteCart(username);
  });

  test('Case_06: Cart survives logout/login and is purchased in a later session', { tag: '@regression' }, async ({
    browser, loggedInPage, api, user, productPage,
  }) => {
    void loggedInPage;
    const nokia = await api.getProduct(NOKIA_ID);
    await productPage.open(S6.id);
    await productPage.addToCart();
    await productPage.open(NOKIA_ID);
    await productPage.addToCart();
    await productPage.logout();

    // Simulate a new browser session with a fresh context, then log in through the UI.
    const context = await browser.newContext({ baseURL: env.baseUrl });
    const page = await context.newPage();
    const home = new HomePage(page);
    const login = new LoginModal(page);
    const cart = new CartPage(page);
    const modal = new PlaceOrderModal(page);
    await home.open();
    await login.login(user.username, user.password);
    await cart.open();
    await cart.expectItemCount(2);
    await cart.openPlaceOrder();
    await modal.expectOpen();
    await modal.fill(order.valid);
    expect((await modal.purchase()).amount).toBe(S6.price + nokia.price);
    await context.close();
  });

  test('Case_07: User recovers from a failed login and completes a purchase', { tag: '@regression' }, async ({
    homePage, loginModal, productPage, cartPage, placeOrderModal, user,
  }) => {
    await homePage.open();
    expect(await loginModal.loginExpectingAlert(user.username, 'Wrong@123')).toBe(MSG.wrongPassword);
    await loginModal.expectLoggedOut();
    await loginModal.close();
    await loginModal.login(user.username, user.password);

    await productPage.open(S6.id);
    await productPage.addToCart();
    await cartPage.open();
    await cartPage.expectItemCount(1);
    await cartPage.openPlaceOrder();
    await placeOrderModal.expectOpen();
    await placeOrderModal.fill(order.valid);
    expect((await placeOrderModal.purchase()).amount).toBe(S6.price);
  });

  test('Case_08: User cannot complete checkout with an empty cart', { tag: '@regression' }, async ({
    loggedInPage, cartPage, placeOrderModal,
  }) => {
    knownBug('Checkout is allowed with an empty cart (confirmation with Amount 0 USD)');
    void loggedInPage;
    await cartPage.open();
    await cartPage.expectItemCount(0);
    await cartPage.openPlaceOrder();
    await placeOrderModal.expectOpen();
    await placeOrderModal.fill(order.valid);
    await placeOrderModal.purchaseButton.click();
    await expect(placeOrderModal.confirmation).toBeHidden({ timeout: 5_000 });
  });

  test('Case_09: Invalid session during checkout is handled', { tag: ['@regression', '@security'] }, async ({
    page, loggedInPage, productPage, cartPage, placeOrderModal,
  }) => {
    knownBug('Checkout is confirmed even with an invalid session token');
    void loggedInPage;
    await productPage.open(S6.id);
    await productPage.addToCart();

    await setAuthCookie(page.context(), 'abc123'); // Replace the session token with an invalid value.
    const dialogs = collectDialogs(page);
    await page.goto('/cart.html');
    await expect.poll(() => dialogs).toContain(MSG.tokenMalformed);
    await cartPage.openPlaceOrder();
    await placeOrderModal.expectOpen();
    await placeOrderModal.fill(order.valid);
    await placeOrderModal.purchaseButton.click();
    await expect(placeOrderModal.confirmation).toBeHidden({ timeout: 5_000 });
  });
});
