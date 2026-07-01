import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@sportverse/content-gen": resolve(__dirname, "packages/content-gen/src/index.ts"),
      "@sportverse/sports-db": resolve(__dirname, "packages/sports-db/src/index.ts"),
      "@sportverse/quiz-engine": resolve(__dirname, "packages/quiz-engine/src/index.ts"),
      "@sportverse/sim-core": resolve(__dirname, "packages/sim-core/src/index.ts"),
      "@sportverse/platform": resolve(__dirname, "packages/platform/src/index.ts"),
      "@sportverse/rating-engine": resolve(__dirname, "packages/rating-engine/src/index.ts"),
      "@sportverse/draftballer-core": resolve(__dirname, "packages/draftballer-core/src/index.ts"),
      "@sportverse/draftballer-types": resolve(__dirname, "packages/draftballer-types/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "services/**/*.test.ts"],
  },
});
