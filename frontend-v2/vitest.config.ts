import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".nuxt", ".output"],
    environment: "node",
  },
  resolve: {
    alias: {
      "~~": path.resolve(__dirname),
      "~": path.resolve(__dirname),
    },
  },
});
