import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from "node:path";
import { cpSync, mkdirSync, readdirSync } from "node:fs";

const root = resolve(__dirname, "../..");
const base = process.env.VITE_BASE_PATH ?? "/";

const workspacePackages = [
  "@sportverse/content-gen",
  "@sportverse/sports-db",
  "@sportverse/quiz-engine",
  "@sportverse/sim-core",
  "@sportverse/platform",
] as const;

function copySportsDbData() {
  const src = resolve(root, "packages/sports-db/data");
  const dest = resolve(__dirname, "public/data");
  mkdirSync(dest, { recursive: true });
  for (const file of readdirSync(src)) {
    if (file.endsWith(".json")) {
      cpSync(resolve(src, file), resolve(dest, file));
    }
  }
}

export default defineConfig({
  base,
  resolve: {
    alias: {
      "@sportverse/content-gen": resolve(root, "packages/content-gen/src/index.ts"),
      "@sportverse/sports-db": resolve(root, "packages/sports-db/src/index.ts"),
      "@sportverse/quiz-engine": resolve(root, "packages/quiz-engine/src/index.ts"),
      "@sportverse/sim-core": resolve(root, "packages/sim-core/src/index.ts"),
      "@sportverse/platform": resolve(root, "packages/platform/src/index.ts"),
      "@sportverse/draftballer-types": resolve(root, "packages/draftballer-types/src/index.ts"),
      "@sportverse/rating-engine": resolve(root, "packages/rating-engine/src/index.ts"),
      "@sportverse/draftballer-core": resolve(root, "packages/draftballer-core/src/index.ts"),
      "@sportverse/match-sim": resolve(root, "packages/match-sim/src/index.ts"),
    },
  },
  optimizeDeps: {
    // Workspace sources are aliased to .ts entry files — skip pre-bundle so nested imports resolve.
    exclude: [...workspacePackages],
  },
  server: {
    port: 5174,
    fs: { allow: [root] },
  },
  plugins: [
    {
      name: "copy-sports-db-data",
      buildStart() {
        copySportsDbData();
      },
      configureServer() {
        copySportsDbData();
      },
    },
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "SPORTVERSE",
        short_name: "SPORTVERSE",
        description: "A living universe of interconnected sports games.",
        theme_color: "#0a1628",
        background_color: "#0a1628",
        display: "standalone",
        start_url: base,
        icons: [
          { src: `${base}favicon.svg`.replace("//", "/"), sizes: "512x512", type: "image/svg+xml", purpose: "any" },
        ],
      },
    }),
  ],
});
