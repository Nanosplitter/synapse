import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["modules/**/*.js", "utils/**/*.js", "config.js"],
      exclude: ["tests/**", "mock-discord.js", "main.js", "main-new.js", "main-old-backup.js"]
    }
  }
});
