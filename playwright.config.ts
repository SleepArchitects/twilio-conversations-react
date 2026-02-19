import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ["line"],
    [
      "html",
      {
        open: "never",
        outputFolder: ".sisyphus/evidence/coordinator-toggle/playwright-report",
      },
    ],
  ],
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  timeout: 30000,
  expect: {
    timeout: 10000,
  },
});
