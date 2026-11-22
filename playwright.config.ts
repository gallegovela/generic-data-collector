import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

// Los specs de tenancy-auth llaman directamente a servicios de
// servidor (p. ej. userService.inviteUser en los beforeAll) desde el
// propio proceso de Playwright, que no es un servidor Next.js y por
// tanto no carga `.env` automáticamente: se hace aquí, igual que lo
// haría `next dev`/`next build` (ver @next/env, usado también por el
// propio Next.js internamente).
loadEnvConfig(process.cwd());

const PORT = 3100;
// En el entorno de pruebas en contenedores (docker-compose.test.yml) la
// app ya está arrancada y E2E_BASE_URL apunta a ella; en local, Playwright
// arranca el servidor de desarrollo.
const externalBaseURL = process.env.E2E_BASE_URL;
const baseURL = externalBaseURL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "line",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        command: `npm run dev -- --port ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
