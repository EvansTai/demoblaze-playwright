import { test, expect } from '../../src/fixtures/test-fixtures';
import { MSG } from '../../test-data/messages';
import { newUser, uniqueUsername } from '../../src/utils/data';

test.describe('API - Auth', () => {
  test('Sign up a new user', { tag: ['@api', '@regression'] }, async ({ api }) => {
    const u = newUser('api');
    const res = await api.signup(u.username, u.password);
    expect(res.status()).toBe(200);
    expect((await res.json().catch(() => ''))?.errorMessage).toBeUndefined();
  });

  test('Sign up with an existing username fails', { tag: ['@api', '@regression'] }, async ({ api, user }) => {
    const res = await api.signup(user.username, user.password);
    expect((await res.json()).errorMessage).toBe(MSG.userExists);
  });

  test('Login returns an auth token', { tag: ['@api', '@smoke'] }, async ({ api, user }) => {
    const res = await api.login(user.username, user.password);
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatch(/^Auth_token: \S+/);
  });

  test('Login with wrong password', { tag: ['@api', '@regression'] }, async ({ api, user }) => {
    const res = await api.login(user.username, 'Wrong@123');
    expect((await res.json()).errorMessage).toBe(MSG.wrongPassword);
  });

  test('Login with non-existent user', { tag: ['@api', '@regression'] }, async ({ api }) => {
    const res = await api.login(uniqueUsername('ghost'), 'Test@123');
    expect((await res.json()).errorMessage).toBe(MSG.userNotExist);
  });

  test('Token check returns the logged-in username', { tag: ['@api', '@regression'] }, async ({ api, user }) => {
    const token = await api.getToken(user.username, user.password);
    const body = await (await api.check(token)).json();
    expect(JSON.stringify(body)).toContain(user.username);
  });
});

test.describe('API - Cart', () => {
  test('Add to cart, view cart and delete item', { tag: ['@api', '@regression'] }, async ({ api, user }) => {
    const token = await api.getToken(user.username, user.password);
    expect((await api.addToCart(token, 1)).ok()).toBeTruthy();
    const items = await api.getCartItems(token);
    expect(items.map((i) => i.prod_id)).toEqual([1]);

    expect((await api.deleteItem(items[0].id)).ok()).toBeTruthy();
    await expect.poll(async () => (await api.getCartItems(token)).length).toBe(0);
  });

  test('View cart with a malformed token is rejected', { tag: ['@api', '@regression'] }, async ({ api }) => {
    const body = await (await api.viewCart('abc123')).json();
    expect(body.errorMessage).toBeTruthy();
  });
});
