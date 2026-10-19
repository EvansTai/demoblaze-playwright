import { test as base, expect, Page, BrowserContext } from '@playwright/test';
import { DemoblazeApi } from '../api/DemoblazeApi';
import { HomePage } from '../pages/HomePage';
import { LoginModal } from '../pages/LoginModal';
import { ProductPage } from '../pages/ProductPage';
import { CartPage } from '../pages/CartPage';
import { PlaceOrderModal } from '../pages/PlaceOrderModal';
import { SignupModal } from '../pages/SignupModal';
import { newUser, TestUser } from '../utils/data';
import { env } from '../../config/env';
import { randomUUID } from 'crypto';

type Fixtures = {
  api: DemoblazeApi;
  /** A new account created through the API for each test. */
  user: TestUser;
  /** A separate account for tests that need two users. */
  userB: TestUser;
  /** A page authenticated as `user` by setting the session cookie. */
  loggedInPage: Page;
  homePage: HomePage;
  loginModal: LoginModal;
  productPage: ProductPage;
  cartPage: CartPage;
  placeOrderModal: PlaceOrderModal;
  signupModal: SignupModal;
};

export const test = base.extend<Fixtures>({
  /*
   * DemoBlaze uses the browser's cookie string to identify a guest cart.
   * Visiting a product page before Home can leave that string empty and cause tests
   * to share a cart. Set a unique `user` cookie to give each test its own guest cart.
   */
  context: async ({ context }, use) => {
    await context.addCookies([{ name: 'user', value: randomUUID(), url: env.baseUrl }]);
    await use(context);
  },

  api: async ({ request }, use) => {
    await use(new DemoblazeApi(request));
  },

  user: async ({ api }, use) => {
    const user = await createUser(api);
    await use(user);
    await api.deleteCart(user.username); // Clear the account’s cart after the test.
  },

  userB: async ({ api }, use) => {
    const user = await createUser(api, 'qb');
    await use(user);
    await api.deleteCart(user.username);
  },

  loggedInPage: async ({ page, api, user }, use) => {
    await authenticate(page.context(), api, user);
    await use(page);
  },

  homePage: async ({ page }, use) => use(new HomePage(page)),
  loginModal: async ({ page }, use) => use(new LoginModal(page)),
  productPage: async ({ page }, use) => use(new ProductPage(page)),
  cartPage: async ({ page }, use) => use(new CartPage(page)),
  placeOrderModal: async ({ page }, use) => use(new PlaceOrderModal(page)),
  signupModal: async ({ page }, use) => use(new SignupModal(page)),
});

export { expect };

/** Creates an account through the API. Pass a username to test specific characters. */
export async function createUser(api: DemoblazeApi, prefix = 'qa', username?: string): Promise<TestUser> {
  const user = username ? { username, password: newUser().password } : newUser(prefix);
  const res = await api.signup(user.username, user.password);
  const body = await res.json().catch(() => '');
  expect(res.ok(), `signup HTTP ${res.status()}`).toBeTruthy();
  expect(body?.errorMessage, `signup failed for ${user.username}: ${JSON.stringify(body)}`).toBeUndefined();
  return user;
}

/** Authenticates the browser context by setting the session cookie and returns the token. */
export async function authenticate(context: BrowserContext, api: DemoblazeApi, user: TestUser): Promise<string> {
  const token = await api.getToken(user.username, user.password);
  await context.addCookies([{ name: 'tokenp_', value: token, url: env.baseUrl }]);
  return token;
}

/** Sets the session cookie to the supplied token, including invalid tokens for negative tests. */
export async function setAuthCookie(context: BrowserContext, token: string): Promise<void> {
  await context.addCookies([{ name: 'tokenp_', value: token, url: env.baseUrl }]);
}
