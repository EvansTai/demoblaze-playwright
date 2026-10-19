import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export const env = {
  baseUrl: process.env.BASE_URL ?? 'https://www.demoblaze.com',
  apiUrl: process.env.API_URL ?? 'https://api.demoblaze.com',
  testPassword: process.env.TEST_PASSWORD ?? 'Test@123',
  perfMaxLoadMs: Number(process.env.PERF_MAX_LOAD_MS ?? 8000),
  workers: Number(process.env.WORKERS ?? 2),
  isCI: !!process.env.CI,
};
