import { APIRequestContext, APIResponse } from '@playwright/test';
import { randomUUID } from 'crypto';
import { env } from '../../config/env';
import { encodePassword } from '../utils/data';

export interface CartItem { cookie: string; id: string; prod_id: number; }

/**
 * API client for DemoBlaze test setup, cart cleanup, and API tests.
 * Passwords are Base64-encoded to match requests from the web client.
 */
export class DemoblazeApi {
  constructor(private readonly request: APIRequestContext, private readonly baseUrl = env.apiUrl) {}

  private post(path: string, data: unknown): Promise<APIResponse> {
    return this.request.post(`${this.baseUrl}${path}`, { data });
  }

  signup(username: string, password: string) {
    return this.post('/signup', { username, password: encodePassword(password) });
  }

  login(username: string, password: string) {
    return this.post('/login', { username, password: encodePassword(password) });
  }

  /** Returns the login token used by the `tokenp_` cookie. Throws if the response contains no token. */
  async getToken(username: string, password: string): Promise<string> {
    const res = await this.login(username, password);
    const body = await res.json();
    if (typeof body !== 'string' || !body.startsWith('Auth_token: ')) {
      throw new Error(`Login failed for ${username}: ${JSON.stringify(body)}`);
    }
    return body.replace('Auth_token: ', '');
  }

  check(token: string) {
    return this.post('/check', { token });
  }

  viewCart(token: string) {
    return this.post('/viewcart', { cookie: token, flag: true });
  }

  async getCartItems(token: string): Promise<CartItem[]> {
    const body = await (await this.viewCart(token)).json();
    return body.Items ?? [];
  }

  addToCart(token: string, prodId: number) {
    return this.post('/addtocart', { id: randomUUID(), cookie: token, prod_id: prodId, flag: true });
  }

  /** Fetches product details by ID. The return type exposes the fields used by the tests. */
  async getProduct(prodId: number): Promise<{ id: number; title: string; price: number }> {
    return (await this.post('/view', { id: String(prodId) })).json();
  }

  deleteItem(itemId: string) {
    return this.post('/deleteitem', { id: itemId });
  }

  deleteCart(username: string) {
    return this.post('/deletecart', { cookie: username });
  }
}
