import { defineConfig } from "vitest/config";
import { gyral } from "@gyral/core/vite";
import { playwright } from "@vitest/browser-playwright";

const types = { dirs: ["apps/web/src"], out: "apps/web/.gyral/elements.d.ts" };

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [gyral({ clientOnly: true, types })],
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        // "auto" pre-bundles what components and tests import at startup,
        // so a run never stops to optimize a dependency and reload.
        plugins: [gyral({ clientOnly: true, types, optimize: "auto" })],
        test: {
          name: "browser",
          include: ["tests/browser/**/*.test.ts"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }, { browser: "webkit" }],
          },
        },
      },
    ],
  },
});
