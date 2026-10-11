import { defineConfig } from "vitest/config";
import { gyralVitePreset } from "@gyral/core/vite";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  test: {
    projects: [
      {
        ...gyralVitePreset({
          clientOnly: true,
          types: {
            dirs: ["apps/web/src"],
            out: "apps/web/.gyral/elements.d.ts",
          },
          optimize: ["effect"],
        }),
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        ...gyralVitePreset({
          clientOnly: true,
          types: {
            dirs: ["apps/web/src"],
            out: "apps/web/.gyral/elements.d.ts",
          },
          optimize: ["effect"],
        }),
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
