import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env", quiet: true });

const PORT = 3210;
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * End to end against a production build, because the rules being checked are
 * headers and caching that dev mode does not apply the same way (criteria 18
 * and 19). The database must be up: ADR 0002, MySQL everywhere.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  timeout: 45000,
  use: {
    baseURL,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run build && npx next start --port ${PORT}`,
    url: baseURL,
    timeout: 240000,
    reuseExistingServer: !process.env.CI,
    // The log transport, so a production build can run without a real
    // mailbox. Production sets SMTP_HOST and never sets this.
    env: { ...process.env, MAIL_TRANSPORT: "log", APP_URL: baseURL } as Record<string, string>,
  },
});
