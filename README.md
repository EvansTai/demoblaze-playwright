# DemoBlaze E2E Automation (Playwright + TypeScript)

[![Playwright Tests](https://github.com/EvansTai/demoblaze-playwright/actions/workflows/playwright.yml/badge.svg)](https://github.com/EvansTai/demoblaze-playwright/actions/workflows/playwright.yml)

Automation framework and demo scripts for the **Login** and **Shopping Cart** features of [DemoBlaze](https://www.demoblaze.com/).

**Test case suite (Excel):** [`docs/DemoBlaze_TestCases_EN.xlsx`](docs/DemoBlaze_TestCases_EN.xlsx) - sheets Login, Shopping Cart, E2E.

## Tech stack

| | |
|---|---|
| Test runner | [Playwright Test](https://playwright.dev/) 1.59 |
| Language | TypeScript |
| Pattern | Page Object Model + custom fixtures |
| Test types | UI, E2E, API, light performance |
| Browsers | Chromium, Firefox, WebKit (Safari), mobile Chrome (Pixel 7), mobile Safari (iPhone 13) |
| Reporting | HTML report, JUnit XML, trace/screenshot/video on failure |
| CI | GitHub Actions (matrix per browser, nightly schedule, manual run with tag filter) |

## Project structure

```
.
├── .github/workflows/playwright.yml   # CI jobs for API, browser, and performance tests
├── config/env.ts                      # Environment settings loaded from .env with defaults
├── src/
│   ├── api/DemoblazeApi.ts            # API client for account setup, cart operations, and API tests
│   ├── fixtures/test-fixtures.ts      # Page objects, test accounts, and an authenticated page
│   ├── pages/                         # Page objects
│   │   ├── BasePage.ts                # Shared navigation, login checks, and browser alert handling
│   │   ├── HomePage.ts
│   │   ├── LoginModal.ts
│   │   ├── ProductPage.ts
│   │   ├── CartPage.ts
│   │   └── PlaceOrderModal.ts         # Order form actions and confirmation details
│   └── utils/                         # Test data generators, alert helpers, and known bug markers
├── test-data/                         # Product data, order data, and expected messages
├── tests/
│   ├── ui/login.spec.ts               # Login flows, invalid credentials, and field validation
│   ├── ui/cart.spec.ts                # Cart contents, totals, persistence, and checkout validation
│   ├── e2e/purchase.spec.ts           # Purchase journeys from login through checkout
│   ├── api/auth.api.spec.ts           # API tests for authentication and cart endpoints
│   └── perf/page-load.spec.ts         # Page load time checks using Navigation Timing
├── playwright.config.ts
└── .env.example
```

## Design rationale

- **Page Object Model** - locators and actions live in `src/pages`, assertions stay in specs. A UI change is fixed in one place.
- **Fixtures instead of `beforeAll` setup** - `user` creates a brand-new account via API for every test, `loggedInPage` injects the auth cookie (`tokenp_`) so Cart tests skip the UI login. Tests are isolated and run in parallel safely.
- **API-assisted UI tests** - the same `DemoblazeApi` client is used for data setup, cross-checking UI results (e.g. cart content) and for standalone API tests.
- **No hard waits** - tests wait on network responses (`/login`, `/viewcart`, `/deleteitem`) and on web-first assertions (`toHaveCount`, `toHaveText`) because DemoBlaze renders data asynchronously.
- **Native alerts** - DemoBlaze uses `window.alert()`; `acceptNextDialog()` captures and returns the message so it can be asserted.
- **Responsive-safe login checks** - login state is asserted from the inline `display` style DemoBlaze toggles, so the same assertions work when the navbar is collapsed on mobile.
- **Tags** - `@smoke`, `@regression`, `@e2e`, `@api`, `@perf`, `@known-bug` to select suites with `--grep`.
- **Known bugs as `test.fail()`** - confirmed defects are documented as expected failures: the suite stays green, and the test turns red ("unexpected pass") once the bug is fixed.
- **Config via `.env`** - base URLs, test password, perf budget and worker count are configurable without code changes.

## Prerequisites

- Node.js 18+ (20 LTS recommended)
- Git

## Setup

```bash
git clone <your-repo-url>
cd demoblaze-playwright
npm ci                      # Or use npm install.
npx playwright install      # Install browsers; add --with-deps on Linux.
cp .env.example .env        # Optional: copy this file to customize the defaults.
```

## Running the tests

| Command | What it runs |
|---|---|
| `npm test` | Everything (all projects) |
| `npm run test:smoke` | `@smoke` tests on all projects |
| `npm run test:regression` | `@regression` tests |
| `npm run test:chromium` | UI + E2E on Chromium only |
| `npm run test:headed` | Chromium with a visible browser |
| `npm run test:api` | API tests |
| `npm run test:perf` | Performance checks |
| `npm run test:mobile` | Smoke E2E on Pixel 7 + iPhone 13 emulation |
| `npm run report` | Open the last HTML report |

Run the demo scenario only (Login > Add to cart > Place order):

```bash
npx playwright test tests/e2e/purchase.spec.ts --project=chromium --headed
```

Other useful options:

```bash
npx playwright test --grep @known-bug           # Run tests marked as known bugs.
npx playwright test --ui                        # Open Playwright’s interactive test runner.
npx playwright test --repeat-each=5 --project=chromium   # Repeat tests to check for intermittent failures.
```

## Reports

- **HTML report**: `playwright-report/index.html` (`npm run report`)
- **JUnit XML**: `test-results/junit.xml` (for Jenkins / GitLab test reporting)
- **Trace / video / screenshot**: kept for failed tests - open a trace with `npx playwright show-trace <trace.zip>`

## CI/CD

`.github/workflows/playwright.yml` runs on push to `main`, on pull requests, nightly at 08:00 (ICT) and manually (`workflow_dispatch`, with an optional tag filter such as `@login` or `@cart` for the regression job):

| Job | What it runs |
|---|---|
| `API tests` | All API tests (`--project=api`) |
| `Smoke` | `@smoke` tests on a matrix: chromium, firefox, webkit, mobile-chrome, mobile-safari |
| `Regression (chromium)` | Full UI + E2E suite on Chromium |
| `Performance` | Page-load budget checks |

Each job uploads its HTML report as a build artifact (Actions run page > Artifacts). The same `npx playwright test --project=<name>` commands work in Jenkins or GitLab CI.

## Test case traceability

Every automated test is named after its TestCaseID in [`docs/DemoBlaze_TestCases_EN.xlsx`](docs/DemoBlaze_TestCases_EN.xlsx):

| Sheet | Spec file | Coverage |
|---|---|---|
| Login | `tests/ui/login.spec.ts` | Case_01 - Case_42 |
| Shopping Cart | `tests/ui/cart.spec.ts` | Case_01 - Case_46 |
| E2E | `tests/e2e/purchase.spec.ts` | Case_01 - Case_10 (Case_10 = Case_01 run on every browser + mobile project) |

Run a single case: `npx playwright test -g "Case_05" tests/ui/cart.spec.ts --project=chromium`

## Known issues found (`knownBug()` tests)

Confirmed defects are automated as expected failures with `knownBug('<description>')` (wraps `test.fail()` and adds a `known-bug` annotation shown in the HTML report). List them with `npm run test:known-bugs`.

| Sheet / Case | Issue |
|---|---|
| Login Case_14 | Token stays valid on the server after logout |
| Login Case_19 | Spaces-only username is not treated as empty |
| Login Case_24 | Credentials stay in the modal after closing it |
| Login Case_25 | Enter key does not submit the login form |
| Login Case_37 | Different error messages allow username enumeration |
| Login Case_38 | No rate limiting / lockout after repeated failed logins |
| Login Case_39 | Password is only Base64-encoded in the request |
| Login Case_40 | No feedback when the login request fails (offline) |
| Cart Case_13 / E2E Case_08 | Order can be placed with an empty cart |
| Cart Case_19 | Purchase is confirmed while offline (no server-side order) |
| Cart Case_20 | Total is blank instead of 0 after deleting the last item |
| Cart Case_21 | Guest cart is lost after logging in |
| Cart Case_22 / 23 / 24 / 40 | No validation on Credit card, Month, Year, card length |
| Cart Case_25 | Spaces-only Name / Credit card pass validation |
| Cart Case_26 | Confirmation date month is off by one |
| Cart Case_32 | No "product not found" handling |
| Cart Case_35 | Order total ignores cart changes made in another tab |
| Cart Case_36 / E2E Case_09 | Order confirmed with an ended / invalid session |
| Cart Case_38 | "Product added" vs "Product added." for guest / logged-in |
| Cart Case_39 | Full credit card number shown in the confirmation |
| Cart Case_46 | No feedback when Add to cart fails (offline) |

## Notes

- Every run signs up new users (`qa_<timestamp>_<random>`) on the public DemoBlaze backend.
- DemoBlaze is a shared public demo and can be slow; keep `WORKERS` low (default 2). Retries are enabled (1 locally, 2 on CI).
