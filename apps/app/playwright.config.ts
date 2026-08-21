import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  projects: [{
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      launchOptions: {
        args: [
          '--disable-features=WebRtcHideLocalIpsWithMdns',
          '--force-webrtc-ip-handling-policy=default',
          '--use-fake-device-for-media-stream',
          '--use-fake-ui-for-media-stream',
        ],
      },
    },
  }],
  webServer: [
    {
      command: 'go run ./cmd/server -addr=:8080',
      cwd: resolve(__dirname, '../server'),
      url: 'http://127.0.0.1:8080/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -- --hostname 127.0.0.1',
      cwd: __dirname,
      url: 'http://127.0.0.1:3000/app',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
