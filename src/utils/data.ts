import { env } from '../../config/env';

export interface TestUser { username: string; password: string; }

export const encodePassword = (password: string): string => Buffer.from(password, 'utf8').toString('base64');

/** Generates a username for creating separate accounts in parallel tests. */
export const uniqueUsername = (prefix = 'qa'): string =>
  `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

export const newUser = (prefix?: string): TestUser => ({ username: uniqueUsername(prefix), password: env.testPassword });

/** Extracts the numeric amount from text such as "Amount: 360 USD". */
export const parseAmount = (text: string): number => Number(text.match(/Amount:\s*(\d+)/)?.[1] ?? NaN);
