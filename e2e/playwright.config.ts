import { defineConfig } from "@playwright/test";

/** End-to-end tests against the built site in `dist/`; `pnpm run test:e2e` builds it first. */
export default defineConfig({
  testDir: ".",
  fullyParallel: true,
  reporter: "list",
  use: {
    browserName: "chromium",
    // Requests are answered from `dist/` and fixtures by a route handler, which a service worker would bypass.
    serviceWorkers: "block",
    acceptDownloads: true,
  },
});
