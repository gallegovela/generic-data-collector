import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/form-schema/**"],
      thresholds: { lines: 90, statements: 90, branches: 90, functions: 90 },
    },
  },
});
