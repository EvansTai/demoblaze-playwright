/**
 * Automated tests for the "Login" sheet in DemoBlaze_TestCases_EN.xlsx.
 * Test titles keep the sheet’s case IDs (Case_xx) for traceability.
 * knownBug() marks tests for confirmed product bugs as expected failures.
 */
import { test, expect, createUser, setAuthCookie } from '../../src/fixtures/test-fixtures';
import { LoginModal } from '../../src/pages/LoginModal';
import { MSG } from '../../test-data/messages';
import { encodePassword, uniqueUsername } from '../../src/utils/data';
import { acceptNextDialog, collectDialogs } from '../../src/utils/dialog';
import { knownBug } from '../../src/utils/known-bug';
import { env } from '../../config/env';

test.describe('Login', { tag: '@login' }, () => {
  test.beforeEach(async ({ homePage }) => {
    await homePage.open();
  });

  // Critical-priority cases.
  test('Case_01: Log in successfully with a valid username and password', { tag: ['@smoke', '@regression'] }, async ({ loginModal, user }) => {
    await loginModal.login(user.username, user.password);
    await expect(loginModal.modal).toBeHidden();
  });

  test('Case_02: Login session is kept after reloading the page', { tag: '@regression' }, async ({ page, loginModal, cartPage, user }) => {
    await loginModal.login(user.username, user.password);
    await page.reload();
    await loginModal.expectLoggedInAs(user.username);
    await cartPage.open();
    await cartPage.expectLoggedInAs(user.username);
  });

  test('Case_03: Log out successfully', { tag: ['@smoke', '@regression'] }, async ({ page, loginModal, user }) => {
    await loginModal.login(user.username, user.password);
    await loginModal.logout();
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === 'tokenp_')).toBeUndefined();
  });

  test('Case_04: Cannot log in with a wrong password', { tag: ['@smoke', '@regression'] }, async ({ loginModal, user }) => {
    expect(await loginModal.loginExpectingAlert(user.username, 'Wrong@123')).toBe(MSG.wrongPassword);
    await expect(loginModal.modal).toBeVisible();
    await loginModal.expectLoggedOut();
  });

  test('Case_05: Cannot log in with a non-existent username', { tag: ['@smoke', '@regression'] }, async ({ loginModal }) => {
    expect(await loginModal.loginExpectingAlert(uniqueUsername('not_exist'), 'Test@123')).toBe(MSG.userNotExist);
    await loginModal.expectLoggedOut();
  });

  // High-priority cases.
  test('Case_06: Verify UI of the Login modal', { tag: '@regression' }, async ({ loginModal }) => {
    await loginModal.open();
    await expect(loginModal.title).toHaveText('Log in');
    await expect(loginModal.usernameInput).toBeEmpty();
    await expect(loginModal.passwordInput).toBeEmpty();
    await expect(loginModal.passwordInput).toHaveAttribute('type', 'password');
    await expect(loginModal.submitButton).toBeVisible();
    await expect(loginModal.closeButton).toBeVisible();
    await expect(loginModal.closeIcon).toBeVisible();
  });

  test('Case_07: Log in successfully with an account that was just signed up', { tag: '@regression' }, async ({ signupModal, loginModal }) => {
    const username = uniqueUsername('qa_new');
    expect(await signupModal.signup(username, env.testPassword)).toBe(MSG.signupSuccess);
    await loginModal.login(username, env.testPassword);
  });

  test('Case_08: Log in again after logging out', { tag: '@regression' }, async ({ loginModal, user }) => {
    await loginModal.login(user.username, user.password);
    await loginModal.logout();
    await loginModal.login(user.username, user.password);
  });

  test('Case_09: Login session is shared across tabs of the same browser', { tag: '@regression' }, async ({ page, loginModal, user }) => {
    await loginModal.login(user.username, user.password);
    const tab2 = await page.context().newPage();
    await tab2.goto('/');
    await new LoginModal(tab2).expectLoggedInAs(user.username);
  });

  const emptyFieldCases = [
    { id: 'Case_10', title: 'Cannot log in when both Username and Password are empty', username: '', password: '' },
    { id: 'Case_11', title: 'Cannot log in when Username is empty', username: '', password: 'Test@123' },
    { id: 'Case_12', title: 'Cannot log in when Password is empty', username: 'any_user', password: '' },
  ];
  for (const c of emptyFieldCases) {
    test(`${c.id}: ${c.title}`, { tag: '@regression' }, async ({ page, loginModal }) => {
      let loginRequests = 0;
      page.on('request', (r) => { if (r.url().includes('/login')) loginRequests++; });
      expect(await loginModal.loginExpectingAlert(c.username, c.password)).toBe(MSG.fillUserPass);
      expect(loginRequests, 'no login request should be sent').toBe(0);
      await loginModal.expectLoggedOut();
    });
  }

  test('Case_13: User is not logged in again after pressing browser Back following logout', { tag: '@regression' }, async ({ page, loginModal, user }) => {
    await loginModal.login(user.username, user.password);
    await loginModal.logout();
    await page.goBack();
    await page.reload();
    await loginModal.expectLoggedOut();
  });

  test('Case_14: Old auth token cannot be reused after logout', { tag: ['@regression', '@security'] }, async ({ page, api, loginModal, user }) => {
    knownBug('Logout only deletes the cookie on the client; the token stays valid on the server');
    await loginModal.login(user.username, user.password);
    const token = (await page.context().cookies()).find((c) => c.name === 'tokenp_')!.value;
    await loginModal.logout();
    const body = await (await api.check(token)).json();
    expect(body.errorMessage, 'token should be rejected after logout').toBeTruthy();
  });

  test('Case_15: SQL injection string in Username/Password does not bypass login', { tag: ['@regression', '@security'] }, async ({ loginModal }) => {
    const msg = await loginModal.loginExpectingAlert("' OR '1'='1", "' OR '1'='1");
    expect([MSG.userNotExist, MSG.wrongPassword]).toContain(msg);
    await loginModal.expectLoggedOut();
  });

  // Medium-priority cases.
  test('Case_16: Username is case-sensitive', { tag: '@regression' }, async ({ loginModal, user }) => {
    expect(await loginModal.loginExpectingAlert(user.username.toUpperCase(), user.password)).toBe(MSG.userNotExist);
    await loginModal.expectLoggedOut();
  });

  test('Case_17: Password is case-sensitive', { tag: '@regression' }, async ({ loginModal, user }) => {
    expect(await loginModal.loginExpectingAlert(user.username, user.password.toUpperCase())).toBe(MSG.wrongPassword);
  });

  test('Case_18: Leading/trailing spaces in Username are trimmed', { tag: '@regression' }, async ({ loginModal, user }) => {
    await loginModal.open();
    await loginModal.fill(`  ${user.username}  `, user.password);
    const dialogs = collectDialogs(loginModal.page);
    await loginModal.submitButton.click();
    await expect(loginModal.welcomeUser, `unexpected alert(s): ${dialogs.join(', ')}`).toHaveText(`Welcome ${user.username}`);
  });

  test('Case_19: Username containing only spaces is treated as empty', { tag: '@regression' }, async ({ loginModal }) => {
    knownBug('Client only checks for an empty string; a spaces-only username is sent to the API');
    expect(await loginModal.loginExpectingAlert('   ', 'Test@123')).toBe(MSG.fillUserPass);
  });

  test('Case_20: Password with trailing space is not accepted', { tag: '@regression' }, async ({ loginModal, user }) => {
    expect(await loginModal.loginExpectingAlert(user.username, `${user.password} `)).toBe(MSG.wrongPassword);
    await loginModal.expectLoggedOut();
  });

  test('Case_21: Close the Login modal with the "Close" button', { tag: '@regression' }, async ({ loginModal }) => {
    await loginModal.open();
    await loginModal.fill('someone', 'something');
    await loginModal.close();
    await loginModal.expectLoggedOut();
  });

  test('Case_22: Close the Login modal with the "×" icon', { tag: '@regression' }, async ({ loginModal }) => {
    await loginModal.open();
    await loginModal.closeIcon.click();
    await expect(loginModal.modal).toBeHidden();
    await loginModal.expectLoggedOut();
  });

  test('Case_23: Close the Login modal with Esc key / clicking outside', { tag: '@regression' }, async ({ page, loginModal }) => {
    await loginModal.open();
    await page.keyboard.press('Escape');
    await expect(loginModal.modal).toBeHidden();

    await loginModal.open();
    await loginModal.modal.click({ position: { x: 5, y: 5 } }); // Click the backdrop outside the dialog.
    await expect(loginModal.modal).toBeHidden();
    await loginModal.expectLoggedOut();
  });

  test('Case_24: Entered credentials are cleared after closing and re-opening the modal', { tag: '@regression' }, async ({ loginModal, user }) => {
    knownBug('Username and password stay in the modal after it is closed');
    await loginModal.open();
    await loginModal.fill(user.username, user.password);
    await loginModal.close();
    await loginModal.open();
    await expect(loginModal.usernameInput).toBeEmpty({ timeout: 3_000 });
    await expect(loginModal.passwordInput).toBeEmpty({ timeout: 3_000 });
  });

  test('Case_25: Submit login by pressing Enter', { tag: '@regression' }, async ({ loginModal, user }) => {
    knownBug('Login form has no submit button, so pressing Enter does not submit');
    await loginModal.open();
    await loginModal.fill(user.username, user.password);
    await loginModal.passwordInput.press('Enter');
    await expect(loginModal.welcomeUser).toHaveText(`Welcome ${user.username}`, { timeout: 8_000 });
  });

  test('Case_26: Clicking "Log in" repeatedly does not cause duplicate processing', { tag: '@regression' }, async ({ page, loginModal, user }) => {
    const dialogs = collectDialogs(page);
    await loginModal.open();
    await loginModal.fill(user.username, user.password);
    await loginModal.submitButton.click({ clickCount: 3, delay: 50 }).catch(() => undefined); // A page reload may interrupt the remaining clicks.
    await loginModal.expectLoggedInAs(user.username);
    expect(dialogs, 'no error alert expected').toEqual([]);
  });

  test('Case_27: Tampered auth token is rejected', { tag: ['@regression', '@security'] }, async ({ page, loginModal }) => {
    await setAuthCookie(page.context(), 'abc123');
    const msg = await acceptNextDialog(page, () => page.reload());
    expect(msg).toBe(MSG.tokenMalformed);
    await loginModal.expectLoggedOut();
  });

  test('Case_28: XSS payload in Username is not executed', { tag: ['@regression', '@security'] }, async ({ page, loginModal }) => {
    const dialogs = collectDialogs(page);
    await loginModal.open();
    await loginModal.fill(`<script>alert('xss')</script>`, 'Test@123');
    await loginModal.submitButton.click();
    await expect.poll(() => dialogs.length).toBeGreaterThan(0);
    await page.waitForTimeout(1_000); // Allow time for the injected script to run before checking the alerts.
    expect(dialogs).toEqual([MSG.userNotExist]);
  });

  test('Case_29: Log in with a username containing special characters', { tag: '@regression' }, async ({ api, loginModal }) => {
    const user = await createUser(api, undefined, `qa.user_!#$%_${Date.now()}`);
    await loginModal.login(user.username, user.password);
  });

  test('Case_30: Log in with a Unicode username', { tag: '@regression' }, async ({ api, loginModal }) => {
    const user = await createUser(api, undefined, `kiểmthử_${Date.now()}`);
    await loginModal.login(user.username, user.password);
  });

  test('Case_31: Login works on all supported browsers', { tag: ['@regression', '@cross-browser'] }, async ({ loginModal, user }) => {
    // Runs on Chromium, Firefox, and WebKit through the projects in playwright.config.ts.
    await loginModal.login(user.username, user.password);
    await loginModal.logout();
  });

  test('Case_32: Switching accounts in another tab is reflected in all tabs', { tag: '@regression' }, async ({ page, api, loginModal, productPage, user, userB }) => {
    await loginModal.login(user.username, user.password);
    await productPage.open(1); // Keep the first tab open as user A.

    const tab2 = await page.context().newPage();
    const login2 = new LoginModal(tab2);
    await tab2.goto('/');
    await login2.logout();
    await login2.login(userB.username, userB.password);

    // Add the product from the first tab without reloading its stale login state.
    await productPage.addToCart();
    await page.reload();
    await loginModal.expectLoggedInAs(userB.username);

    const tokenA = await api.getToken(user.username, user.password);
    const tokenB = await api.getToken(userB.username, userB.password);
    expect(await api.getCartItems(tokenA)).toHaveLength(0);
    expect(await api.getCartItems(tokenB)).toHaveLength(1);
  });

  test('Case_33: Log in with a password containing special and Unicode characters', { tag: '@regression' }, async ({ page, api, loginModal }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    const username = uniqueUsername('qa_pwd');
    const password = 'P@ss wörd!#ễ';
    const res = await api.signup(username, password);
    expect((await res.json().catch(() => ''))?.errorMessage).toBeUndefined();
    await loginModal.login(username, password);
    expect(pageErrors, 'no JavaScript error expected').toEqual([]);
  });

  // Low-priority and boundary cases.
  test('Case_34: Log in with a 1-character username', { tag: '@regression' }, async ({ api, loginModal }) => {
    // Use a random CJK character to reduce username collisions on the shared backend.
    let user;
    for (let i = 0; i < 5 && !user; i++) {
      const name = String.fromCodePoint(0x4e00 + Math.floor(Math.random() * 20_000));
      const res = await api.signup(name, env.testPassword);
      if (!(await res.json().catch(() => ''))?.errorMessage) user = { username: name, password: env.testPassword };
    }
    test.skip(!user, 'Could not find a free 1-character username');
    await loginModal.login(user!.username, user!.password);
  });

  test('Case_35: Very long Username (256+ characters) is handled gracefully', { tag: '@regression' }, async ({ loginModal }) => {
    const msg = await loginModal.loginExpectingAlert('a'.repeat(256), 'Test@123');
    expect(msg).toBe(MSG.userNotExist);
    const box = await loginModal.usernameInput.boundingBox();
    const dialog = await loginModal.modal.locator('.modal-dialog').boundingBox();
    expect(box!.width).toBeLessThanOrEqual(dialog!.width);
  });

  test('Case_36: Very long Password (1000+ characters) is handled gracefully', { tag: '@regression' }, async ({ loginModal, user }) => {
    expect(await loginModal.loginExpectingAlert(user.username, 'p'.repeat(1000))).toBe(MSG.wrongPassword);
  });

  test('Case_37: Error messages do not reveal whether a username exists', { tag: ['@regression', '@security'] }, async ({ loginModal, user }) => {
    knownBug('"Wrong password." vs "User does not exist." allows username enumeration');
    const wrongPwd = await loginModal.loginExpectingAlert(user.username, 'Wrong@123');
    await loginModal.close();
    const noUser = await loginModal.loginExpectingAlert(uniqueUsername('ghost'), 'Wrong@123');
    expect(wrongPwd).toBe(noUser);
  });

  test('Case_38: Repeated failed logins are limited', { tag: ['@regression', '@security'] }, async ({ api, user }) => {
    knownBug('No rate limiting / lockout after repeated failed logins');
    const messages: string[] = [];
    for (let i = 0; i < 10; i++) {
      const res = await api.login(user.username, `Wrong@${i}`);
      messages.push(res.status() === 429 ? 'rate-limited' : (await res.json()).errorMessage);
    }
    expect(messages.some((m) => m !== MSG.wrongPassword), 'expected lockout/rate limit after 10 failures').toBeTruthy();
  });

  test('Case_39: Password is not sent in a recoverable form', { tag: ['@regression', '@security'] }, async ({ page, loginModal, user }) => {
    knownBug('Password is only Base64-encoded in the login request');
    const [request] = await Promise.all([
      page.waitForRequest((r) => r.url().includes('/login') && r.method() === 'POST'),
      loginModal.login(user.username, user.password),
    ]);
    expect(request.url()).toMatch(/^https:/);
    const sent = request.postDataJSON().password as string;
    expect(sent).not.toBe(user.password);
    expect(sent, 'password must not be trivially decodable').not.toBe(encodePassword(user.password));
  });

  test('Case_40: User gets feedback when the login request fails due to network loss', { tag: '@regression' }, async ({ page, loginModal, user }) => {
    knownBug('No error handling when the login request fails (no message is shown)');
    await loginModal.open();
    await loginModal.fill(user.username, user.password);
    await page.context().setOffline(true);
    const feedback = acceptNextDialog(page, () => loginModal.submitButton.click(), 5_000);
    await expect(feedback).resolves.toBeTruthy();
    await page.context().setOffline(false);
  });

  test('Case_41: Tab order in the Login modal is logical', { tag: ['@regression', '@a11y'] }, async ({ page, loginModal }) => {
    await loginModal.open();
    await loginModal.usernameInput.focus();
    await page.keyboard.press('Tab');
    await expect(loginModal.passwordInput).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(loginModal.closeButton).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(loginModal.submitButton).toBeFocused();
  });

  test.describe('Mobile viewport', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('Case_42: Login modal is usable on mobile viewport', { tag: ['@regression', '@mobile'] }, async ({ page, loginModal, user }) => {
      await loginModal.open();
      for (const el of [loginModal.usernameInput, loginModal.passwordInput, loginModal.submitButton]) {
        await expect(el).toBeInViewport();
        const box = await el.boundingBox();
        expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      }
      await loginModal.fill(user.username, user.password);
      await loginModal.submitButton.click();
      await loginModal.expectLoggedInAs(user.username);
    });
  });
});

