import { defineConfig } from "vitest/config";

const projectRoot = new URL(".", import.meta.url).pathname.replace(/\/$/, "");

export default defineConfig({
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".nuxt", ".output"],
    environment: "node",
  },
  resolve: {
    alias: {
      "~~": projectRoot,
      "~": projectRoot,
    },
  },
});
